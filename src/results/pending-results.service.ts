import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, IsNull } from 'typeorm';
import { Result } from './entities/result.entity';
import {
    TestAttempt,
    AttemptStatus,
} from '../test_attempts/entities/test_attempt.entity';
import { Answer } from '../answers/entities/answer.entity';
import { AnswersService } from '../answers/answers.service';
import { ResultsService } from './results.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { UserRole } from '../user/entities/user.entity';
import { PendingResultFilterDto } from './dto/pending-result-filter.dto';
import {
    GradeStoredAttemptFailureDto,
    GradeStoredAttemptResultDto,
    GradeStoredAttemptsResponseDto,
    PendingResultAttemptDto,
    PendingResultListDto,
    PendingResultReason,
} from './dto/pending-result.dto';
import {
    DEFAULT_PENDING_RESULTS_LIMIT,
    DEFAULT_PENDING_RESULTS_PAGE,
    PENDING_IN_PROGRESS_MIN_PERCENTAGE,
} from './constants/pending-results.constants';

interface AnswerStatRow {
    attemptId: number;
    answerCount: string | number;
    markedCount: string | number;
}

interface StatusCountRow {
    status: AttemptStatus;
    count: string | number;
}

/**
 * Admin recovery for attempts that have stored answers but no live result.
 *
 * Typical cause (attempt 668): auto-mark + `createFromAttempt` timed out after
 * answers were saved, so the learner saw submit success with nothing in Past
 * Results. This service grades those answers in place and inserts the missing
 * row (or re-grades an existing one).
 */
@Injectable()
export class PendingResultsService {
    private readonly logger = new Logger(PendingResultsService.name);

    /** Per-process lock so concurrent grade calls on the same attempt don't double-insert. */
    private readonly gradingAttemptIds = new Set<number>();

    constructor(
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        private readonly answersService: AnswersService,
        private readonly resultsService: ResultsService,
    ) {}

    /**
     * Paginated list of live attempts with answers and no non-voided result.
     */
    async listPendingAttempts(
        scope: OrgBranchScope,
        filterDto: PendingResultFilterDto,
    ): Promise<PendingResultListDto> {
        this.assertAdminAccess(scope);

        const page = filterDto.page ?? DEFAULT_PENDING_RESULTS_PAGE;
        const limit = filterDto.limit ?? DEFAULT_PENDING_RESULTS_LIMIT;

        const listQuery = this.buildPendingAttemptsQuery(scope, filterDto, true);
        const total = await listQuery.clone().getCount();
        const attempts = await listQuery
            .orderBy('attempt.submitTime', 'DESC')
            .addOrderBy('attempt.updatedAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        this.logger.debug(
            `Pending results list: org=${scope.orgId ?? 'none'} branch=${scope.branchId ?? 'none'} total=${total} page=${page}`,
        );
        const answerStats = await this.loadAnswerStats(
            attempts.map(attempt => attempt.attemptId),
        );
        const summaryCounts = await this.loadPendingStatusCounts(scope, filterDto);

        return {
            summary: {
                totalPending: total,
                submittedWithoutResult: summaryCounts.submittedWithoutResult,
                inProgressCompleteWithoutResult:
                    summaryCounts.inProgressCompleteWithoutResult,
                expiredWithoutResult: summaryCounts.expiredWithoutResult,
            },
            attempts: attempts.map(attempt =>
                this.mapPendingAttempt(attempt, answerStats),
            ),
            total,
            page,
            limit,
        };
    }

    /**
     * Auto-mark stored answers, create the missing result (or re-grade), and
     * leave the attempt `submitted`. Idempotent when a result already exists
     * unless `regrade` is true.
     */
    async gradeStoredAttempt(
        attemptId: number,
        scope: OrgBranchScope,
        regrade = false,
    ): Promise<GradeStoredAttemptResultDto> {
        this.assertAdminAccess(scope);
        this.acquireGradeLock(attemptId);

        try {
            return await this.gradeStoredAttemptUnlocked(
                attemptId,
                scope,
                regrade,
            );
        } finally {
            this.releaseGradeLock(attemptId);
        }
    }

    /**
     * Sequential bulk grade so one failure does not abort the rest.
     */
    async gradeStoredAttempts(
        attemptIds: number[],
        scope: OrgBranchScope,
        regrade = false,
    ): Promise<GradeStoredAttemptsResponseDto> {
        this.assertAdminAccess(scope);

        const uniqueIds = [...new Set(attemptIds)];
        const results: Array<
            GradeStoredAttemptResultDto | GradeStoredAttemptFailureDto
        > = [];

        for (const attemptId of uniqueIds) {
            try {
                const graded = await this.gradeStoredAttempt(
                    attemptId,
                    scope,
                    regrade,
                );
                results.push(graded);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to grade this attempt';
                this.logger.warn(
                    `Bulk grade failed for attempt ${attemptId}: ${message}`,
                );
                results.push({
                    attemptId,
                    success: false,
                    message,
                });
            }
        }

        const succeeded = results.filter(
            item => !('success' in item && item.success === false),
        ).length;

        return {
            processed: uniqueIds.length,
            succeeded,
            failed: uniqueIds.length - succeeded,
            results,
        };
    }

