import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import { EligibleTestService } from '../../ranking/services/eligible-test.service';
import { ReportAudienceService } from './report-audience.service';
import type { EligibleTest } from '../../ranking/types/eligible-test.type';
import { isTestExpectedForLearner } from '../../ranking/utils/test-scope.util';
import { Result } from '../../results/entities/result.entity';
import {
    AttemptStatus,
    TestAttempt,
} from '../../test_attempts/entities/test_attempt.entity';
import { User, UserStatus } from '../../user/entities/user.entity';
import { REPORT_LEARNER_ROLES } from '../constants/report-user-exclusions.constant';
import {
    AdminNonParticipatingUserDto,
    AdminNonParticipationReason,
    AdminNonParticipationReportDto,
    AdminNonParticipationTestDto,
} from '../dto/admin-non-participation.dto';

/** Hard ceiling on evaluated learners so one request cannot stall the API. */
const MAX_EVALUATED_LEARNERS = 1000;

/** Filters accepted by the non-participation report. */
export interface NonParticipationFilters {
    /** Narrows to one branch. Omit for the organisation-wide view. */
    readonly branchId?: string;
}

/** Non-voided attempt outcomes for one learner on one test. */
interface AttemptTally {
    attemptCount: number;
    expiredCount: number;
    hasSubmitted: boolean;
}

/** A learner in the evaluated population. */
interface RosterLearner {
    readonly userId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string | null;
    readonly branchId: string | null;
    readonly branchName: string | null;
    readonly branchAlias: string | null;
}

/**
 * Learners who have not participated in tests whose exam window has closed.
 *
 * ## Eligible tests
 * Resolved by `EligibleTestService`, so this report and the leaderboard agree
 * on what counts: `isActive = 1`, both `examStartDate` and `examEndDate` set
 * and in the past, and the window fully closed. Open and future windows are
 * never included — a learner still has time to sit those.
 *
 * Unlike the leaderboard, no period filter is applied. A test missed three
 * months ago stays on this list until the learner completes it.
 *
 * ## Non-participation
 * A learner participated in a test only when **both** are true:
 * - a non-voided `submitted` attempt exists, and
 * - a non-voided `results` row exists for that learner and test.
 *
 * Anything else is non-participation, which covers all three reporting rules:
 * no attempts at all, only expired attempts, or a submission that never
 * produced a graded result. The last case is real in this system — see the
 * `pending-attempts` endpoint — and the previous `tests-not-completed` report
 * missed it because it read attempt status alone.
 */
@Injectable()
export class NonParticipationReportsService {
    private readonly logger = new Logger(NonParticipationReportsService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        private readonly eligibleTestService: EligibleTestService,
        private readonly reportAudienceService: ReportAudienceService,
    ) {}

    /** Builds the non-participation report for the caller's organisation. */
    async getNonParticipation(
        scope: OrgBranchScope,
        filters: NonParticipationFilters = {},
    ): Promise<AdminNonParticipationReportDto> {
        const orgId = this.requireOrg(scope);
        const generatedAt = new Date();

        const [roster, eligibleTests] = await Promise.all([
            this.getLearnerRoster(orgId, filters.branchId),
            this.eligibleTestService.resolveEligibleTests({
                orgId,
                branchId: filters.branchId,
            }),
        ]);

        if (roster.length === 0 || eligibleTests.length === 0) {
            return this.emptyReport(
                roster.length,
                eligibleTests.length,
                generatedAt,
            );
        }

        const testIds = eligibleTests.map(test => test.testId);
        const [attemptsByUserAndTest, gradedUserAndTest] = await Promise.all([
            this.getAttemptTallies(orgId, testIds),
            this.getGradedUserTestKeys(orgId, testIds),
        ]);

        const users: AdminNonParticipatingUserDto[] = [];
        let totalMissedAssignments = 0;
        let fullyNonParticipatingUserCount = 0;
        // Branch-scoped tests are not expected of everyone, so the denominator
        // only counts learners who actually had something to sit.
        let evaluatedLearnerCount = 0;

        for (const learner of roster) {
            const expectedTests = eligibleTests.filter(test =>
                isTestExpectedForLearner(test, learner.branchId),
            );
            if (expectedTests.length === 0) {
                continue;
            }
            evaluatedLearnerCount += 1;

            const missedTests = expectedTests.reduce<
                AdminNonParticipationTestDto[]
            >((missed, test) => {
                const key = this.pairKey(learner.userId, test.testId);
                const tally = attemptsByUserAndTest.get(key);
                const hasResult = gradedUserAndTest.has(key);
                const reason = this.resolveReason(tally, hasResult);

                if (reason !== null) {
                    missed.push(
                        this.mapMissedTest(test, reason, tally?.attemptCount ?? 0),
                    );
                }
                return missed;
            }, []);

            if (missedTests.length === 0) {
                continue;
            }

            const hasNoParticipation = missedTests.length === expectedTests.length;
            if (hasNoParticipation) {
                fullyNonParticipatingUserCount += 1;
            }
            totalMissedAssignments += missedTests.length;

            users.push({
                userId: learner.userId,
                firstName: learner.firstName,
                lastName: learner.lastName,
                email: learner.email,
                branchName: learner.branchName,
                branchAlias: learner.branchAlias,
                eligibleTestCount: expectedTests.length,
                missedTestCount: missedTests.length,
                participatedTestCount: expectedTests.length - missedTests.length,
                hasNoParticipation,
                missedTests,
            });
        }

        users.sort(
            (left, right) =>
                right.missedTestCount - left.missedTestCount ||
                `${left.lastName} ${left.firstName}`.localeCompare(
                    `${right.lastName} ${right.firstName}`,
                ),
        );

        this.logger.debug(
            `Non-participation: ${users.length} of ${evaluatedLearnerCount} learners across ${eligibleTests.length} eligible tests for org ${orgId}`,
        );

        return {
            summary: {
                totalEligibleTests: eligibleTests.length,
                totalLearners: evaluatedLearnerCount,
                nonParticipatingUserCount: users.length,
                fullyNonParticipatingUserCount,
                totalMissedAssignments,
            },
            users,
            generatedAt,
        };
    }

