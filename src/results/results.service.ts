import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, IsNull } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Result } from './entities/result.entity';
import { CreateResultDto } from './dto/create-result.dto';
import { ResultResponseDto } from './dto/result-response.dto';
import { ResultFilterDto } from './dto/result-filter.dto';
import { ResultAnalyticsDto } from './dto/result-analytics.dto';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Answer } from '../answers/entities/answer.entity';
import { Question } from '../questions/entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { plainToClass } from 'class-transformer';
import { AttemptStatus } from '../test_attempts/entities/test_attempt.entity';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { CommunicationsService } from '../communications/communications.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { TrainingProgressService } from '../training_progress/training_progress.service';
import { User, UserRole, UserStatus } from '../user/entities/user.entity';
import { RewardsService } from '../rewards/rewards.service';
import {
    PASSING_SCORE_PERCENTAGE,
    isPassingPercentage,
} from './constants/passing-score.constants';
import { TrainingHoursService } from '../training-hours/training-hours.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestResultCreatedEvent } from '../common/events/test-result-created.event';
import {
    AdminResultsDashboardDto,
} from './dto/admin-results-dashboard.dto';
import { AdminEmployeeMetricsFilterDto } from './dto/admin-employee-metrics-filter.dto';
import { AdminEmployeeMetricsDto } from './dto/admin-employee-metrics.dto';
import {
    AdminEmployeePerformanceFilterDto,
    AdminEmployeePerformanceSortBy,
    SortOrder,
} from './dto/admin-employee-performance-filter.dto';
import {
    AdminEmployeePerformanceDto,
    AdminEmployeePerformanceRowDto,
    AdminEmployeePerformanceTestRefDto,
} from './dto/admin-employee-performance.dto';
import { applyBranchVisibilityToQuery } from '../auth/utils/branch-visibility.util';
import {
    isExamWindowClosed,
    isExamWindowOpen,
    isExamWindowPending,
    toNullableDate,
} from '../test/utils/exam-window.util';

@Injectable()
export class ResultsService {
    private readonly logger = new Logger(ResultsService.name);