    private async gradeStoredAttemptUnlocked(
        attemptId: number,
        scope: OrgBranchScope,
        regrade: boolean,
    ): Promise<GradeStoredAttemptResultDto> {
        const attempt = await this.loadAttemptForGrading(attemptId);
        this.assertAttemptAccessible(attempt, scope);

        if (attempt.voidedByResetId != null) {
            throw new BadRequestException(
                'Cannot grade a voided attempt. Reset history stays hidden from learners.',
            );
        }

        if (attempt.status === AttemptStatus.CANCELLED) {
            throw new BadRequestException(
                'Cannot grade a cancelled attempt',
            );
        }

        const answerCount = await this.answerRepository.count({
            where: { attemptId },
        });
        if (answerCount === 0) {
            throw new BadRequestException(
                'Cannot grade an attempt with no stored answers',
            );
        }

        // Mark with attempt identity only — skip admin branch filters so every
        // saved answer on this attempt is scored (the 668 path already marked
        // most answers; this catches any that were still unmarked).
        const answersMarked = await this.answersService.autoMark(attemptId, {
            userId: scope.userId,
            userRole: scope.userRole,
        });

        const existingResult = await this.resultRepository.findOne({
            where: { attemptId, voidedByResetId: IsNull() },
        });

        if (existingResult && !regrade) {
            await this.ensureAttemptSubmitted(attempt);
            return {
                attemptId,
                action: 'already_graded',
                resultId: existingResult.resultId,
                score: Number(existingResult.score),
                maxScore: Number(existingResult.maxScore),
                percentage: Number(existingResult.percentage),
                passed: existingResult.passed,
                answersMarked,
                attemptStatus: AttemptStatus.SUBMITTED,
            };
        }

        let resultDto;
        let action: GradeStoredAttemptResultDto['action'];

        if (existingResult && regrade) {
            resultDto = await this.resultsService.recalculateResult(
                existingResult.resultId,
                scope,
                scope.userId,
            );
            action = 'updated';
        } else {
            resultDto = await this.resultsService.createFromAttempt(attemptId);
            action = existingResult ? 'already_graded' : 'created';
        }

        if (!resultDto?.resultId) {
            throw new BadRequestException(
                'Grading finished without a result row. Please try again.',
            );
        }

        await this.ensureAttemptSubmitted(attempt);
        await this.resultsService.invalidateCachesAfterAttemptReset();

        return {
            attemptId,
            action,
            resultId: resultDto.resultId,
            score: Number(resultDto.score),
            maxScore: Number(resultDto.maxScore),
            percentage: Number(resultDto.percentage),
            passed: resultDto.passed,
            answersMarked,
            attemptStatus: AttemptStatus.SUBMITTED,
        };
    }