    /**
     * Classifies one learner-test pair, or `null` when they participated.
     *
     * Order matters: the most specific explanation an admin can act on wins.
     */
    private resolveReason(
        tally: AttemptTally | undefined,
        hasResult: boolean,
    ): AdminNonParticipationReason | null {
        if (!tally || tally.attemptCount === 0) {
            return 'no_attempts';
        }

        if (!tally.hasSubmitted) {
            return tally.expiredCount === tally.attemptCount
                ? 'expired_only'
                : 'not_submitted';
        }

        // Submitted, but grading never produced a row — the test is not done.
        return hasResult ? null : 'missing_result';
    }

    private mapMissedTest(
        test: EligibleTest,
        reason: AdminNonParticipationReason,
        attemptCount: number,
    ): AdminNonParticipationTestDto {
        return {
            testId: test.testId,
            testTitle: test.testTitle,
            courseTitle: test.courseTitle,
            examStartDate: test.examStartDate,
            examEndDate: test.examEndDate,
            reason,
            attemptCount,
        };
    }

    /**
     * Attempt counts per learner and test.
     *
     * Cancelled attempts are ignored: an administrator withdrew them, so they
     * are not evidence of either participation or avoidance. Voided attempts
     * (anti-cheat resets) are excluded for the same reason.
     */
    private async getAttemptTallies(
        orgId: string,
        testIds: readonly number[],
    ): Promise<Map<string, AttemptTally>> {
        if (testIds.length === 0) {
            return new Map();
        }

        const rows = await this.testAttemptRepository
            .createQueryBuilder('attempt')
            .leftJoin('attempt.orgId', 'org')
            .where('org.id = :orgId', { orgId })
            .andWhere('attempt.testId IN (:...testIds)', { testIds })
            .andWhere('attempt.voidedByResetId IS NULL')
            .andWhere('attempt.status != :cancelled', {
                cancelled: AttemptStatus.CANCELLED,
            })
            .select('attempt.userId', 'userId')
            .addSelect('attempt.testId', 'testId')
            .addSelect('attempt.status', 'status')
            .getRawMany<{
                userId: string;
                testId: number | string;
                status: AttemptStatus;
            }>();

        const tallies = new Map<string, AttemptTally>();
        for (const row of rows) {
            const key = this.pairKey(row.userId, Number(row.testId));
            const tally = tallies.get(key) ?? {
                attemptCount: 0,
                expiredCount: 0,
                hasSubmitted: false,
            };

            tally.attemptCount += 1;
            if (row.status === AttemptStatus.EXPIRED) {
                tally.expiredCount += 1;
            }
            if (row.status === AttemptStatus.SUBMITTED) {
                tally.hasSubmitted = true;
            }

            tallies.set(key, tally);
        }

        return tallies;
    }

    /** Learner-test pairs that have at least one non-voided graded result. */
    private async getGradedUserTestKeys(
        orgId: string,
        testIds: readonly number[],
    ): Promise<Set<string>> {
        if (testIds.length === 0) {
            return new Set();
        }

        const rows = await this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .where('org.id = :orgId', { orgId })
            .andWhere('result.testId IN (:...testIds)', { testIds })
            .andWhere('result.voidedByResetId IS NULL')
            .select('result.userId', 'userId')
            .addSelect('result.testId', 'testId')
            .groupBy('result.userId')
            .addGroupBy('result.testId')
            .getRawMany<{ userId: string; testId: number | string }>();

        return new Set(
            rows.map(row => this.pairKey(row.userId, Number(row.testId))),
        );
    }

    /** Active learners in scope — the population this report evaluates. */
    private async getLearnerRoster(
        orgId: string,
        branchId?: string,
    ): Promise<RosterLearner[]> {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .leftJoin('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role IN (:...learnerRoles)', {
                learnerRoles: REPORT_LEARNER_ROLES,
            })
            .andWhere('user.status = :activeStatus', {
                activeStatus: UserStatus.ACTIVE,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('user.email', 'email')
            .addSelect('branch.id', 'branchId')
            .addSelect('branch.name', 'branchName')
            .addSelect('branch.alias', 'branchAlias')
            .orderBy('user.lastName', 'ASC')
            .addOrderBy('user.firstName', 'ASC')
            .limit(MAX_EVALUATED_LEARNERS);

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        await this.reportAudienceService.omitFromQuery(query, 'user.id', orgId);

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            branchId: string | null;
            branchName: string | null;
            branchAlias: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            email: row.email ?? null,
            branchId: row.branchId ?? null,
            branchName: row.branchName ?? null,
            branchAlias: row.branchAlias ?? null,
        }));
    }

    private emptyReport(
        totalLearners: number,
        totalEligibleTests: number,
        generatedAt: Date,
    ): AdminNonParticipationReportDto {
        return {
            summary: {
                totalEligibleTests,
                totalLearners,
                nonParticipatingUserCount: 0,
                fullyNonParticipatingUserCount: 0,
                totalMissedAssignments: 0,
            },
            users: [],
            generatedAt,
        };
    }

    private pairKey(userId: string, testId: number): string {
        return `${userId}:${testId}`;
    }

    private requireOrg(scope: OrgBranchScope): string {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }
        return scope.orgId;
    }
}