    private static readonly MONTH_LABELS = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ] as const;

    // Cache key patterns with org/branch scoping
    private readonly CACHE_KEYS = {
        USER_RESULTS: (
            userId: string,
            filters: string,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:${userId}:results:${filters}`,
        TEST_RESULTS: (
            testId: number,
            filters: string,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}:results:${filters}`,
        COURSE_RESULTS: (
            courseId: number,
            filters: string,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:course:${courseId}:results:${filters}`,
        RESULT_DETAILS: (resultId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:result:${resultId}`,
        TEST_ANALYTICS: (testId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:analytics:${testId}`,
    };

    // Cache TTL configurations (in seconds)
    private readonly CACHE_TTL = {
        RESULT_DETAILS: 300, // 5 minutes - results change occasionally
        USER_RESULTS: 180, // 3 minutes - user result lists
        TEST_RESULTS: 300, // 5 minutes - test result lists
        COURSE_RESULTS: 600, // 10 minutes - course results change less frequently
        TEST_ANALYTICS: 900, // 15 minutes - analytics are more stable
    };

    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly leaderboardService: LeaderboardService,
        private readonly communicationsService: CommunicationsService,
        private readonly trainingProgressService: TrainingProgressService,
        private readonly rewardsService: RewardsService,
        private readonly trainingHoursService: TrainingHoursService,
        private readonly eventEmitter: EventEmitter2,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    async createFromAttempt(attemptId: number): Promise<ResultResponseDto> {
        try {
            this.logger.log(`Creating result from attempt ${attemptId}`);

            // Load test metadata only — joining org/branch hydrates whiteLabelingConfig
            // JSON and timed out on Render after auto-mark (read ETIMEDOUT).
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
                this.logger.error(`Test attempt ${attemptId} not found`);
                throw new NotFoundException(
                    `Test attempt with ID ${attemptId} not found`,
                );
            }

            this.logger.debug(`Found attempt ${attemptId}:`, {
                status: attempt.status,
                testId: attempt.testId,
                userId: attempt.userId,
                orgId: attempt.orgId?.id || 'null',
                branchId: attempt.branchId?.id || 'null',
                hasTest: !!attempt.test,
                testTitle: attempt.test?.title || 'null',
                courseId: attempt.test?.courseId || 'null',
                hasCourse: !!attempt.test?.course,
            });

            // Ignore voided rows so a reset cannot block a new live result.
            const existingResult = await this.resultRepository.findOne({
                where: { attemptId, voidedByResetId: IsNull() },
            });

            if (existingResult) {
                this.logger.log(
                    `Result already exists for attempt ${attemptId}: ${existingResult.resultId}`,
                );
                return {
                    resultId: existingResult.resultId,
                    attemptId: existingResult.attemptId,
                    userId: existingResult.userId,
                    testId: existingResult.testId,
                    courseId: existingResult.courseId,
                    score: Number(existingResult.score),
                    maxScore: Number(existingResult.maxScore),
                    percentage: Number(existingResult.percentage),
                    passed: existingResult.passed,
                    calculatedAt: existingResult.calculatedAt,
                } as ResultResponseDto;
            }

            // IN_PROGRESS is allowed so submit can persist the result before
            // flipping the attempt to submitted (avoids a success with no row).
            // EXPIRED is allowed for admin recovery of timed-out attempts that
            // still have stored answers but never received a result.
            if (
                attempt.status !== AttemptStatus.SUBMITTED &&
                attempt.status !== AttemptStatus.IN_PROGRESS &&
                attempt.status !== AttemptStatus.EXPIRED
            ) {
                this.logger.warn(
                    `Attempt ${attemptId} status is ${attempt.status}, cannot create result`,
                );
                throw new BadRequestException(
                    'Cannot create result for incomplete attempt',
                );
            }

            // Validate required data with fallback mechanism
            if (!attempt.test) {
                this.logger.warn(
                    `Test relation not loaded for attempt ${attemptId}. TestId: ${attempt.testId}. Attempting manual fetch...`,
                );

                // Fallback: manually fetch test data
                try {
                    const test = await this.testRepository.findOne({
                        where: { testId: attempt.testId },
                        select: ['testId', 'courseId', 'title'],
                    });

                    if (test) {
                        attempt.test = test;
                        this.logger.log(
                            `Successfully fetched test data manually for attempt ${attemptId}`,
                        );
                    } else {
                        this.logger.error(
                            `Test ${attempt.testId} not found in database for attempt ${attemptId}`,
                        );
                        throw new BadRequestException(
                            'Test not found for this attempt',
                        );
                    }
                } catch (fetchError) {
                    this.logger.error(
                        `Failed to manually fetch test data for attempt ${attemptId}:`,
                        fetchError,
                    );
                    throw new BadRequestException(
                        'Test data not found for attempt - relation not loaded',
                    );
                }
            }

            if (!attempt.test.courseId) {
                this.logger.error(
                    `Course ID missing for test ${attempt.test.testId} in attempt ${attemptId}`,
                );
                throw new BadRequestException('Course ID not found for test');
            }

            // Calculate the score
            this.logger.debug(`Calculating score for attempt ${attemptId}`);
            const { score, maxScore, percentage, totalQuestions, questionsAnswered } =
                await this.calculateScore(attemptId, attempt.testId);

            this.logger.debug(`Score calculated for attempt ${attemptId}:`, {
                score,
                maxScore,
                percentage,
            });

            // Pass mark raised from 60% to 80% (PASSING_SCORE_PERCENTAGE)
            const passed = isPassingPercentage(percentage);

            // Ensure we have org/branch data - inherit from attempt or use defaults
            let orgId = attempt.orgId;
            let branchId = attempt.branchId;

            // Slim join may omit org/branch objects — read FK columns directly.
            if (!orgId?.id) {
                const fkRow = await this.testAttemptRepository
                    .createQueryBuilder('attempt')
                    .select('attempt.orgIdId', 'orgId')
                    .addSelect('attempt.branchIdId', 'branchId')
                    .where('attempt.attemptId = :attemptId', { attemptId })
                    .getRawOne<{ orgId?: string; branchId?: string | null }>();
                if (fkRow?.orgId) {
                    orgId = { id: fkRow.orgId } as Result['orgId'];
                }
                if (fkRow?.branchId) {
                    branchId = { id: fkRow.branchId } as Result['branchId'];
                }
            }

            // If we still don't have org data, this is a critical error
            if (!orgId) {
                this.logger.error(
                    `No org data found for attempt ${attemptId} - cannot create result`,
                );
                throw new BadRequestException(
                    'Organization data required to create result',
                );
            }

            // Create the result with inherited org/branch from attempt
            const resultData: CreateResultDto = {
                attemptId,
                userId: attempt.userId,
                testId: attempt.testId,
                courseId: attempt.test.courseId,
                score,
                maxScore,
                percentage,
                passed,
                calculatedAt: new Date(),
            };

            this.logger.debug(
                `Creating result entity for attempt ${attemptId}:`,
                {
                    ...resultData,
                    orgId: orgId?.id || 'null',
                    branchId: branchId?.id || 'null',
                },
            );

            const result = this.resultRepository.create({
                ...resultData,
                // Inherit org/branch from the test attempt
                orgId: orgId,
                branchId: branchId,
            });

            this.logger.debug(`Saving result for attempt ${attemptId}`);
            const savedResult = await this.resultRepository.save(result);

            this.logger.log(
                `Result created successfully for attempt ${attemptId}: ${savedResult.resultId}`,
            );

            try {
                await this.syncTrainingProgressSnapshotForAttempt(attempt, {
                    percentage,
                    totalQuestions,
                    questionsAnswered,
                });
            } catch (progressError) {
                this.logger.error(
                    `Training progress snapshot failed after creating result ${savedResult.resultId} for attempt ${attemptId}`,
                    progressError instanceof Error
                        ? progressError.stack
                        : String(progressError),
                );
            }

            // Record training hours ledger entry (non-blocking)
            try {
                await this.trainingHoursService.recordTestAttemptSession(
                    attempt,
                );
            } catch (hoursError) {
                this.logger.error(
                    `Training hours recording failed for attempt ${attemptId} (non-fatal)`,
                    hoursError instanceof Error
                        ? hoursError.stack
                        : String(hoursError),
                );
            }

            // Phase 1: Enhanced Logging & Validation for Leaderboard Update
            this.logger.debug(`=== PHASE 1: Preparing Leaderboard Update ===`);
            this.logger.debug(`Leaderboard update preparation:`, {
                attemptId: attemptId,
                userId: attempt.userId,
                courseId: attempt.test.courseId,
                resultId: savedResult.resultId,
                score: score,
                maxScore: maxScore,
                percentage: percentage,
                passed: passed,
                orgId: orgId?.id || 'null',
                branchId: branchId?.id || 'null',
                testId: attempt.testId,
                testTitle: attempt.test?.title || 'unknown',
                timestamp: new Date().toISOString(),
            });

            // Phase 1: Pre-call validation
            const leaderboardValidation = this.validateLeaderboardPrerequisites(
                attempt,
                savedResult,
                { orgId, branchId },
            );

            if (!leaderboardValidation.isValid) {
                this.logger.error(
                    `=== PHASE 1: Leaderboard Update Validation Failed ===`,
                    {
                        attemptId,
                        errors: leaderboardValidation.errors,
                        warnings: leaderboardValidation.warnings,
                    },
                );

                // Don't proceed if critical validation fails
                if (leaderboardValidation.isCritical) {
                    this.logger.error(
                        `Critical validation failure - skipping leaderboard update for attempt ${attemptId}`,
                    );
                } else {
                    this.logger.warn(
                        `Non-critical validation issues found - proceeding with leaderboard update for attempt ${attemptId}`,
                    );
                }
            } else {
                this.logger.debug(
                    `=== PHASE 1: Validation Passed - Proceeding ===`,
                );
            }

            // Phase 2 & 3: Enhanced Leaderboard Service Call with Data Flow Verification
            if (
                leaderboardValidation.isValid ||
                !leaderboardValidation.isCritical
            ) {
                try {
                    this.logger.debug(
                        `=== PHASE 2 & 3: Initiating Leaderboard Service Call ===`,
                    );

                    // Phase 3: Verify data flow before call
                    const preCallVerification =
                        await this.verifyDataFlowIntegrity(
                            savedResult.resultId,
                            attempt.userId,
                            attempt.test.courseId,
                            { orgId, branchId },
                        );

                    this.logger.debug(
                        `Pre-call data verification:`,
                        preCallVerification,
                    );

                    if (!preCallVerification.isValid) {
                        throw new Error(
                            `Data flow verification failed: ${preCallVerification.errors.join(', ')}`,
                        );
                    }

                    // Phase 2: Enhanced service call with proper error context
                    this.logger.debug(
                        `Calling leaderboardService.updateUserScore with:`,
                        {
                            courseId: attempt.test.courseId,
                            userId: attempt.userId,
                            callContext: 'post-auto-marking',
                        },
                    );

                    const startTime = Date.now();
                    await this.leaderboardService.updateUserScore(
                        attempt.test.courseId,
                        attempt.userId,
                    );
                    const duration = Date.now() - startTime;

                    this.logger.debug(
                        `=== SUCCESS: Leaderboard updated successfully ===`,
                        {
                            userId: attempt.userId,
                            courseId: attempt.test.courseId,
                            resultId: savedResult.resultId,
                            duration: `${duration}ms`,
                            score: score,
                            percentage: percentage,
                        },
                    );

                    // Phase 3: Post-call verification
                    const postCallVerification =
                        await this.verifyLeaderboardUpdate(
                            attempt.userId,
                            attempt.test.courseId,
                            savedResult,
                        );

                    this.logger.debug(
                        `Post-call verification:`,
                        postCallVerification,
                    );

                    if (!postCallVerification.isValid) {
                        this.logger.warn(
                            `Post-call verification failed but leaderboard service completed:`,
                            postCallVerification,
                        );
                    }
                } catch (leaderboardError) {
                    // Phase 2: Enhanced error logging and analysis
                    this.logger.error(
                        `=== PHASE 2: Leaderboard Update Failed ===`,
                    );
                    this.logger.error(`Leaderboard service error details:`, {
                        attemptId: attemptId,
                        userId: attempt.userId,
                        courseId: attempt.test.courseId,
                        resultId: savedResult.resultId,
                        errorType:
                            leaderboardError?.constructor?.name || 'Unknown',
                        errorMessage:
                            leaderboardError instanceof Error
                                ? leaderboardError.message
                                : String(leaderboardError),
                        errorStack:
                            leaderboardError instanceof Error
                                ? leaderboardError.stack
                                : 'No stack available',
                        orgId: orgId?.id || 'null',
                        branchId: branchId?.id || 'null',
                        timestamp: new Date().toISOString(),
                    });

                    // Phase 2: Attempt to diagnose the failure
                    await this.diagnoseLeaderboardFailure(
                        attempt.userId,
                        attempt.test.courseId,
                        leaderboardError,
                        { orgId, branchId },
                    );
                }
            } else {
                this.logger.warn(
                    `Skipping leaderboard update due to critical validation failures for attempt ${attemptId}`,
                );
            }

            // Phase 4 — XP awards after leaderboard (non-blocking; never rolls back result)
            try {
                await this.rewardsService.processTestResultXp({
                    resultId: savedResult.resultId,
                    attemptId,
                    testId: attempt.testId,
                    courseId: attempt.test.courseId,
                    userId: attempt.userId,
                    percentage,
                    passed,
                    attemptNumber: attempt.attemptNumber,
                    testTitle: attempt.test.title,
                    orgId: orgId.id,
                    branchId: branchId?.id,
                });

                this.eventEmitter.emit(
                    'test.result.created',
                    new TestResultCreatedEvent(
                        savedResult.resultId,
                        attemptId,
                        attempt.testId,
                        attempt.test.courseId,
                        attempt.userId,
                        score,
                        percentage,
                        passed,
                        attempt.attemptNumber,
                        attempt.test.title,
                        orgId.id,
                        branchId?.id,
                    ),
                );
            } catch (xpError) {
                this.logger.error(
                    `XP award failed for result ${savedResult.resultId} (non-fatal)`,
                    xpError instanceof Error ? xpError.stack : String(xpError),
                );
            }

            // Send results summary email to the user
            try {
                await this.sendResultsSummaryEmail(savedResult, attempt);
                this.logger.debug(
                    `Results summary email sent to user ${attempt.userId} for result ${savedResult.resultId}`,
                );
            } catch (emailError) {
                // Log error but don't fail the result creation
                this.logger.error(
                    `Failed to send results summary email for result ${savedResult.resultId}`,
                    emailError instanceof Error
                        ? emailError.stack
                        : String(emailError),
                );
            }

            // Return the saved row only. findOne() hydrates user/org/branch JSON
            // and extra analytics — that second load timed out on Render after marking.
            return {
                resultId: savedResult.resultId,
                attemptId: savedResult.attemptId,
                userId: savedResult.userId,
                testId: savedResult.testId,
                courseId: savedResult.courseId,
                score: Number(savedResult.score),
                maxScore: Number(savedResult.maxScore),
                percentage: Number(savedResult.percentage),
                passed: savedResult.passed,
                calculatedAt: savedResult.calculatedAt,
            } as ResultResponseDto;
        } catch (error) {
            this.logger.error(
                `Failed to create result from attempt ${attemptId}:`,
                error instanceof Error ? error.stack : String(error),
            );

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            // Provide more specific error information
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            throw new InternalServerErrorException(
                `Failed to create result from attempt: ${errorMessage}`,
            );
        }
    }

    /**
     * Count pass/fail results for a user (used by test-attempt dashboard stats).
     *
     * @param userId - Learner being counted.
     * @param options - Optional test filter, caller scope and voided opt-in.
     * @returns Aggregate pass/fail counts for the learner.
     */
    async getUserResultCounts(
        userId: string,
        options: {
            testId?: number;
            scope?: OrgBranchScope;
            includeVoided?: boolean;
        } = {},
    ): Promise<{
        totalResults: number;
        passedResults: number;
        failedResults: number;
        averageScore: number;
        passRate: number;
    }> {
        const { testId, scope, includeVoided = false } = options;

        const buildQuery = (): SelectQueryBuilder<Result> => {
            const queryBuilder = this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId')
                .where('result.userId = :userId', { userId });

            if (testId) {
                queryBuilder.andWhere('result.testId = :testId', { testId });
            }
            if (scope?.orgId) {
                queryBuilder.andWhere('orgId.id = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope?.branchId) {
                queryBuilder.andWhere('branchId.id = :branchId', {
                    branchId: scope.branchId,
                });
            }

            return this.applyLiveResultFilter(queryBuilder, includeVoided);
        };

        const totalResults = await buildQuery().getCount();

        const passedResults = await buildQuery()
            .andWhere('result.passed = :passedTrue', { passedTrue: true })
            .getCount();

        const failedResults = totalResults - passedResults;

        const averageScoreRow = await buildQuery()
            .select('AVG(result.percentage)', 'averageScore')
            .getRawOne<{ averageScore: string | null }>();

        const averageScore = Number(averageScoreRow?.averageScore || 0);
        const passRate =
            totalResults > 0 ? (passedResults / totalResults) * 100 : 0;

        return {
            totalResults,
            passedResults,
            failedResults,
            averageScore: Math.round(averageScore * 100) / 100,
            passRate: Math.round(passRate * 100) / 100,
        };
    }

    /**
     * Hide results voided by an admin attempt reset.
     *
     * A result carries the full marked breakdown, including the correct answer
     * for every question, so pre-reset rows must never reach a learner who is
     * about to retake the test.
     *
     * @param queryBuilder - Query builder aliased on `result`.
     * @param includeVoided - Set only by elevated callers reading history.
     * @returns The same query builder for chaining.
     */
    private applyLiveResultFilter(
        queryBuilder: SelectQueryBuilder<Result>,
        includeVoided = false,
    ): SelectQueryBuilder<Result> {
        if (includeVoided) {
            return queryBuilder;
        }
        return queryBuilder.andWhere('result.voidedByResetId IS NULL');
    }

    /**
     * Drop cached result payloads after an administrator reset an attempt.
     *
     * Test and course result caches are keyed by an opaque filter blob, so
     * there is no key pattern to target. Resets are rare and deliberate, which
     * makes a full flush of this module's cache the safe trade — a cached page
     * still holds the answer key of a test the learner is about to retake.
     */
    async invalidateCachesAfterAttemptReset(): Promise<void> {
        await this.cacheManager.clear();
    }

    /** Restrict dashboard access to leadership roles only. */
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
                'Admin access required to view organization results',
            );
        }
    }

    /**
     * Apply org/branch and voided filters shared by admin dashboard queries.
     *
     * Voided results are excluded by default so organisation metrics describe
     * the currently valid state; `includeVoided` brings the history back.
     */
    private applyAdminScopeFilters(
        queryBuilder: SelectQueryBuilder<Result>,
        scope: OrgBranchScope,
        includeVoided = false,
    ): SelectQueryBuilder<Result> {
        if (scope.orgId) {
            queryBuilder.andWhere('orgId.id = :orgId', { orgId: scope.orgId });
        }
        if (scope.branchId) {
            queryBuilder.andWhere('branchId.id = :branchId', {
                branchId: scope.branchId,
            });
        }
        return this.applyLiveResultFilter(queryBuilder, includeVoided);
    }

    /**
     * Org-wide results dashboard for CEO / owner / admin review.
     *
     * Voided results are excluded unless the caller explicitly asks for the
     * history, so the headline numbers describe the organisation's currently
     * valid state.
     */
    async getAdminDashboard(
        scope: OrgBranchScope,
        filterDto: ResultFilterDto,
    ): Promise<AdminResultsDashboardDto> {
        this.assertAdminAccess(scope);

        // Manual refresh from the admin UI — drop stale cached test/course result payloads first.
        if (filterDto.refresh === true) {
            await this.invalidateCachesAfterAttemptReset();
        }

        const { page = 1, limit = 20, ...filters } = filterDto;
        const skip = (page - 1) * limit;
        // Read only after the role assertion above: learner-facing endpoints
        // share this DTO and must never be able to opt into voided rows.
        const includeVoided = filterDto.includeVoided === true;

        const summaryQuery = this.applyAdminScopeFilters(
            this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId'),
            scope,
            includeVoided,
        );

        if (filters.testId) {
            summaryQuery.andWhere('result.testId = :testId', {
                testId: filters.testId,
            });
        }
        if (filters.passed !== undefined) {
            summaryQuery.andWhere('result.passed = :passed', {
                passed: filters.passed,
            });
        }

        const totalResults = await summaryQuery.getCount();
        const passedCount = await summaryQuery
            .clone()
            .andWhere('result.passed = :passedTrue', { passedTrue: true })
            .getCount();
        const failedCount = totalResults - passedCount;

        const aggregateRow = await summaryQuery
            .clone()
            .select('AVG(result.score)', 'averageScore')
            .addSelect('AVG(result.percentage)', 'averagePercentage')
            .addSelect('COUNT(DISTINCT result.userId)', 'uniqueEmployees')
            .addSelect('COUNT(DISTINCT result.testId)', 'activeTests')
            .getRawOne<{
                averageScore: string;
                averagePercentage: string;
                uniqueEmployees: string;
                activeTests: string;
            }>();

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentResults = await summaryQuery
            .clone()
            .andWhere('result.calculatedAt >= :sevenDaysAgo', { sevenDaysAgo })
            .getCount();

        const passRate =
            totalResults > 0 ? (passedCount / totalResults) * 100 : 0;

        const listQuery = this.buildFilterQuery(filters, scope, includeVoided);
        listQuery.orderBy('result.calculatedAt', 'DESC');

        const [resultEntities, total] = await listQuery
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        const results = await Promise.all(
            resultEntities.map(result => this.getEnhancedResult(result)),
        );

        const testPerformanceRows = await this.applyAdminScopeFilters(
            this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.test', 'test')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId'),
            scope,
            includeVoided,
        )
            .select('test.testId', 'testId')
            .addSelect('test.title', 'testTitle')
            .addSelect('COUNT(result.resultId)', 'totalAttempts')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .groupBy('test.testId')
            .addGroupBy('test.title')
            .orderBy('totalAttempts', 'DESC')
            .limit(6)
            .getRawMany<{
                testId: number;
                testTitle: string;
                totalAttempts: string;
                averageScore: string;
                passedCount: string;
            }>();

        const topPerformerRows = await this.applyAdminScopeFilters(
            this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.user', 'user')
                .leftJoin('user.branchId', 'userBranch')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId'),
            scope,
            includeVoided,
        )
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('MAX(userBranch.name)', 'branchName')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'totalTests')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'testsPassed',
            )
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .having('COUNT(result.resultId) >= 1')
            .orderBy('averageScore', 'DESC')
            .limit(5)
            .getRawMany<{
                userId: string;
                firstName: string;
                lastName: string;
                branchName: string | null;
                averageScore: string;
                totalTests: string;
                testsPassed: string;
            }>();

        const topPerformers = await this.enrichTopPerformers(
            topPerformerRows,
            scope,
        );

        const needsAttentionRows = await this.applyAdminScopeFilters(
            this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.user', 'user')
                .leftJoin('result.test', 'test')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId'),
            scope,
            includeVoided,
        )
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect(
                'SUM(CASE WHEN result.passed = false THEN 1 ELSE 0 END)',
                'failedAttempts',
            )
            .addSelect('MAX(test.title)', 'lastFailedTest')
            // `where` resets the expression built above, so the voided filter
            // is re-applied here rather than relying on the shared helper.
            .where('result.passed = :failed', { failed: false })
            .andWhere(
                includeVoided ? '1 = 1' : 'result.voidedByResetId IS NULL',
            )
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .orderBy('failedAttempts', 'DESC')
            .limit(5)
            .getRawMany<{
                userId: string;
                firstName: string;
                lastName: string;
                failedAttempts: string;
                lastFailedTest: string;
            }>();

        return {
            summary: {
                totalResults,
                passedCount,
                failedCount,
                passRate: Math.round(passRate * 100) / 100,
                averageScore:
                    Math.round(Number(aggregateRow?.averageScore || 0) * 100) /
                    100,
                averagePercentage:
                    Math.round(
                        Number(aggregateRow?.averagePercentage || 0) * 100,
                    ) / 100,
                uniqueEmployees: Number(aggregateRow?.uniqueEmployees || 0),
                activeTests: Number(aggregateRow?.activeTests || 0),
                recentResults,
            },
            results,
            total,
            page,
            limit,
            testPerformance: testPerformanceRows.map(row => {
                const attempts = Number(row.totalAttempts) || 0;
                const passed = Number(row.passedCount) || 0;
                return {
                    testId: Number(row.testId),
                    testTitle: row.testTitle || `Test #${row.testId}`,
                    totalAttempts: attempts,
                    averageScore:
                        Math.round(Number(row.averageScore || 0) * 100) / 100,
                    passRate:
                        attempts > 0
                            ? Math.round((passed / attempts) * 10000) / 100
                            : 0,
                };
            }),
            topPerformers,
            needsAttention: needsAttentionRows.map(row => ({
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                failedAttempts: Number(row.failedAttempts) || 0,
                lastFailedTest: row.lastFailedTest || 'Unknown test',
            })),
        };
    }

    /** Enriches top performer rows with branch, training hours, XP, and milestones. */
    private async enrichTopPerformers(
        rows: Array<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            averageScore: string;
            totalTests: string;
            testsPassed: string;
        }>,
        scope: OrgBranchScope,
    ): Promise<AdminResultsDashboardDto['topPerformers']> {
        return Promise.all(
            rows.map(async row => {
                const averageScore =
                    Math.round(Number(row.averageScore || 0) * 100) / 100;
                const testsPassed = Number(row.testsPassed) || 0;
                const totalTests = Number(row.totalTests) || 0;

                let totalTrainingHours = 0;
                let xpPoints = 0;
                let level = 1;
                let rank = 'ROOKIE';

                if (scope.orgId) {
                    try {
                        const hoursSummary =
                            await this.trainingHoursService.getUserSummary(
                                row.userId,
                                scope.orgId,
                                scope.branchId,
                            );
                        totalTrainingHours = hoursSummary.totalHours;
                    } catch (hoursError) {
                        this.logger.warn(
                            `Top performer training hours lookup failed for ${row.userId}`,
                            hoursError instanceof Error
                                ? hoursError.message
                                : String(hoursError),
                        );
                    }

                    try {
                        const rewardsStats =
                            await this.rewardsService.getUserStats(
                                row.userId,
                                scope,
                            );
                        if (rewardsStats) {
                            xpPoints = rewardsStats.totalXP;
                            level = rewardsStats.level;
                            rank = rewardsStats.rank;
                        }
                    } catch (rewardsError) {
                        this.logger.warn(
                            `Top performer rewards lookup failed for ${row.userId}`,
                            rewardsError instanceof Error
                                ? rewardsError.message
                                : String(rewardsError),
                        );
                    }
                }

                return {
                    userId: row.userId,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    averageScore,
                    testsPassed,
                    totalTests,
                    branchName: row.branchName || 'Unassigned',
                    totalTrainingHours,
                    xpPoints,
                    level,
                    rank,
                    milestones: this.buildPerformerMilestones(
                        testsPassed,
                        totalTests,
                        averageScore,
                    ),
                };
            }),
        );
    }

    /** Derives display milestones for a top performer from test stats. */
    private buildPerformerMilestones(
        testsPassed: number,
        totalTests: number,
        averageScore: number,
    ): string[] {
        const milestones: string[] = [];

        if (totalTests >= 1) {
            milestones.push('First Test Completed');
        }
        if (totalTests >= 5) {
            milestones.push('5 Tests Completed');
        }
        if (totalTests >= 10) {
            milestones.push('10 Tests Completed');
        }
        if (testsPassed >= 5) {
            milestones.push('5 Tests Passed');
        }
        if (averageScore >= 100) {
            milestones.push('Perfect Score');
        }

        return milestones;
    }

    /**
     * Per-employee analytics for the admin Employee Analytics tab.
     * Supports filtering by person and by month within a calendar year.
     */
    async getAdminEmployeeMetrics(
        scope: OrgBranchScope,
        filterDto: AdminEmployeeMetricsFilterDto,
    ): Promise<AdminEmployeeMetricsDto> {
        this.assertAdminAccess(scope);

        const year = filterDto.year ?? new Date().getFullYear();
        const { month } = filterDto;
        const includeVoided = filterDto.includeVoided === true;

        const employeeRows = await this.applyAdminScopeFilters(
            this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.user', 'user')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId'),
            scope,
            includeVoided,
        )
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('COUNT(result.resultId)', 'totalResults')
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .orderBy('user.firstName', 'ASC')
            .getRawMany<{
                userId: string;
                firstName: string;
                lastName: string;
                totalResults: string;
            }>();

        const employees = employeeRows.map(row => ({
            userId: row.userId,
            firstName: row.firstName,
            lastName: row.lastName,
            totalResults: Number(row.totalResults) || 0,
        }));

        const selectedUserId =
            filterDto.userId ?? employees[0]?.userId ?? undefined;

        const emptyResponse: AdminEmployeeMetricsDto = {
            year,
            month,
            selectedUserId,
            employees,
            summary: {
                totalTests: 0,
                testsPassed: 0,
                testsFailed: 0,
                passRate: 0,
                averageScore: 0,
                coursesAttempted: 0,
                coursesPassed: 0,
                totalTrainingHours: 0,
                monthlyTrainingHours: 0,
            },
            monthlyTrend: ResultsService.MONTH_LABELS.map((label, index) => ({
                month: index + 1,
                monthLabel: label,
                testsPassed: 0,
                testsFailed: 0,
                passRate: 0,
                averageScore: 0,
                trainingHours: 0,
            })),
            courseTrends: [],
            courseSummaries: [],
            orgComparison: ResultsService.MONTH_LABELS.map((label, index) => ({
                month: index + 1,
                monthLabel: label,
                orgPassRate: 0,
                orgAverageScore: 0,
            })),
        };

        if (!selectedUserId) {
            return emptyResponse;
        }

        const buildScopedUserQuery = (): SelectQueryBuilder<Result> => {
            let query = this.applyAdminScopeFilters(
                this.resultRepository
                    .createQueryBuilder('result')
                    .leftJoin('result.orgId', 'orgId')
                    .leftJoin('result.branchId', 'branchId'),
                scope,
                includeVoided,
            )
                .andWhere('result.userId = :selectedUserId', {
                    selectedUserId,
                })
                .andWhere('YEAR(result.calculatedAt) = :year', { year });

            if (month) {
                query = query.andWhere(
                    'MONTH(result.calculatedAt) = :month',
                    { month },
                );
            }

            return query;
        };

        const summaryRow = await buildScopedUserQuery()
            .select('COUNT(result.resultId)', 'totalTests')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'testsPassed',
            )
            .addSelect(
                'SUM(CASE WHEN result.passed = false THEN 1 ELSE 0 END)',
                'testsFailed',
            )
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(DISTINCT result.courseId)', 'coursesAttempted')
            .addSelect(
                'COUNT(DISTINCT CASE WHEN result.passed = true THEN result.courseId END)',
                'coursesPassed',
            )
            .getRawOne<{
                totalTests: string;
                testsPassed: string;
                testsFailed: string;
                averageScore: string;
                coursesAttempted: string;
                coursesPassed: string;
            }>();

        const totalTests = Number(summaryRow?.totalTests) || 0;
        const testsPassed = Number(summaryRow?.testsPassed) || 0;
        const testsFailed = Number(summaryRow?.testsFailed) || 0;

        const monthlyRows = await buildScopedUserQuery()
            .select('MONTH(result.calculatedAt)', 'month')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'testsPassed',
            )
            .addSelect(
                'SUM(CASE WHEN result.passed = false THEN 1 ELSE 0 END)',
                'testsFailed',
            )
            .addSelect('AVG(result.percentage)', 'averageScore')
            .groupBy('MONTH(result.calculatedAt)')
            .orderBy('month', 'ASC')
            .getRawMany<{
                month: string;
                testsPassed: string;
                testsFailed: string;
                averageScore: string;
            }>();

        const monthlyMap = new Map(
            monthlyRows.map(row => [Number(row.month), row]),
        );

        const monthlyTrend = ResultsService.MONTH_LABELS.map((label, index) => {
            const monthNum = index + 1;
            const row = monthlyMap.get(monthNum);
            const passed = Number(row?.testsPassed) || 0;
            const failed = Number(row?.testsFailed) || 0;
            const attempts = passed + failed;

            return {
                month: monthNum,
                monthLabel: label,
                testsPassed: passed,
                testsFailed: failed,
                passRate:
                    attempts > 0
                        ? Math.round((passed / attempts) * 10000) / 100
                        : 0,
                averageScore:
                    Math.round(Number(row?.averageScore || 0) * 100) / 100,
            };
        }).filter(point => !month || point.month === month);

        const courseMonthRows = await buildScopedUserQuery()
            .leftJoin('result.course', 'course')
            .select('MONTH(result.calculatedAt)', 'month')
            .addSelect('course.courseId', 'courseId')
            .addSelect('course.title', 'courseTitle')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passed',
            )
            .addSelect(
                'SUM(CASE WHEN result.passed = false THEN 1 ELSE 0 END)',
                'failed',
            )
            .groupBy('MONTH(result.calculatedAt)')
            .addGroupBy('course.courseId')
            .addGroupBy('course.title')
            .orderBy('month', 'ASC')
            .getRawMany<{
                month: string;
                courseId: string;
                courseTitle: string;
                passed: string;
                failed: string;
            }>();

        const courseMap = new Map<
            number,
            { courseId: number; courseTitle: string; monthlyData: Map<number, { passed: number; failed: number }> }
        >();

        for (const row of courseMonthRows) {
            const courseId = Number(row.courseId);
            if (!courseMap.has(courseId)) {
                courseMap.set(courseId, {
                    courseId,
                    courseTitle: row.courseTitle || `Course #${courseId}`,
                    monthlyData: new Map(),
                });
            }

            courseMap.get(courseId)?.monthlyData.set(Number(row.month), {
                passed: Number(row.passed) || 0,
                failed: Number(row.failed) || 0,
            });
        }

        const visibleMonths = month
            ? [month]
            : ResultsService.MONTH_LABELS.map((_, index) => index + 1);

        const courseTrends = Array.from(courseMap.values()).map(course => ({
            courseId: course.courseId,
            courseTitle: course.courseTitle,
            monthlyData: visibleMonths.map(monthNum => ({
                month: monthNum,
                monthLabel: ResultsService.MONTH_LABELS[monthNum - 1],
                passed: course.monthlyData.get(monthNum)?.passed ?? 0,
                failed: course.monthlyData.get(monthNum)?.failed ?? 0,
            })),
        }));

        const courseSummaryRows = await buildScopedUserQuery()
            .leftJoin('result.course', 'course')
            .select('course.courseId', 'courseId')
            .addSelect('course.title', 'courseTitle')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passed',
            )
            .addSelect(
                'SUM(CASE WHEN result.passed = false THEN 1 ELSE 0 END)',
                'failed',
            )
            .addSelect('AVG(result.percentage)', 'averageScore')
            .groupBy('course.courseId')
            .addGroupBy('course.title')
            .orderBy('passed', 'DESC')
            .getRawMany<{
                courseId: string;
                courseTitle: string;
                passed: string;
                failed: string;
                averageScore: string;
            }>();

        const courseSummaries = courseSummaryRows.map(row => {
            const passed = Number(row.passed) || 0;
            const failed = Number(row.failed) || 0;
            const attempts = passed + failed;

            return {
                courseId: Number(row.courseId),
                courseTitle: row.courseTitle || `Course #${row.courseId}`,
                passed,
                failed,
                averageScore:
                    Math.round(Number(row.averageScore || 0) * 100) / 100,
                passRate:
                    attempts > 0
                        ? Math.round((passed / attempts) * 10000) / 100
                        : 0,
            };
        });

        let orgQuery = this.applyAdminScopeFilters(
            this.resultRepository
                .createQueryBuilder('result')
                .leftJoin('result.orgId', 'orgId')
                .leftJoin('result.branchId', 'branchId'),
            scope,
            includeVoided,
        )
            .andWhere('YEAR(result.calculatedAt) = :year', { year });

        if (month) {
            orgQuery = orgQuery.andWhere(
                'MONTH(result.calculatedAt) = :month',
                { month },
            );
        }

        const orgMonthlyRows = await orgQuery
            .select('MONTH(result.calculatedAt)', 'month')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passed',
            )
            .addSelect('COUNT(result.resultId)', 'total')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .groupBy('MONTH(result.calculatedAt)')
            .orderBy('month', 'ASC')
            .getRawMany<{
                month: string;
                passed: string;
                total: string;
                averageScore: string;
            }>();

        const orgMap = new Map(
            orgMonthlyRows.map(row => [Number(row.month), row]),
        );

        const orgComparison = ResultsService.MONTH_LABELS.map(
            (label, index) => {
                const monthNum = index + 1;
                const row = orgMap.get(monthNum);
                const passed = Number(row?.passed) || 0;
                const total = Number(row?.total) || 0;

                return {
                    month: monthNum,
                    monthLabel: label,
                    orgPassRate:
                        total > 0
                            ? Math.round((passed / total) * 10000) / 100
                            : 0,
                    orgAverageScore:
                        Math.round(Number(row?.averageScore || 0) * 100) / 100,
                };
            },
        ).filter(point => !month || point.month === month);

        // Training hours for selected employee and org-wide trend
        let totalTrainingHours = 0;
        let monthlyTrainingHours = 0;
        const hoursByMonth = new Map<number, number>();

        if (scope.orgId) {
            try {
                const userHoursSummary =
                    await this.trainingHoursService.getUserSummary(
                        selectedUserId,
                        scope.orgId,
                        scope.branchId,
                    );
                totalTrainingHours = userHoursSummary.totalHours;
                monthlyTrainingHours = userHoursSummary.currentMonthHours;

                const yearStart = `${year}-01`;
                const yearEnd = `${year}-12`;
                const monthlyHours =
                    await this.trainingHoursService.getMonthlyBreakdown(
                        selectedUserId,
                        scope.orgId,
                        yearStart,
                        yearEnd,
                        scope.branchId,
                    );

                for (const bucket of monthlyHours) {
                    const monthNum = Number(bucket.yearMonth.split('-')[1]);
                    hoursByMonth.set(monthNum, bucket.totalHours);
                }
            } catch (hoursError) {
                this.logger.error(
                    `Training hours metrics failed for user ${selectedUserId}`,
                    hoursError instanceof Error
                        ? hoursError.stack
                        : String(hoursError),
                );
            }
        }

        const monthlyTrendWithHours = monthlyTrend.map(point => ({
            ...point,
            trainingHours: hoursByMonth.get(point.month) ?? 0,
        }));

        let orgTrainingHoursTrend:
            | AdminEmployeeMetricsDto['orgTrainingHoursTrend']
            | undefined;

        if (scope.orgId) {
            try {
                const trends =
                    await this.trainingHoursService.getOrgMonthlyTrends(
                        scope.orgId,
                        12,
                        scope.branchId,
                    );
                orgTrainingHoursTrend = trends.map(t => ({
                    yearMonth: t.yearMonth,
                    totalHours: t.totalHours,
                    activeLearners: t.activeLearners,
                }));
            } catch (trendError) {
                this.logger.error(
                    'Org training hours trend failed',
                    trendError instanceof Error
                        ? trendError.stack
                        : String(trendError),
                );
            }
        }

        return {
            year,
            month,
            selectedUserId,
            employees,
            summary: {
                totalTests,
                testsPassed,
                testsFailed,
                passRate:
                    totalTests > 0
                        ? Math.round((testsPassed / totalTests) * 10000) / 100
                        : 0,
                averageScore:
                    Math.round(Number(summaryRow?.averageScore || 0) * 100) /
                    100,
                coursesAttempted: Number(summaryRow?.coursesAttempted) || 0,
                coursesPassed: Number(summaryRow?.coursesPassed) || 0,
                totalTrainingHours,
                monthlyTrainingHours,
            },
            monthlyTrend: monthlyTrendWithHours,
            courseTrends,
            courseSummaries,
            orgComparison,
            orgTrainingHoursTrend,
        };
    }

    /**
     * Employee Performance roster for admins.
     *
     * Builds per-employee pass/fail/in-progress lists and flags scheduled tests
     * the learner never started. "Not attempted" means the test has an
     * `examStartDate` whose window has opened, the learner is in scope for that
     * test, and there is no non-voided attempt with `startTime` on or after the
     * UTC start of `examStartDate`.
     *
     * Aggregation is done in a few bulk queries (users, tests, results,
     * attempts) to avoid N+1 per employee.
     */
    async getAdminEmployeePerformance(
        scope: OrgBranchScope,
        filterDto: AdminEmployeePerformanceFilterDto,
    ): Promise<AdminEmployeePerformanceDto> {
        this.assertAdminAccess(scope);

        const page = filterDto.page ?? 1;
        const limit = filterDto.limit ?? 20;
        const includeVoided = filterDto.includeVoided === true;
        const sortBy =
            filterDto.sortBy ?? AdminEmployeePerformanceSortBy.NOT_ATTEMPTED;
        const sortOrder = filterDto.sortOrder ?? SortOrder.DESC;
        // Prefer explicit filter branch; otherwise fall back to JWT branch scope.
        const branchFilter = filterDto.branchId ?? scope.branchId;

        if (!scope.orgId) {
            return {
                summary: {
                    totalEmployees: 0,
                    employeesWithNotAttempted: 0,
                    totalNotAttemptedAssignments: 0,
                    totalInProgress: 0,
                    averagePassRate: 0,
                    scheduledTests: 0,
                },
                employees: [],
                total: 0,
                page,
                limit,
            };
        }

        const employees = await this.loadScopedLearners(
            scope.orgId,
            branchFilter,
            filterDto.search,
        );

        const tests = await this.loadScopedActiveTests(
            scope.orgId,
            branchFilter,
            filterDto.testId,
            filterDto.examStartFrom,
            filterDto.examStartTo,
        );

        const userIds = employees.map(user => user.id);
        // Pass/fail and in-progress use all attempts/results for these users.
        // Not-attempted matching uses the scoped `tests` list (exam windows).
        const [results, attempts] = await Promise.all([
            this.loadPerformanceResults(userIds, includeVoided, filterDto.testId),
            this.loadPerformanceAttempts(
                userIds,
                includeVoided,
                filterDto.testId,
            ),
        ]);

        const resultsByUser = this.groupByUserId(results);
        const attemptsByUser = this.groupByUserId(attempts);

        const now = new Date();
        const rows: AdminEmployeePerformanceRowDto[] = employees.map(user =>
            this.buildEmployeePerformanceRow(
                user,
                tests,
                resultsByUser.get(user.id) ?? [],
                attemptsByUser.get(user.id) ?? [],
                now,
            ),
        );

        let filteredRows = rows;
        if (filterDto.hasNotAttempted === true) {
            filteredRows = filteredRows.filter(
                row => row.notAttemptedCount > 0,
            );
        }

        // When filtering by a specific test, keep employees who interacted with
        // it or still owe an attempt for it.
        if (filterDto.testId) {
            const targetTestId = filterDto.testId;
            filteredRows = filteredRows.filter(row => {
                const inLists = [
                    ...row.testsPassed,
                    ...row.testsFailed,
                    ...row.testsInProgress,
                    ...row.testsNotAttempted,
                ].some(item => item.testId === targetTestId);
                return inLists;
            });
        }

        filteredRows = this.sortEmployeePerformanceRows(
            filteredRows,
            sortBy,
            sortOrder,
        );

        const totalInProgress = filteredRows.reduce(
            (sum, row) => sum + row.testsInProgress.length,
            0,
        );
        const employeesWithNotAttempted = filteredRows.filter(
            row => row.notAttemptedCount > 0,
        ).length;
        const totalNotAttemptedAssignments = filteredRows.reduce(
            (sum, row) => sum + row.notAttemptedCount,
            0,
        );
        const passRateSum = filteredRows.reduce(
            (sum, row) => sum + row.passRate,
            0,
        );
        const scheduledTests = tests.filter(
            test => toNullableDate(test.examStartDate) !== null,
        ).length;

        const total = filteredRows.length;
        const skip = (page - 1) * limit;
        const pagedEmployees = filteredRows.slice(skip, skip + limit);

        return {
            summary: {
                totalEmployees: total,
                employeesWithNotAttempted,
                totalNotAttemptedAssignments,
                totalInProgress,
                averagePassRate:
                    total > 0
                        ? Math.round((passRateSum / total) * 100) / 100
                        : 0,
                scheduledTests,
            },
            employees: pagedEmployees,
            total,
            page,
            limit,
        };
    }

    /** Active learners in the org (optionally branch + name/email search). */
    private async loadScopedLearners(
        orgId: string,
        branchId?: string,
        search?: string,
    ): Promise<User[]> {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.orgId', 'org')
            .leftJoinAndSelect('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
            .andWhere('user.role = :role', { role: UserRole.USER })
            .orderBy('user.firstName', 'ASC')
            .addOrderBy('user.lastName', 'ASC');

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        const trimmedSearch = search?.trim();
        if (trimmedSearch) {
            query.andWhere(
                `(LOWER(user.firstName) LIKE :search
                  OR LOWER(user.lastName) LIKE :search
                  OR LOWER(user.email) LIKE :search
                  OR LOWER(CONCAT(user.firstName, ' ', user.lastName)) LIKE :search)`,
                { search: `%${trimmedSearch.toLowerCase()}%` },
            );
        }

        return query.getMany();
    }

    /** Active tests visible in the admin scope (org-wide + branch). */
    private async loadScopedActiveTests(
        orgId: string,
        branchId?: string,
        testId?: number,
        examStartFrom?: string,
        examStartTo?: string,
    ): Promise<Test[]> {
        const query = this.testRepository
            .createQueryBuilder('test')
            .leftJoinAndSelect('test.orgId', 'org')
            .leftJoinAndSelect('test.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('test.isActive = :active', { active: true });

        if (branchId) {
            // Branch admins see their branch tests plus org-wide (NULL) tests.
            query.andWhere(
                '(branch.id = :branchId OR test.branchId IS NULL)',
                { branchId },
            );
        }

        if (testId) {
            query.andWhere('test.testId = :testId', { testId });
        }

        if (examStartFrom) {
            query.andWhere('test.examStartDate >= :examStartFrom', {
                examStartFrom: new Date(examStartFrom),
            });
        }

        if (examStartTo) {
            query.andWhere('test.examStartDate <= :examStartTo', {
                examStartTo: new Date(examStartTo),
            });
        }

        return query.getMany();
    }

    private async loadPerformanceResults(
        userIds: string[],
        includeVoided: boolean,
        testId?: number,
    ): Promise<Result[]> {
        if (userIds.length === 0) {
            return [];
        }

        const query = this.resultRepository
            .createQueryBuilder('result')
            .leftJoinAndSelect('result.test', 'test')
            .where('result.userId IN (:...userIds)', { userIds })
            .orderBy('result.calculatedAt', 'DESC');

        if (testId) {
            query.andWhere('result.testId = :testId', { testId });
        }

        if (!includeVoided) {
            query.andWhere('result.voidedByResetId IS NULL');
        }

        return query.getMany();
    }

    private async loadPerformanceAttempts(
        userIds: string[],
        includeVoided: boolean,
        testId?: number,
    ): Promise<TestAttempt[]> {
        if (userIds.length === 0) {
            return [];
        }

        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .leftJoinAndSelect('attempt.test', 'test')
            .where('attempt.userId IN (:...userIds)', { userIds })
            .orderBy('attempt.startTime', 'DESC');

        if (testId) {
            query.andWhere('attempt.testId = :testId', { testId });
        }

        if (!includeVoided) {
            query.andWhere('attempt.voidedByResetId IS NULL');
        }

        return query.getMany();
    }

    private groupByUserId<T extends { userId: string }>(
        items: T[],
    ): Map<string, T[]> {
        const map = new Map<string, T[]>();
        for (const item of items) {
            const existing = map.get(item.userId);
            if (existing) {
                existing.push(item);
            } else {
                map.set(item.userId, [item]);
            }
        }
        return map;
    }

    /**
     * Builds one employee performance row from preloaded results/attempts.
     *
     * Passed/failed use the latest non-voided result per test. Not-attempted
     * only considers tests whose exam window has opened (not pending).
     */
    private buildEmployeePerformanceRow(
        user: User,
        tests: Test[],
        userResults: Result[],
        userAttempts: TestAttempt[],
        now: Date,
    ): AdminEmployeePerformanceRowDto {
        const availableTests = tests.filter(test =>
            this.isTestAvailableToUser(test, user),
        );

        const latestResultByTest = new Map<number, Result>();
        for (const result of userResults) {
            if (!latestResultByTest.has(result.testId)) {
                latestResultByTest.set(result.testId, result);
            }
        }

        const testsPassed: AdminEmployeePerformanceTestRefDto[] = [];
        const testsFailed: AdminEmployeePerformanceTestRefDto[] = [];

        for (const result of latestResultByTest.values()) {
            const ref = this.toResultTestRef(result);
            if (result.passed) {
                testsPassed.push(ref);
            } else {
                testsFailed.push(ref);
            }
        }

        const testsInProgress: AdminEmployeePerformanceTestRefDto[] =
            userAttempts
                .filter(
                    attempt => attempt.status === AttemptStatus.IN_PROGRESS,
                )
                .map(attempt => this.toAttemptTestRef(attempt));

        // Deduplicate in-progress by testId (keep newest — already DESC ordered)
        const seenInProgress = new Set<number>();
        const uniqueInProgress = testsInProgress.filter(item => {
            if (seenInProgress.has(item.testId)) {
                return false;
            }
            seenInProgress.add(item.testId);
            return true;
        });

        const testsNotAttempted: AdminEmployeePerformanceTestRefDto[] = [];
        for (const test of availableTests) {
            const examStart = toNullableDate(test.examStartDate);
            // Unscheduled tests are never "required on a date".
            if (!examStart) {
                continue;
            }
            // Window not opened yet — employee is not late.
            if (isExamWindowPending(test, now)) {
                continue;
            }

            const windowStartBound = new Date(
                Date.UTC(
                    examStart.getUTCFullYear(),
                    examStart.getUTCMonth(),
                    examStart.getUTCDate(),
                ),
            );

            const hasAttemptInWindow = userAttempts.some(
                attempt =>
                    attempt.testId === test.testId &&
                    attempt.startTime >= windowStartBound,
            );

            if (!hasAttemptInWindow) {
                testsNotAttempted.push(this.toScheduledTestRef(test, now));
            }
        }

        const percentages = Array.from(latestResultByTest.values()).map(
            result => Number(result.percentage) || 0,
        );
        const averageScore =
            percentages.length > 0
                ? Math.round(
                      (percentages.reduce((sum, value) => sum + value, 0) /
                          percentages.length) *
                          100,
                  ) / 100
                : 0;

        const gradedCount = testsPassed.length + testsFailed.length;
        const passRate =
            gradedCount > 0
                ? Math.round((testsPassed.length / gradedCount) * 10000) / 100
                : 0;

        const lastResultAt = userResults[0]?.calculatedAt;
        const lastAttemptAt = userAttempts[0]?.startTime;
        let lastActivityAt: string | null = null;
        if (lastResultAt || lastAttemptAt) {
            const resultTime = lastResultAt
                ? new Date(lastResultAt).getTime()
                : 0;
            const attemptTime = lastAttemptAt
                ? new Date(lastAttemptAt).getTime()
                : 0;
            lastActivityAt = new Date(
                Math.max(resultTime, attemptTime),
            ).toISOString();
        }

        return {
            userId: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            branchId: user.branchId?.id ?? null,
            branchName: user.branchId?.name ?? null,
            totalTestsPassed: testsPassed.length,
            totalTestsFailed: testsFailed.length,
            passRate,
            averageScore,
            lastActivityAt,
            testsAvailable: availableTests.length,
            testsCompleted: latestResultByTest.size,
            testsPassed,
            testsFailed,
            testsInProgress: uniqueInProgress,
            testsNotAttempted,
            notAttemptedCount: testsNotAttempted.length,
        };
    }

    /** Org-wide tests (NULL branch) are available to every learner in the org. */
    private isTestAvailableToUser(test: Test, user: User): boolean {
        const testBranchId = test.branchId?.id ?? null;
        if (testBranchId === null) {
            return true;
        }
        return user.branchId?.id === testBranchId;
    }

    private toResultTestRef(result: Result): AdminEmployeePerformanceTestRefDto {
        return {
            testId: result.testId,
            testTitle: result.test?.title ?? `Test #${result.testId}`,
            examStartDate: result.test?.examStartDate
                ? new Date(result.test.examStartDate).toISOString()
                : null,
            examEndDate: result.test?.examEndDate
                ? new Date(result.test.examEndDate).toISOString()
                : null,
            percentage: Math.round(Number(result.percentage || 0) * 100) / 100,
            calculatedAt: result.calculatedAt
                ? new Date(result.calculatedAt).toISOString()
                : undefined,
        };
    }

    private toAttemptTestRef(
        attempt: TestAttempt,
    ): AdminEmployeePerformanceTestRefDto {
        return {
            testId: attempt.testId,
            testTitle: attempt.test?.title ?? `Test #${attempt.testId}`,
            examStartDate: attempt.test?.examStartDate
                ? new Date(attempt.test.examStartDate).toISOString()
                : null,
            examEndDate: attempt.test?.examEndDate
                ? new Date(attempt.test.examEndDate).toISOString()
                : null,
            attemptId: attempt.attemptId,
            startTime: attempt.startTime
                ? new Date(attempt.startTime).toISOString()
                : undefined,
        };
    }

    private toScheduledTestRef(
        test: Test,
        now: Date,
    ): AdminEmployeePerformanceTestRefDto {
        let windowStatus: 'open' | 'closed' | 'pending' = 'open';
        if (isExamWindowPending(test, now)) {
            windowStatus = 'pending';
        } else if (isExamWindowClosed(test, now)) {
            windowStatus = 'closed';
        } else if (!isExamWindowOpen(test, now)) {
            windowStatus = 'closed';
        }

        return {
            testId: test.testId,
            testTitle: test.title,
            examStartDate: test.examStartDate
                ? new Date(test.examStartDate).toISOString()
                : null,
            examEndDate: test.examEndDate
                ? new Date(test.examEndDate).toISOString()
                : null,
            windowStatus,
        };
    }

    private sortEmployeePerformanceRows(
        rows: AdminEmployeePerformanceRowDto[],
        sortBy: AdminEmployeePerformanceSortBy,
        sortOrder: SortOrder,
    ): AdminEmployeePerformanceRowDto[] {
        const direction = sortOrder === SortOrder.ASC ? 1 : -1;

        return [...rows].sort((left, right) => {
            let comparison = 0;

            switch (sortBy) {
                case AdminEmployeePerformanceSortBy.PASS_RATE:
                    comparison = left.passRate - right.passRate;
                    break;
                case AdminEmployeePerformanceSortBy.AVERAGE_SCORE:
                    comparison = left.averageScore - right.averageScore;
                    break;
                case AdminEmployeePerformanceSortBy.NOT_ATTEMPTED:
                    comparison =
                        left.notAttemptedCount - right.notAttemptedCount;
                    break;
                case AdminEmployeePerformanceSortBy.TESTS_PASSED:
                    comparison =
                        left.totalTestsPassed - right.totalTestsPassed;
                    break;
                case AdminEmployeePerformanceSortBy.LAST_ACTIVITY: {
                    const leftTime = left.lastActivityAt
                        ? new Date(left.lastActivityAt).getTime()
                        : 0;
                    const rightTime = right.lastActivityAt
                        ? new Date(right.lastActivityAt).getTime()
                        : 0;
                    comparison = leftTime - rightTime;
                    break;
                }
                case AdminEmployeePerformanceSortBy.NAME:
                default:
                    comparison = `${left.firstName} ${left.lastName}`.localeCompare(
                        `${right.firstName} ${right.lastName}`,
                    );
                    break;
            }

            if (comparison === 0) {
                return `${left.firstName} ${left.lastName}`.localeCompare(
                    `${right.firstName} ${right.lastName}`,
                );
            }

            return comparison * direction;
        });
    }

    async findUserResults(
        userId: string,
        scope: OrgBranchScope,
        filterDto: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
        summary: {
            totalResults: number;
            averageScore: number;
            averagePercentage: number;
            passedCount: number;
            failedCount: number;
            passRate: number;
            highestScore: number;
            lowestScore: number;
        };
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto;
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery(
                { ...filters, userId },
                scope,
            );

            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = await Promise.all(
                results.map(result => this.getEnhancedResult(result))
            );

            const counts = await this.getUserResultCounts(userId, {
                testId: filters.testId,
                scope,
                includeVoided: false,
            });

            return {
                results: responseResults,
                summary: {
                    totalResults: counts.totalResults,
                    averageScore: counts.averageScore,
                    averagePercentage: counts.averageScore,
                    passedCount: counts.passedResults,
                    failedCount: counts.failedResults,
                    passRate: counts.passRate,
                    highestScore: 0,
                    lowestScore: 0,
                },
                total,
                page,
                limit,
            };
        } catch (error) {
            this.logger.error('Failed to fetch user results:', error);
            throw new InternalServerErrorException(
                'Failed to fetch user results',
            );
        }
    }

    async findTestResults(
        testId: number,
        scope: OrgBranchScope,
        userId?: string,
        filterDto?: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto || {};
            
            // Generate cache key for test results
            const filtersKey = JSON.stringify({ ...filters, userId, page, limit });
            const cacheKey = this.CACHE_KEYS.TEST_RESULTS(testId, filtersKey, scope.orgId, scope.branchId);
            
            // Try to get from cache first
            const cachedResults = await this.cacheManager.get<{
                results: ResultResponseDto[];
                total: number;
                page: number;
                limit: number;
            }>(cacheKey);
            
            if (cachedResults) {
                this.logger.debug(`Cache hit for test results: ${cacheKey}`);
                return cachedResults;
            }
            
            this.logger.debug(`Cache miss for test results: ${cacheKey}`);
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery(
                { ...filters, testId },
                scope,
            );

            // If specific user requested, add user filter
            if (userId) {
                queryBuilder.andWhere('result.userId = :userId', { userId });
            }

            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = await Promise.all(
                results.map(result => this.getEnhancedResult(result))
            );

            const response = {
                results: responseResults,
                total,
                page,
                limit,
            };
            
            // Cache the results
            await this.cacheManager.set(cacheKey, response, this.CACHE_TTL.TEST_RESULTS * 1000);
            this.logger.debug(`Cached test results: ${cacheKey}`);

            return response;
        } catch (error) {
            this.logger.error('Failed to fetch test results:', error);
            throw new InternalServerErrorException(
                'Failed to fetch test results',
            );
        }
    }

    async findCourseResults(
        courseId: number,
        scope: OrgBranchScope,
        userId?: string,
        filterDto?: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto || {};
            
            // Generate cache key for course results
            const filtersKey = JSON.stringify({ ...filters, userId, page, limit });
            const cacheKey = this.CACHE_KEYS.COURSE_RESULTS(courseId, filtersKey, scope.orgId, scope.branchId);
            
            // Try to get from cache first
            const cachedResults = await this.cacheManager.get<{
                results: ResultResponseDto[];
                total: number;
                page: number;
                limit: number;
            }>(cacheKey);
            
            if (cachedResults) {
                this.logger.debug(`Cache hit for course results: ${cacheKey}`);
                return cachedResults;
            }
            
            this.logger.debug(`Cache miss for course results: ${cacheKey}`);
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery(
                {
                    ...filters,
                    courseId,
                },
                scope,
            );

            // If specific user requested, add user filter
            if (userId) {
                queryBuilder.andWhere('result.userId = :userId', { userId });
            }

            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = await Promise.all(
                results.map(result => this.getEnhancedResult(result))
            );

            const response = {
                results: responseResults,
                total,
                page,
                limit,
            };
            
            // Cache the results
            await this.cacheManager.set(cacheKey, response, this.CACHE_TTL.COURSE_RESULTS * 1000);
            this.logger.debug(`Cached course results: ${cacheKey}`);

            return response;
        } catch (error) {
            this.logger.error('Failed to fetch course results:', error);
            throw new InternalServerErrorException(
                'Failed to fetch course results',
            );
        }
    }

    async findOne(
        id: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<ResultResponseDto> {
        try {
            // Mirror buildFilterQuery joins — Test has no `creator` relation (only Course does).
            // An invalid `test.creator` join caused TypeORM to throw and surfaced as
            // InternalServerErrorException('Failed to fetch result') on GET /results/:id.
            const queryBuilder = this.resultRepository
                .createQueryBuilder('result')
                .leftJoinAndSelect('result.user', 'user')
                .leftJoinAndSelect('user.avatar', 'userAvatar')
                .leftJoinAndSelect('result.test', 'test')
                .leftJoinAndSelect('result.course', 'course')
                .leftJoinAndSelect('course.creator', 'courseInstructor')
                .leftJoinAndSelect('result.attempt', 'attempt')
                .leftJoinAndSelect('result.orgId', 'orgId')
                .leftJoinAndSelect('result.branchId', 'branchId')
                .where('result.resultId = :id', { id });

            // Apply org/branch scoping
            if (scope.orgId) {
                queryBuilder.andWhere('orgId.id = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                queryBuilder.andWhere('branchId.id = :branchId', {
                    branchId: scope.branchId,
                });
            }

            // Non-elevated callers (learners) must not resolve voided results —
            // report 404 rather than 403 so existence of the old answer key is
            // not confirmed.
            const isElevated =
                !!scope.userRole &&
                [UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN].includes(
                    scope.userRole as UserRole,
                );
            this.applyLiveResultFilter(queryBuilder, isElevated);

            const result = await queryBuilder.getOne();

            if (!result) {
                throw new NotFoundException(`Result with ID ${id} not found`);
            }

            // If userId is provided, check if user can access this result
            if (userId && result.userId !== userId) {
                // Check if user is instructor of the course - this would require additional validation logic
                // For now, we'll allow access within the same org/branch scope
                this.logger.warn(
                    `User ${userId} accessing result ${id} for different user ${result.userId}`,
                );
            }

            return this.getEnhancedResult(result);
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }
            this.logger.error('Failed to fetch result:', error);
            throw new InternalServerErrorException('Failed to fetch result');
        }
    }

    async getTestAnalytics(
        testId: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<ResultAnalyticsDto> {
        try {
            const queryBuilder = this.resultRepository
                .createQueryBuilder('result')
                .leftJoinAndSelect('result.orgId', 'orgId')
                .leftJoinAndSelect('result.branchId', 'branchId')
                .where('result.testId = :testId', { testId });

            // Apply org/branch scoping
            if (scope.orgId) {
                queryBuilder.andWhere('orgId.id = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                queryBuilder.andWhere('branchId.id = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const results = await queryBuilder.getMany();

            if (results.length === 0) {
                return {
                    totalResults: 0,
                    averagePercentage: 0,
                    averageScore: 0,
                    highestPercentage: 0,
                    lowestPercentage: 0,
                    passedCount: 0,
                    failedCount: 0,
                    passRate: 0,
                    scoreDistribution: {},
                    gradeDistribution: {},
                };
            }

            const totalResults = results.length;
            const averagePercentage =
                results.reduce((sum, r) => sum + Number(r.percentage), 0) /
                totalResults;
            const averageScore =
                results.reduce((sum, r) => sum + Number(r.score), 0) /
                totalResults;
            const percentages = results
                .map(r => Number(r.percentage))
                .sort((a, b) => a - b);
            const highestPercentage = percentages[percentages.length - 1];
            const lowestPercentage = percentages[0];
            const passedCount = results.filter(r => r.passed).length;
            const failedCount = totalResults - passedCount;
            const passRate = (passedCount / totalResults) * 100;

            // Score distribution (group by 10% ranges)
            const scoreDistribution: { [key: string]: number } = {};
            results.forEach(result => {
                const percentage = Number(result.percentage);
                const range = Math.floor(percentage / 10) * 10;
                const key = `${range}-${range + 9}%`;
                scoreDistribution[key] = (scoreDistribution[key] || 0) + 1;
            });

            // Grade distribution (A, B, C, D, F)
            const gradeDistribution: { [key: string]: number } = {};
            results.forEach(result => {
                const percentage = Number(result.percentage);
                let grade: string;
                if (percentage >= 90) grade = 'A';
                else if (percentage >= 80) grade = 'B';
                else if (percentage >= 70) grade = 'C';
                else if (percentage >= 60) grade = 'D';
                else grade = 'F';
                gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
            });

            return {
                totalResults,
                averagePercentage: Math.round(averagePercentage * 100) / 100,
                averageScore: Math.round(averageScore * 100) / 100,
                highestPercentage,
                lowestPercentage,
                passedCount,
                failedCount,
                passRate: Math.round(passRate * 100) / 100,
                scoreDistribution,
                gradeDistribution,
            };
        } catch (error) {
            this.logger.error('Failed to get test analytics:', error);
            throw new InternalServerErrorException(
                'Failed to get test analytics',
            );
        }
    }

    async recalculateResult(
        resultId: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<ResultResponseDto> {
        try {
            // First find the result with scoping
            const result = await this.findOne(resultId, scope, userId);

            if (!result) {
                throw new NotFoundException(
                    `Result with ID ${resultId} not found`,
                );
            }

            // Get the attempt to recalculate
            const attempt = await this.testAttemptRepository.findOne({
                where: { attemptId: result.attemptId },
                relations: ['test', 'user'],
            });

            if (!attempt) {
                throw new NotFoundException(
                    'Associated test attempt not found',
                );
            }

            // Recalculate the score
            const { score, maxScore, percentage, totalQuestions, questionsAnswered } =
                await this.calculateScore(result.attemptId);

            // Update the result
            await this.resultRepository.update(resultId, {
                score,
                maxScore,
                percentage,
                // Pass mark raised from 60% to 80% (PASSING_SCORE_PERCENTAGE)
                passed: isPassingPercentage(percentage),
                calculatedAt: new Date(),
            });

            try {
                await this.syncTrainingProgressSnapshotForAttempt(attempt, {
                    percentage,
                    totalQuestions,
                    questionsAnswered,
                });
            } catch (progressError) {
                this.logger.error(
                    `Training progress snapshot failed after recalculating result ${resultId} for attempt ${result.attemptId}`,
                    progressError instanceof Error
                        ? progressError.stack
                        : String(progressError),
                );
            }

            // Return the updated result
            return this.findOne(resultId, scope, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            this.logger.error('Failed to recalculate result:', error);
            throw new InternalServerErrorException(
                'Failed to recalculate result',
            );
        }
    }

    /**
     * Idempotent hook for the client route; requires an existing `results` row for the attempt.
     */
    async syncTrainingProgressForAttemptId(attemptId: number): Promise<void> {
        const resultRow = await this.resultRepository.findOne({
            where: { attemptId },
        });
        if (!resultRow) {
            throw new BadRequestException(
                'No scored result exists for this attempt yet; create a result first.',
            );
        }
        const attemptEntity = await this.testAttemptRepository.findOne({
            where: { attemptId },
            relations: ['test'],
        });
        if (!attemptEntity?.test?.courseId) {
            throw new NotFoundException(
                `Attempt ${attemptId} is missing course context for progress sync`,
            );
        }
        const scoring = await this.calculateScore(attemptId);
        await this.syncTrainingProgressSnapshotForAttempt(attemptEntity, {
            percentage: scoring.percentage,
            totalQuestions: scoring.totalQuestions,
            questionsAnswered: scoring.questionsAnswered,
        });
    }

    private computeAttemptElapsedMinutes(attempt: TestAttempt): number {
        const endTime = attempt.submitTime ?? attempt.updatedAt ?? new Date();
        const elapsedMs = Math.max(
            0,
            new Date(endTime).getTime() -
                new Date(attempt.startTime).getTime(),
        );
        return Math.round(elapsedMs / 60000);
    }

    /**
     * Keeps per-test `training_progress` aligned with the latest scored attempt percentage.
     */
    private async syncTrainingProgressSnapshotForAttempt(
        attempt: TestAttempt,
        scoring: {
            percentage: number;
            totalQuestions: number;
            questionsAnswered: number;
        },
    ): Promise<void> {
        const courseId = attempt.test?.courseId;
        if (!courseId) {
            throw new BadRequestException(
                'Cannot sync training progress without a course on the test',
            );
        }
        const timeSpentMinutes = this.computeAttemptElapsedMinutes(attempt);
        await this.trainingProgressService.upsertPerTestSnapshotFromScoredResult(
            {
                userId: attempt.userId,
                courseId,
                testId: attempt.testId,
                completionPercentage:
                    Math.round(scoring.percentage * 100) / 100,
                timeSpentMinutes,
                questionsCompleted: scoring.questionsAnswered,
                totalQuestions: scoring.totalQuestions,
            },
        );
    }

    /**
     * Score from answers + question points only. Do not reload the attempt with
     * org/branch relations — that SELECT joined whiteLabelingConfig and timed
     * out (read ETIMEDOUT) during submit of attempt 668.
     */
    private async calculateScore(
        attemptId: number,
        testId?: number,
    ): Promise<{
        score: number;
        maxScore: number;
        percentage: number;
        totalQuestions: number;
        questionsAnswered: number;
    }> {
        this.logger.debug(
            `Starting score calculation for attempt ${attemptId}`,
        );

        let resolvedTestId = testId;
        if (!resolvedTestId) {
            const attemptRow = await this.testAttemptRepository.findOne({
                where: { attemptId },
                select: ['attemptId', 'testId'],
            });
            if (!attemptRow) {
                throw new NotFoundException(`Attempt ${attemptId} not found`);
            }
            resolvedTestId = attemptRow.testId;
        }

        const [answers, questions] = await Promise.all([
            this.answerRepository.find({
                where: { attemptId },
                select: ['answerId', 'questionId', 'pointsAwarded'],
            }),
            this.questionRepository.find({
                where: { testId: resolvedTestId },
                select: ['questionId', 'points'],
            }),
        ]);

        this.logger.debug(
            `Found ${answers.length} answers and ${questions.length} questions for attempt ${attemptId}`,
        );

        const pointsByQuestionId = new Map(
            answers.map(answer => [
                answer.questionId,
                Number(answer.pointsAwarded) || 0,
            ]),
        );

        let totalScore = 0;
        let maxScore = 0;

        for (const question of questions) {
            const questionPoints = Number(question.points) || 0;
            maxScore += questionPoints;
            totalScore += pointsByQuestionId.get(question.questionId) ?? 0;
        }

        let percentage = 0;
        if (maxScore > 0) {
            percentage = Math.round((totalScore / maxScore) * 10000) / 100;
        }

        this.logger.debug(
            `Score calculation completed for attempt ${attemptId}:`,
            {
                totalScore,
                maxScore,
                percentage,
                questionsProcessed: questions.length,
                answersFound: answers.length,
            },
        );

        return {
            score: totalScore,
            maxScore,
            percentage,
            totalQuestions: questions.length,
            questionsAnswered: answers.length,
        };
    }

    private buildFilterQuery(
        filters: Partial<ResultFilterDto>,
        scope: OrgBranchScope,
        includeVoided = false,
    ): SelectQueryBuilder<Result> {
        const queryBuilder = this.resultRepository
            .createQueryBuilder('result')
            // User relations with comprehensive data
            .leftJoinAndSelect('result.user', 'user')
            .leftJoinAndSelect('user.avatar', 'userAvatar')
            .leftJoinAndSelect('user.orgId', 'userOrg')
            .leftJoinAndSelect('user.branchId', 'userBranch')
            // Test relations with comprehensive data
            .leftJoinAndSelect('result.test', 'test')
            // Course relations with comprehensive data (course has creator, not test)
            .leftJoinAndSelect('result.course', 'course')
            .leftJoinAndSelect('course.creator', 'courseInstructor')
            .leftJoinAndSelect('courseInstructor.avatar', 'courseInstructorAvatar')
            // Attempt relations with comprehensive data
            .leftJoinAndSelect('result.attempt', 'attempt')
            // Organization and branch relations
            .leftJoinAndSelect('result.orgId', 'orgId')
            .leftJoinAndSelect('result.branchId', 'branchId');

        // Apply org/branch scoping first
        if (scope.orgId) {
            queryBuilder.andWhere('orgId.id = :orgId', { orgId: scope.orgId });
        }
        if (scope.branchId) {
            queryBuilder.andWhere('branchId.id = :branchId', {
                branchId: scope.branchId,
            });
        }

        // Learners must never receive results voided by an admin attempt reset
        // (they contain the full answer key for the upcoming retake).
        this.applyLiveResultFilter(queryBuilder, includeVoided);

        // Apply user-provided filters
        if (filters.userId) {
            queryBuilder.andWhere('result.userId = :userId', {
                userId: filters.userId,
            });
        }

        if (filters.testId) {
            queryBuilder.andWhere('result.testId = :testId', {
                testId: filters.testId,
            });
        }

        if (filters.courseId) {
            queryBuilder.andWhere('result.courseId = :courseId', {
                courseId: filters.courseId,
            });
        }

        if (filters.passed !== undefined) {
            queryBuilder.andWhere('result.passed = :passed', {
                passed: filters.passed,
            });
        }

        if (filters.minPercentage !== undefined) {
            queryBuilder.andWhere('result.percentage >= :minPercentage', {
                minPercentage: filters.minPercentage,
            });
        }

        if (filters.maxPercentage !== undefined) {
            queryBuilder.andWhere('result.percentage <= :maxPercentage', {
                maxPercentage: filters.maxPercentage,
            });
        }

        if (filters.startDate) {
            queryBuilder.andWhere('result.calculatedAt >= :startDate', {
                startDate: filters.startDate,
            });
        }

        if (filters.endDate) {
            queryBuilder.andWhere('result.calculatedAt <= :endDate', {
                endDate: filters.endDate,
            });
        }

        // Sorting
        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder || 'DESC';
        queryBuilder.orderBy(`result.${sortBy}`, sortOrder);

        return queryBuilder;
    }

    /**
     * Phase 1: Validate prerequisites for leaderboard update
     */
    private validateLeaderboardPrerequisites(
        attempt: TestAttempt,
        result: Result,
        scope: { orgId?: any; branchId?: any },
    ): {
        isValid: boolean;
        isCritical: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Critical validations
        if (!attempt.userId) {
            errors.push('User ID is missing from attempt');
        }
        if (!attempt.test?.courseId) {
            errors.push('Course ID is missing from test');
        }
        if (!result.resultId) {
            errors.push('Result ID is missing');
        }
        if (!scope.orgId) {
            errors.push('Organization data is missing');
        }

        // Non-critical validations (warnings)
        if (!attempt.test?.title) {
            warnings.push('Test title is missing');
        }
        if (!scope.branchId) {
            warnings.push('Branch data is missing');
        }
        if (result.score === null || result.score === undefined) {
            warnings.push('Result score is null/undefined');
        }
        if (result.percentage === null || result.percentage === undefined) {
            warnings.push('Result percentage is null/undefined');
        }

        const isCritical = errors.length > 0;
        const isValid = errors.length === 0;

        return {
            isValid,
            isCritical,
            errors,
            warnings,
        };
    }

    /**
     * Phase 3: Verify data flow integrity before leaderboard call
     */
    private async verifyDataFlowIntegrity(
        resultId: number,
        userId: string,
        courseId: number,
        scope: { orgId?: any; branchId?: any },
    ): Promise<{
        isValid: boolean;
        errors: string[];
        resultExists: boolean;
        userHasResults: boolean;
        courseExists: boolean;
    }> {
        const errors: string[] = [];
        let resultExists = false;
        let userHasResults = false;
        let courseExists = false;

        try {
            // Verify result exists in database
            const resultCheck = await this.resultRepository.findOne({
                where: { resultId },
                relations: ['orgId', 'branchId'],
            });
            resultExists = !!resultCheck;

            if (!resultExists) {
                errors.push(`Result ${resultId} not found in database`);
            } else {
                // Verify org/branch consistency
                const resultOrgId = resultCheck?.orgId?.id;
                const resultBranchId = resultCheck?.branchId?.id;
                const expectedOrgId = scope.orgId?.id;
                const expectedBranchId = scope.branchId?.id;

                if (expectedOrgId && resultOrgId !== expectedOrgId) {
                    errors.push(
                        `Result org mismatch: expected ${expectedOrgId}, found ${resultOrgId}`,
                    );
                }
                if (expectedBranchId && resultBranchId !== expectedBranchId) {
                    errors.push(
                        `Result branch mismatch: expected ${expectedBranchId}, found ${resultBranchId}`,
                    );
                }
            }

            // Verify user has results for this course
            const userResultsCount = await this.resultRepository.count({
                where: {
                    userId,
                    courseId,
                },
            });
            userHasResults = userResultsCount > 0;

            if (!userHasResults) {
                errors.push(
                    `No results found for user ${userId} in course ${courseId}`,
                );
            }

            // Check if course exists (via a result that references it)
            const courseResultsCount = await this.resultRepository.count({
                where: { courseId },
            });
            courseExists = courseResultsCount > 0;

            if (!courseExists) {
                errors.push(`No results found for course ${courseId}`);
            }
        } catch (error) {
            errors.push(
                `Data integrity check failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return {
            isValid: errors.length === 0,
            errors,
            resultExists,
            userHasResults,
            courseExists,
        };
    }

    /**
     * Phase 3: Verify leaderboard was updated successfully
     */
    private async verifyLeaderboardUpdate(
        userId: string,
        courseId: number,
        result: Result,
    ): Promise<{
        isValid: boolean;
        errors: string[];
        leaderboardExists: boolean;
        scoreMatches: boolean;
        rankAssigned: boolean;
    }> {
        const errors: string[] = [];
        let leaderboardExists = false;
        let scoreMatches = false;
        let rankAssigned = false;

        try {
            // Check if leaderboard entry exists
            const leaderboardEntry = await this.leaderboardService.getUserRank(
                courseId,
                userId,
            );

            leaderboardExists = !!leaderboardEntry;

            if (!leaderboardExists) {
                errors.push(
                    `Leaderboard entry not found for user ${userId} in course ${courseId}`,
                );
            } else {
                // Verify score consistency
                const leaderboardTotalPoints =
                    leaderboardEntry?.totalPoints || 0;
                const resultScore = Number(result.score) || 0;

                // Note: leaderboard total points might be sum of multiple results,
                // so we check if this result's score contributes to the total
                if (leaderboardTotalPoints < resultScore) {
                    errors.push(
                        `Leaderboard total points (${leaderboardTotalPoints}) less than single result score (${resultScore})`,
                    );
                } else {
                    scoreMatches = true;
                }

                // Verify rank is assigned
                rankAssigned = (leaderboardEntry?.rank || 0) > 0;
                if (!rankAssigned) {
                    errors.push(
                        `Invalid rank assigned: ${leaderboardEntry?.rank || 'undefined'}`,
                    );
                }
            }
        } catch (error) {
            errors.push(
                `Leaderboard verification failed: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return {
            isValid: errors.length === 0,
            errors,
            leaderboardExists,
            scoreMatches,
            rankAssigned,
        };
    }

    /**
     * Phase 2: Diagnose leaderboard update failures
     */
    private async diagnoseLeaderboardFailure(
        userId: string,
        courseId: number,
        error: any,
        scope: { orgId?: any; branchId?: any },
    ): Promise<void> {
        this.logger.error(`=== LEADERBOARD FAILURE DIAGNOSIS ===`);

        try {
            // Check if leaderboard service is accessible
            this.logger.debug(`Diagnosing leaderboard failure for:`, {
                userId,
                courseId,
                orgId: scope.orgId?.id,
                branchId: scope.branchId?.id,
            });

            // Test 1: Can we query existing leaderboard?
            try {
                const existingLeaderboard =
                    await this.leaderboardService.getCourseLeaderboard(
                        courseId,
                        1,
                        1,
                    );
                this.logger.debug(`Existing leaderboard query successful:`, {
                    totalEntries: existingLeaderboard.total,
                    hasEntries: existingLeaderboard.leaderboard.length > 0,
                });
            } catch (leaderboardQueryError) {
                this.logger.error(
                    `Cannot query existing leaderboard:`,
                    leaderboardQueryError,
                );
            }

            // Test 2: Check if user has other results
            const userResultsCount = await this.resultRepository.count({
                where: { userId },
            });
            this.logger.debug(`User has ${userResultsCount} total results`);

            // Test 3: Check if course has other results
            const courseResultsCount = await this.resultRepository.count({
                where: { courseId },
            });
            this.logger.debug(`Course has ${courseResultsCount} total results`);

            // Test 4: Check org/branch consistency
            const resultWithOrgBranch = await this.resultRepository.findOne({
                where: { userId, courseId },
                relations: ['orgId', 'branchId'],
                order: { createdAt: 'DESC' },
            });

            if (resultWithOrgBranch) {
                this.logger.debug(`Latest result org/branch data:`, {
                    resultOrgId: resultWithOrgBranch.orgId?.id,
                    resultBranchId: resultWithOrgBranch.branchId?.id,
                    expectedOrgId: scope.orgId?.id,
                    expectedBranchId: scope.branchId?.id,
                });
            }

            // Error categorization
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            let errorCategory = 'Unknown';

            if (
                errorMessage.includes('organization') ||
                errorMessage.includes('org')
            ) {
                errorCategory = 'Organization Data Issue';
            } else if (
                errorMessage.includes('constraint') ||
                errorMessage.includes('foreign key')
            ) {
                errorCategory = 'Database Constraint Violation';
            } else if (
                errorMessage.includes('null') ||
                errorMessage.includes('undefined')
            ) {
                errorCategory = 'Null/Undefined Data';
            } else if (errorMessage.includes('timeout')) {
                errorCategory = 'Database Timeout';
            } else if (errorMessage.includes('connection')) {
                errorCategory = 'Database Connection Issue';
            }

            this.logger.error(`Failure category: ${errorCategory}`);
            this.logger.error(`Raw error analysis:`, {
                errorType: error?.constructor?.name,
                hasStack: !!(error instanceof Error && error.stack),
                messageLength: errorMessage.length,
                errorCategory,
            });
        } catch (diagnosisError) {
            this.logger.error(
                `Diagnosis itself failed:`,
                diagnosisError instanceof Error
                    ? diagnosisError.message
                    : String(diagnosisError),
            );
        }
    }

    private async sendResultsSummaryEmail(
        result: Result,
        attempt: TestAttempt,
    ): Promise<void> {
        try {
            // Get user information
            if (!attempt.user) {
                this.logger.warn(
                    `User information not available for result ${result.resultId}`,
                );
                return;
            }

            // Calculate completion time (if available)
            let completionTime = 'Not available';
            if (attempt.startTime && attempt.submitTime) {
                const durationMs =
                    new Date(attempt.submitTime).getTime() -
                    new Date(attempt.startTime).getTime();
                const durationMinutes = Math.round(durationMs / (1000 * 60));
                completionTime = `${durationMinutes} minutes`;
            }

            // Get question count with proper scoping
            const questionQuery = this.questionRepository
                .createQueryBuilder('question')
                .where('question.testId = :testId', { testId: attempt.testId });

            // Org-wide questions (NULL branchId) must remain visible to branch learners.
            if (attempt.orgId) {
                questionQuery.andWhere('question.orgId = :orgId', {
                    orgId: attempt.orgId.id,
                });
            }
            applyBranchVisibilityToQuery(
                questionQuery,
                'question',
                attempt.branchId?.id,
                'emailQ',
            );

            const questionCount = await questionQuery.getCount();

            // Get answers with proper scoping
            const answersQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoinAndSelect('answer.question', 'question')
                .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
                .where('answer.attemptId = :attemptId', {
                    attemptId: attempt.attemptId,
                });

            // Apply org/branch scoping to answers
            if (attempt.orgId) {
                answersQuery.andWhere('answer.orgId = :orgId', {
                    orgId: attempt.orgId.id,
                });
            }
            if (attempt.branchId) {
                answersQuery.andWhere('answer.branchId = :branchId', {
                    branchId: attempt.branchId.id,
                });
            }

            const allAnswers = await answersQuery.getMany();

            // Calculate correct answers count properly - matching the main calculation logic
            let correctAnswersCount = 0;
            for (const answer of allAnswers) {
                let isCorrect = false;
                
                // Check if answer has been marked with points (including 0 points)
                if (
                    answer.pointsAwarded !== null &&
                    answer.pointsAwarded !== undefined
                ) {
                    // Count as correct if points awarded > 0
                    isCorrect = Number(answer.pointsAwarded) > 0;
                } else if (answer.selectedOption && answer.question) {
                    // For auto-marked questions, check if the selected option is correct
                    isCorrect = answer.selectedOption.isCorrect;
                }
                
                if (isCorrect) {
                    correctAnswersCount++;
                }
            }

            this.logger.debug(
                `Email data calculation for result ${result.resultId}:`,
                {
                    questionCount,
                    totalAnswers: allAnswers.length,
                    correctAnswersCount,
                    resultScore: result.score,
                    resultMaxScore: result.maxScore,
                    resultPercentage: result.percentage,
                    calculatedPercentage: questionCount > 0 ? Math.round((correctAnswersCount / questionCount) * 100) : 0,
                },
            );

            // Prepare template data with proper data types and fallbacks
            const calculatedPercentage =
                questionCount > 0
                    ? Math.round((correctAnswersCount / questionCount) * 100)
                    : 0;
            const storedPercentage = Number(result.percentage);
            const percentage = Number.isFinite(storedPercentage)
                ? Math.round(storedPercentage)
                : calculatedPercentage;

            const templateData = {
                recipientName:
                    `${attempt.user.firstName || ''} ${attempt.user.lastName || ''}`.trim() ||
                    'Student',
                recipientEmail: attempt.user.email || '',
                testTitle: attempt.test?.title || 'Test',
                score: Number(result.score) || 0,
                maxScore: Number(result.maxScore) || questionCount,
                totalQuestions: questionCount || 1,
                correctAnswers: correctAnswersCount || 0,
                percentage,
                completionTime: completionTime || 'Not available',
                resultsUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/results/${result.resultId}`,
                organizationId: attempt.orgId?.id || result.orgId?.id,
                // Additional data for better display
                scoreDisplay: `${Number(result.score) || 0}/${Number(result.maxScore) || questionCount}`,
                // Pass mark raised from 60% to 80%; drives Passed/Failed copy in results-summary emails
                isPassed: isPassingPercentage(percentage),
                passingScore: PASSING_SCORE_PERCENTAGE,
            };

            this.logger.debug(
                `Sending email with template data:`,
                templateData,
            );

            await this.communicationsService.sendResultsSummaryEmail(
                templateData,
            );

            this.logger.log(
                `Results summary email queued for user ${attempt.user.email} (Result ID: ${result.resultId})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send results summary email for result ${result.resultId}:`,
                error instanceof Error ? error.stack : String(error),
            );
            throw error;
        }
    }

    /**
     * Enhanced method to get comprehensive result with all relations and calculated metrics
     */
    private async getEnhancedResult(result: Result): Promise<ResultResponseDto> {
        // Calculate performance metrics
        const performanceMetrics = await this.calculatePerformanceMetrics(result);
        
        // Get question breakdown if needed
        const questionBreakdown = await this.getQuestionBreakdown(result.attemptId, result.orgId?.id, result.branchId?.id);
        
        // Calculate class rankings
        const rankings = await this.calculateClassRankings(result);
        
        // Get additional test/course statistics
        const additionalStats = await this.getAdditionalStatistics(result);

        // Transform the result with comprehensive data
        const enhancedResult = plainToClass(ResultResponseDto, {
            ...result,
            // Enhanced user data - return null if user relation is null
            user: result.user ? {
                id: result.user.id,
                username: result.user.email?.split('@')[0] || 'unknown',
                firstName: result.user.firstName,
                lastName: result.user.lastName,
                email: result.user.email,
                role: result.user.role,
                status: result.user.status || 'active',
                profilePicture: result.user.avatar?.url || null,
                phoneNumber: null, // User entity doesn't have phoneNumber
                createdAt: result.user.createdAt,
            } : null,
            // Enhanced test data - return null if test relation is null
            test: result.test ? {
                testId: result.test.testId,
                title: result.test.title,
                description: result.test.description,
                testType: result.test.testType,
                durationMinutes: result.test.durationMinutes,
                maxAttempts: result.test.maxAttempts || 1,
                // Pass mark raised from 60% to 80%; Test entity has no per-test override
                passingScore: PASSING_SCORE_PERCENTAGE,
                totalQuestions: additionalStats.totalQuestions,
                totalPoints: result.maxScore,
                status: result.test.isActive ? 'active' : 'inactive',
                createdAt: result.test.createdAt,
                instructions: result.test.description || '',
                testThumbnail: result.test.testThumbnail ?? null,
                instructor: null, // Test entity doesn't have creator relation
            } : null,
            // Enhanced course data - return null if course relation is null
            course: result.course ? {
                courseId: result.course.courseId,
                title: result.course.title,
                description: result.course.description,
                courseCode: `COURSE-${result.course.courseId}`,
                category: 'General',
                durationHours: 40,
                difficultyLevel: 'intermediate',
                status: result.course.status || 'active',
                thumbnailUrl: null,
                enrolledStudents: additionalStats.enrolledStudents,
                createdAt: result.course.createdAt,
                instructor: result.course.creator ? {
                    id: result.course.creator.id,
                    email: result.course.creator.email,
                    firstName: result.course.creator.firstName,
                    lastName: result.course.creator.lastName,
                    username: result.course.creator.email?.split('@')[0] || 'unknown',
                } : null,
            } : null,
            // Enhanced attempt data - return null if attempt relation is null
            attempt: result.attempt ? {
                attemptId: result.attempt.attemptId,
                attemptNumber: result.attempt.attemptNumber || 1,
                startTime: result.attempt.startTime,
                submitTime: result.attempt.submitTime,
                status: result.attempt.status,
                questionsAnswered: additionalStats.questionsAnswered,
                totalQuestions: additionalStats.totalQuestions,
                // timeSpentMinutes and completionPercentage calculated by Transform decorators
            } : null,
            // Performance metrics
            performanceMetrics,
            // Question breakdown (optional)
            questionBreakdown: questionBreakdown.length > 0 ? questionBreakdown : undefined,
            // Rankings
            classRank: rankings.classRank,
            totalStudents: rankings.totalStudents,
            percentileRank: rankings.percentileRank,
        }, {
            excludeExtraneousValues: true,
        });

        return enhancedResult;
    }

    /**
     * Calculate comprehensive performance metrics
     */
    private async calculatePerformanceMetrics(result: Result): Promise<any> {
        // Get answers for this attempt with proper scoping
        const answersQuery = this.answerRepository
            .createQueryBuilder('answer')
            .leftJoinAndSelect('answer.question', 'question')
            .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
            .where('answer.attemptId = :attemptId', { attemptId: result.attemptId });

        // Apply org/branch scoping
        if (result.orgId) {
            answersQuery.andWhere('answer.orgId = :orgId', { orgId: result.orgId.id });
        }
        if (result.branchId) {
            answersQuery.andWhere('answer.branchId = :branchId', { branchId: result.branchId.id });
        }

        const answers = await answersQuery.getMany();
        
        // Get all questions for the test (include org-wide NULL branchId)
        const questionsQuery = this.questionRepository
            .createQueryBuilder('question')
            .where('question.testId = :testId', { testId: result.testId });

        if (result.orgId) {
            questionsQuery.andWhere('question.orgId = :orgId', { orgId: result.orgId.id });
        }
        applyBranchVisibilityToQuery(
            questionsQuery,
            'question',
            result.branchId?.id,
            'perfMetrics',
        );

        const questions = await questionsQuery.getMany();

        // Calculate metrics
        const totalQuestions = questions.length;
        const answeredQuestions = answers.length;
        let correctAnswers = 0;

        for (const answer of answers) {
            // Check if correct
            const pointsAwarded = answer.pointsAwarded ?? 0;
            if (pointsAwarded > 0) {
                correctAnswers++;
            } else if (answer.selectedOption?.isCorrect) {
                correctAnswers++;
            }
        }

        const incorrectAnswers = Math.max(0, answeredQuestions - correctAnswers);
        const unansweredQuestions = Math.max(0, totalQuestions - answeredQuestions);
        const accuracy =
            totalQuestions > 0
                ? (correctAnswers / totalQuestions) * 100
                : answeredQuestions > 0
                  ? (correctAnswers / answeredQuestions) * 100
                  : 0;
        const avgTimePerQuestion = 0; // Time tracking not available in current Answer entity
        
        // Calculate difficulty rating based on class performance (1-5 scale)
        const classAvgPercentage = await this.getClassAveragePercentage(result.testId, result.orgId?.id, result.branchId?.id);
        let difficultyRating = 3; // default medium
        if (classAvgPercentage < 50) difficultyRating = 5; // very hard
        else if (classAvgPercentage < 65) difficultyRating = 4; // hard
        else if (classAvgPercentage < 80) difficultyRating = 3; // medium
        else if (classAvgPercentage < 90) difficultyRating = 2; // easy
        else difficultyRating = 1; // very easy

        return {
            avgTimePerQuestion: Math.round(avgTimePerQuestion * 100) / 100,
            accuracy: Math.round(accuracy * 100) / 100,
            difficultyRating,
            correctAnswers,
            incorrectAnswers,
            unansweredQuestions,
        };
    }

    /**
     * Get detailed question breakdown for reports
     */
    private async getQuestionBreakdown(attemptId: number, orgId?: string, branchId?: string): Promise<any[]> {
        const answersQuery = this.answerRepository
            .createQueryBuilder('answer')
            .leftJoinAndSelect('answer.question', 'question')
            .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
            .leftJoinAndSelect('question.options', 'options')
            .where('answer.attemptId = :attemptId', { attemptId });

        if (orgId) {
            answersQuery.andWhere('answer.orgId = :orgId', { orgId });
        }
        if (branchId) {
            answersQuery.andWhere('answer.branchId = :branchId', { branchId });
        }

        const answers = await answersQuery.getMany();

        return answers.map(answer => {
            const pointsAwarded = answer.pointsAwarded ?? 0;
            
            // Find the correct answer from the question's options
            const correctOption = answer.question?.options?.find((option: any) => option.isCorrect);
            const correctAnswer = correctOption?.optionText || null;

            return {
                questionId: answer.question?.questionId,
                questionText: answer.question?.questionText,
                questionType: answer.question?.questionType,
                points: Number(answer.question?.points || 0),
                pointsAwarded: Number(pointsAwarded),
                isCorrect: pointsAwarded > 0 || answer.selectedOption?.isCorrect || false,
                userAnswer: answer.selectedOption?.optionText || answer.textAnswer || 'No answer',
                correctAnswer,
            };
        });
    }

    /**
     * Calculate class rankings for this result
     */
    private async calculateClassRankings(result: Result): Promise<{
        classRank?: number;
        totalStudents?: number;
        percentileRank?: number;
    }> {
        // Get all results for this test within the same org/branch scope
        const resultsQuery = this.resultRepository
            .createQueryBuilder('result')
            .where('result.testId = :testId', { testId: result.testId });

        if (result.orgId) {
            resultsQuery.andWhere('result.orgId = :orgId', { orgId: result.orgId.id });
        }
        if (result.branchId) {
            resultsQuery.andWhere('result.branchId = :branchId', { branchId: result.branchId.id });
        }

        const allResults = await resultsQuery
            .orderBy('result.percentage', 'DESC')
            .addOrderBy('result.score', 'DESC')
            .addOrderBy('result.calculatedAt', 'ASC') // earlier submission wins ties
            .getMany();

        const totalStudents = allResults.length;
        const classRank = allResults.findIndex(r => r.resultId === result.resultId) + 1;
        const percentileRank = totalStudents > 0 ? Math.round(((totalStudents - classRank + 1) / totalStudents) * 100) : 0;

        return {
            classRank: classRank > 0 ? classRank : undefined,
            totalStudents: totalStudents > 0 ? totalStudents : undefined,
            percentileRank: percentileRank > 0 ? percentileRank : undefined,
        };
    }

    /**
     * Get additional statistics for test and course
     */
    private async getAdditionalStatistics(result: Result): Promise<{
        totalQuestions: number;
        questionsAnswered: number;
        enrolledStudents: number;
    }> {
        // Count questions for this test (include org-wide NULL branchId)
        const questionsQuery = this.questionRepository
            .createQueryBuilder('question')
            .where('question.testId = :testId', { testId: result.testId });

        if (result.orgId) {
            questionsQuery.andWhere('question.orgId = :orgId', { orgId: result.orgId.id });
        }
        applyBranchVisibilityToQuery(
            questionsQuery,
            'question',
            result.branchId?.id,
            'addlStats',
        );

        const totalQuestions = await questionsQuery.getCount();

        // Count answers for this attempt
        const answersQuery = this.answerRepository
            .createQueryBuilder('answer')
            .where('answer.attemptId = :attemptId', { attemptId: result.attemptId });

        if (result.orgId) {
            answersQuery.andWhere('answer.orgId = :orgId', { orgId: result.orgId.id });
        }
        if (result.branchId) {
            answersQuery.andWhere('answer.branchId = :branchId', { branchId: result.branchId.id });
        }

        const questionsAnswered = await answersQuery.getCount();

        // Count enrolled students in course (approximate via results)
        const enrolledQuery = this.resultRepository
            .createQueryBuilder('result')
            .select('COUNT(DISTINCT result.userId)', 'count')
            .where('result.courseId = :courseId', { courseId: result.courseId });

        if (result.orgId) {
            enrolledQuery.andWhere('result.orgId = :orgId', { orgId: result.orgId.id });
        }
        if (result.branchId) {
            enrolledQuery.andWhere('result.branchId = :branchId', { branchId: result.branchId.id });
        }

        const enrollmentResult = await enrolledQuery.getRawOne();
        const enrolledStudents = parseInt(enrollmentResult?.count || '0');

        return {
            totalQuestions,
            questionsAnswered,
            enrolledStudents,
        };
    }

    /**
     * Get class average percentage for difficulty calculation
     */
    private async getClassAveragePercentage(testId: number, orgId?: string, branchId?: string): Promise<number> {
        const resultsQuery = this.resultRepository
            .createQueryBuilder('result')
            .select('AVG(result.percentage)', 'avgPercentage')
            .where('result.testId = :testId', { testId });

        if (orgId) {
            resultsQuery.andWhere('result.orgId = :orgId', { orgId });
        }
        if (branchId) {
            resultsQuery.andWhere('result.branchId = :branchId', { branchId });
        }

        const avgResult = await resultsQuery.getRawOne();
        return parseFloat(avgResult?.avgPercentage || '75'); // default to 75% if no data
    }

    /**
     * Invalidate cache entries for a specific result and related data
     */
    private async invalidateResultCache(result: Result): Promise<void> {
        try {
            const patterns = [
                // Invalidate specific result cache
                this.CACHE_KEYS.RESULT_DETAILS(result.resultId, result.orgId?.id, result.branchId?.id),
                // Invalidate user results cache patterns
                `org:${result.orgId?.id || 'global'}:branch:${result.branchId?.id || 'global'}:user:${result.userId}:results:*`,
                // Invalidate test results cache patterns
                `org:${result.orgId?.id || 'global'}:branch:${result.branchId?.id || 'global'}:test:${result.testId}:results:*`,
                // Invalidate course results cache patterns
                `org:${result.orgId?.id || 'global'}:branch:${result.branchId?.id || 'global'}:course:${result.courseId}:results:*`,
                // Invalidate test analytics cache
                this.CACHE_KEYS.TEST_ANALYTICS(result.testId, result.orgId?.id, result.branchId?.id),
            ];

            for (const pattern of patterns) {
                if (pattern.includes('*')) {
                    // For wildcard patterns, we need to get all matching keys and delete them
                    const keys = await this.getCacheKeysByPattern(pattern);
                    for (const key of keys) {
                        await this.cacheManager.del(key);
                    }
                } else {
                    await this.cacheManager.del(pattern);
                }
            }

            this.logger.debug(`Invalidated cache for result ${result.resultId}`);
        } catch (error) {
            this.logger.error('Failed to invalidate cache:', error);
            // Don't throw error - cache invalidation failure shouldn't break the main operation
        }
    }

    /**
     * Get cache keys matching a pattern (Redis-specific implementation)
     */
    private async getCacheKeysByPattern(pattern: string): Promise<string[]> {
        try {
            // This is a simplified implementation
            // In a real Redis implementation, you would use SCAN with pattern matching
            // For now, we'll just return empty array since most cache managers don't support this
            return [];
        } catch (error) {
            this.logger.error('Failed to get cache keys by pattern:', error);
            return [];
        }
    }

    /**
     * Invalidate all cache entries for a user
     */
    private async invalidateUserCache(userId: string, orgId?: string, branchId?: string): Promise<void> {
        try {
            const pattern = `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:${userId}:*`;
            const keys = await this.getCacheKeysByPattern(pattern);
            
            for (const key of keys) {
                await this.cacheManager.del(key);
            }
            
            this.logger.debug(`Invalidated user cache for ${userId}`);
        } catch (error) {
            this.logger.error('Failed to invalidate user cache:', error);
        }
    }

    /**
     * Invalidate all cache entries for a test
     */
    private async invalidateTestCache(testId: number, orgId?: string, branchId?: string): Promise<void> {
        try {
            const patterns = [
                `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}:*`,
                this.CACHE_KEYS.TEST_ANALYTICS(testId, orgId, branchId),
            ];

            for (const pattern of patterns) {
                if (pattern.includes('*')) {
                    const keys = await this.getCacheKeysByPattern(pattern);
                    for (const key of keys) {
                        await this.cacheManager.del(key);
                    }
                } else {
                    await this.cacheManager.del(pattern);
                }
            }
            
            this.logger.debug(`Invalidated test cache for ${testId}`);
        } catch (error) {
            this.logger.error('Failed to invalidate test cache:', error);
        }
    }

    /**
     * Invalidate all cache entries for a course
     */
    private async invalidateCourseCache(courseId: number, orgId?: string, branchId?: string): Promise<void> {
        try {
            const pattern = `org:${orgId || 'global'}:branch:${branchId || 'global'}:course:${courseId}:*`;
            const keys = await this.getCacheKeysByPattern(pattern);
            
            for (const key of keys) {
                await this.cacheManager.del(key);
            }
            
            this.logger.debug(`Invalidated course cache for ${courseId}`);
        } catch (error) {
            this.logger.error('Failed to invalidate course cache:', error);
        }
    }
}