    /**
     * Stuck attempts: live (not voided), have stored answers, and no live result.
     *
     * Uses NOT EXISTS instead of `LEFT JOIN results … WHERE resultId IS NULL`.
     * TypeORM can turn that left join into an inner join once other result rows
     * exist, which hides every pending attempt (including 668).
     */
    private buildPendingAttemptsQuery(
        scope: OrgBranchScope,
        filterDto: PendingResultFilterDto,
        withEntities: boolean,
    ): SelectQueryBuilder<TestAttempt> {
        const query = this.testAttemptRepository.createQueryBuilder('attempt');

        if (withEntities) {
            query
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('attempt.user', 'user')
                .leftJoinAndSelect('attempt.branchId', 'branch');
        } else {
            query
                .leftJoin('attempt.test', 'test')
                .leftJoin('attempt.user', 'user');
        }

        query
            .leftJoin('attempt.orgId', 'org')
            .where('attempt.voidedByResetId IS NULL')
            .andWhere(
                `NOT EXISTS (
                    SELECT 1 FROM results pendingLiveResult
                    WHERE pendingLiveResult.attemptId = attempt.attemptId
                      AND pendingLiveResult.voidedByResetId IS NULL
                )`,
            )
            .andWhere(
                `EXISTS (
                    SELECT 1 FROM answers pendingAnswer
                    WHERE pendingAnswer.attemptId = attempt.attemptId
                )`,
            );

        // Same org join as the admin dashboard (`org.id`). Skip when the JWT
        // has no org (master_admin) rather than returning an empty list.
        if (scope.orgId) {
            query.andWhere('org.id = :orgId', { orgId: scope.orgId });
        }

        // Do not apply content-style branch visibility here. That helper keeps
        // `branchId = JWT branch OR NULL`, but learner attempts store a real
        // branch UUID. This admin JWT is `branch: 2` while attempt 668 is
        // `68b3ac03-6906-4466-97fa-9c9c92ff0957`, so the filter hid every
        // pending row. Org scope is the correct isolation for recovery.
        this.applyPendingStatusFilter(
            query,
            filterDto.status as AttemptStatus | undefined,
        );

        if (filterDto.testId) {
            query.andWhere('attempt.testId = :testId', {
                testId: filterDto.testId,
            });
        }

        if (filterDto.userId) {
            query.andWhere('attempt.userId = :userId', {
                userId: filterDto.userId,
            });
        }

        if (filterDto.search?.trim()) {
            const search = `%${filterDto.search.trim()}%`;
            query.andWhere(
                `(user.firstName LIKE :search
                  OR user.lastName LIKE :search
                  OR user.email LIKE :search
                  OR test.title LIKE :search
                  OR CAST(attempt.attemptId AS CHAR) LIKE :search)`,
                { search },
            );
        }

        if (filterDto.from) {
            query.andWhere(
                'COALESCE(attempt.submitTime, attempt.updatedAt) >= :from',
                { from: filterDto.from },
            );
        }

        if (filterDto.to) {
            query.andWhere(
                'COALESCE(attempt.submitTime, attempt.updatedAt) <= :to',
                { to: filterDto.to },
            );
        }

        return query;
    }

    private applyPendingStatusFilter(
        query: SelectQueryBuilder<TestAttempt>,
        status?: AttemptStatus,
    ): void {
        query.setParameter('submittedStatus', AttemptStatus.SUBMITTED);
        query.setParameter('inProgressStatus', AttemptStatus.IN_PROGRESS);
        query.setParameter('expiredStatus', AttemptStatus.EXPIRED);
        query.setParameter(
            'completeProgress',
            PENDING_IN_PROGRESS_MIN_PERCENTAGE,
        );

        if (status === AttemptStatus.SUBMITTED) {
            query.andWhere('attempt.status = :submittedStatus');
            return;
        }

        if (status === AttemptStatus.EXPIRED) {
            query.andWhere('attempt.status = :expiredStatus');
            return;
        }

        if (status === AttemptStatus.IN_PROGRESS) {
            query.andWhere('attempt.status = :inProgressStatus');
            query.andWhere(
                '(attempt.progressPercentage >= :completeProgress OR attempt.submitTime IS NOT NULL)',
            );
            return;
        }

        query.andWhere(
            `(
                attempt.status = :submittedStatus
                OR (
                    attempt.status = :inProgressStatus
                    AND (
                        attempt.progressPercentage >= :completeProgress
                        OR attempt.submitTime IS NOT NULL
                    )
                )
                OR attempt.status = :expiredStatus
            )`,
        );
    }

    private async loadPendingStatusCounts(
        scope: OrgBranchScope,
        filterDto: PendingResultFilterDto,
    ): Promise<{
        submittedWithoutResult: number;
        inProgressCompleteWithoutResult: number;
        expiredWithoutResult: number;
    }> {
        const countsQuery = this.buildPendingAttemptsQuery(
            scope,
            {
                ...filterDto,
                status: undefined,
                page: undefined,
                limit: undefined,
            },
            false,
        );
        countsQuery
            .select('attempt.status', 'status')
            .addSelect('COUNT(DISTINCT attempt.attemptId)', 'count')
            .groupBy('attempt.status');

        const rows = await countsQuery.getRawMany<StatusCountRow>();
        const byStatus = new Map<AttemptStatus, number>();
        for (const row of rows) {
            byStatus.set(row.status, Number(row.count) || 0);
        }

        return {
            submittedWithoutResult: byStatus.get(AttemptStatus.SUBMITTED) ?? 0,
            inProgressCompleteWithoutResult:
                byStatus.get(AttemptStatus.IN_PROGRESS) ?? 0,
            expiredWithoutResult: byStatus.get(AttemptStatus.EXPIRED) ?? 0,
        };
    }

    private async loadAnswerStats(
        attemptIds: number[],
    ): Promise<Map<number, { answerCount: number; markedCount: number }>> {
        const stats = new Map<
            number,
            { answerCount: number; markedCount: number }
        >();
        if (attemptIds.length === 0) {
            return stats;
        }

        const rows = await this.answerRepository
            .createQueryBuilder('answer')
            .select('answer.attemptId', 'attemptId')
            .addSelect('COUNT(answer.answerId)', 'answerCount')
            .addSelect(
                'SUM(CASE WHEN answer.isMarked = 1 THEN 1 ELSE 0 END)',
                'markedCount',
            )
            .where('answer.attemptId IN (:...attemptIds)', { attemptIds })
            .groupBy('answer.attemptId')
            .getRawMany<AnswerStatRow>();

        for (const row of rows) {
            stats.set(Number(row.attemptId), {
                answerCount: Number(row.answerCount) || 0,
                markedCount: Number(row.markedCount) || 0,
            });
        }

        return stats;
    }

    private mapPendingAttempt(
        attempt: TestAttempt,
        answerStats: Map<number, { answerCount: number; markedCount: number }>,
    ): PendingResultAttemptDto {
        const stats = answerStats.get(attempt.attemptId) ?? {
            answerCount: 0,
            markedCount: 0,
        };

        return {
            attemptId: attempt.attemptId,
            testId: attempt.testId,
            testTitle: attempt.test?.title ?? `Test #${attempt.testId}`,
            userId: attempt.userId,
            firstName: attempt.user?.firstName ?? '',
            lastName: attempt.user?.lastName ?? '',
            email: attempt.user?.email ?? '',
            branchName: attempt.branchId?.name ?? null,
            status: attempt.status,
            progressPercentage: Number(attempt.progressPercentage) || 0,
            submitTime: attempt.submitTime
                ? new Date(attempt.submitTime).toISOString()
                : null,
            startTime: new Date(attempt.startTime).toISOString(),
            updatedAt: new Date(attempt.updatedAt).toISOString(),
            answerCount: stats.answerCount,
            markedCount: stats.markedCount,
            reason: this.resolveReason(attempt),
        };
    }

    private resolveReason(attempt: TestAttempt): PendingResultReason {
        if (attempt.status === AttemptStatus.EXPIRED) {
            return PendingResultReason.EXPIRED_WITHOUT_RESULT;
        }
        if (attempt.status === AttemptStatus.IN_PROGRESS) {
            return PendingResultReason.IN_PROGRESS_COMPLETE_WITHOUT_RESULT;
        }
        return PendingResultReason.SUBMITTED_WITHOUT_RESULT;
    }

    private async loadAttemptForGrading(
        attemptId: number,
    ): Promise<TestAttempt> {
        const attempt = await this.testAttemptRepository
            .createQueryBuilder('attempt')
            .leftJoinAndSelect('attempt.test', 'test')
            .leftJoin('attempt.orgId', 'orgId')
            .addSelect(['orgId.id'])
            .leftJoin('attempt.branchId', 'branchId')
            .addSelect(['branchId.id'])
            .where('attempt.attemptId = :attemptId', { attemptId })
            .getOne();

        if (!attempt) {
            throw new NotFoundException(
                `Test attempt with ID ${attemptId} not found`,
            );
        }

        return attempt;
    }

    private assertAttemptAccessible(
        attempt: TestAttempt,
        scope: OrgBranchScope,
    ): void {
        const attemptOrgId = attempt.orgId?.id;
        if (scope.orgId && attemptOrgId && attemptOrgId !== scope.orgId) {
            throw new ForbiddenException(
                'Not authorized to grade this attempt',
            );
        }
    }

    private async ensureAttemptSubmitted(attempt: TestAttempt): Promise<void> {
        const updates: Partial<TestAttempt> = {};

        if (attempt.status !== AttemptStatus.SUBMITTED) {
            updates.status = AttemptStatus.SUBMITTED;
            updates.progressPercentage = 100;
        }

        if (!attempt.submitTime) {
            updates.submitTime = new Date();
        }

        if (Object.keys(updates).length === 0) {
            return;
        }

        await this.testAttemptRepository.update(attempt.attemptId, updates);
    }

    private acquireGradeLock(attemptId: number): void {
        if (this.gradingAttemptIds.has(attemptId)) {
            throw new ConflictException(
                'This attempt is already being graded. Please wait and try again.',
            );
        }
        this.gradingAttemptIds.add(attemptId);
    }

    private releaseGradeLock(attemptId: number): void {
        this.gradingAttemptIds.delete(attemptId);
    }

    private assertAdminAccess(scope: OrgBranchScope): void {
        const allowedRoles: UserRole[] = [
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.MASTER_ADMIN,
        ];

        if (
            !scope.userRole ||
            !allowedRoles.includes(scope.userRole as UserRole)
        ) {
            throw new ForbiddenException(
                'Admin access required to manage pending results',
            );
        }
    }
}
