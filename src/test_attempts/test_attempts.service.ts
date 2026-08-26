import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    Repository,
    DataSource,
    EntityManager,
    SelectQueryBuilder,
} from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';
import { SubmitTestAttemptDto } from './dto/submit-test-attempt.dto';
import { TestAttemptResponseDto } from './dto/test-attempt-response.dto';
import { TestAttempt, AttemptStatus } from './entities/test_attempt.entity';
import { TestAttemptReset } from './entities/test-attempt-reset.entity';
import { Test } from '../test/entities/test.entity';
import { Result } from '../results/entities/result.entity';
import {
    EXAM_WINDOW_CLOSED_MESSAGE,
    EXAM_WINDOW_NOT_OPEN_MESSAGE,
    isExamWindowClosed,
    isExamWindowPending,
} from '../test/utils/exam-window.util';
import { User, UserRole } from '../user/entities/user.entity';
import { Organization } from '../org/entities/org.entity';
import { Branch } from '../branch/entities/branch.entity';
import { TestAttemptStatsDto } from './dto/test-attempt-stats.dto';
import { TestAttemptFilterDto } from './dto/test-attempt-filter.dto';
import { TestAttemptListResponseDto } from './dto/test-attempt-list-response.dto';
import { ResetTestAttemptsDto } from './dto/reset-test-attempts.dto';
import { TestAttemptResetFilterDto } from './dto/test-attempt-reset-filter.dto';
import { TestAttemptResetResponseDto } from './dto/test-attempt-reset-response.dto';
import { TestAttemptResetListResponseDto } from './dto/test-attempt-reset-list-response.dto';
import { ResultsService } from '../results/results.service';
import { AnswersService } from '../answers/answers.service';
import { TestService } from '../test/test.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { canAccessBranchScopedContent } from '../auth/utils/branch-visibility.util';
import { RetryService } from '../common/services/retry.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DEFAULT_LOCALE } from '../locale/locale.constants';
import { MAX_SELECTED_OPTION_IDS } from './dto/submit-test-attempt.dto';

/**
 * Normalizes single- and multi-select option payloads into a unique id list (max 3).
 */
function normalizeSelectedOptionIds(
    selectedOptionIds?: number[],
    selectedOptionId?: number,
): number[] {
    const fromArray = (selectedOptionIds ?? []).filter(
        (optionId): optionId is number =>
            typeof optionId === 'number' && optionId > 0,
    );

    if (fromArray.length > 0) {
        return [...new Set(fromArray)].slice(0, MAX_SELECTED_OPTION_IDS);
    }

    if (typeof selectedOptionId === 'number' && selectedOptionId > 0) {
        return [selectedOptionId];
    }

    return [];
}
import {
    RewardsTestAttemptStartedEvent,
    TestAttemptSubmittedEvent,
} from '../common/events';

@Injectable()
export class TestAttemptsService {
    private readonly logger = new Logger(TestAttemptsService.name);

    // Cache key patterns with org/branch scoping
    private readonly CACHE_KEYS = {
        ATTEMPT_BY_ID: (attemptId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:attempt:${attemptId}`,
        USER_ATTEMPTS: (
            userId: string,
            testId: number | undefined,
            filters: string,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:${userId}:attempts:test:${testId || 'all'}:${filters}`,
        ATTEMPT_VALIDATION: (
            testId: number,
            userId: string,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:attempt:validation:test:${testId}:user:${userId}`,
        // `includeVoided` is part of the key because elevated callers get
        // pre-reset rows counted in and learners must never be served that
        // cached variant.
        ATTEMPT_STATS: (
            testId: number | undefined,
            userId: string | undefined,
            includeVoided: boolean,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:attempt:stats:test:${testId || 'all'}:user:${userId || 'all'}:voided:${includeVoided}`,
        TEST_ATTEMPTS: (
            testId: number,
            filters: string,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}:attempts:${filters}`,
    };

    // Cache TTL configurations (in seconds)
    private readonly CACHE_TTL = {
        ATTEMPT_DETAILS: 300, // 5 minutes - attempts change frequently
        USER_ATTEMPTS: 180, // 3 minutes - user lists change often
        ATTEMPT_VALIDATION: 120, // 2 minutes - validation might change
        ATTEMPT_STATS: 600, // 10 minutes - stats change less frequently
        TEST_ATTEMPTS: 300, // 5 minutes - test attempt lists
    };

    constructor(
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(TestAttemptReset)
        private readonly testAttemptResetRepository: Repository<TestAttemptReset>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
        private readonly resultsService: ResultsService,
        private readonly answersService: AnswersService,
        private readonly testService: TestService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /** Roles allowed to reset learners and to read pre-reset (voided) rows. */
    private static readonly ELEVATED_ROLES: readonly UserRole[] = [
        UserRole.ADMIN,
        UserRole.OWNER,
        UserRole.MASTER_ADMIN,
    ];

    /**
     * Whether the caller holds a leadership role.
     *
     * Elevated roles (admin, owner, master_admin) may:
     * - read voided attempts
     * - start and submit tests that are inactive or outside the exam window
     *   so they can verify questions and the submission flow
     *
     * Generic `user` callers never receive this bypass.
     *
     * @param userRole - Role carried on the request scope.
     * @returns True when the role may perform admin testing / reset work.
     */
    private isElevatedRole(userRole?: string): boolean {
        return TestAttemptsService.ELEVATED_ROLES.includes(
            userRole as UserRole,
        );
    }

    /**
     * Defence in depth alongside `RolesGuard`: the service refuses privileged
     * work even if a caller reaches it without passing the controller guards.
     *
     * @param scope - Caller org/branch/role scope.
     * @throws ForbiddenException when the caller is not elevated.
     */
    private assertAdminAccess(scope: OrgBranchScope): void {
        if (!this.isElevatedRole(scope.userRole)) {
            throw new ForbiddenException(
                'Admin access required to manage test attempt resets',
            );
        }
    }

    /**
     * Restrict a query to attempts that are still visible to the learner.
     *
     * Attempts voided by an admin reset carry the answer key of a test the
     * learner is about to retake, so they must disappear from every
     * learner-facing read path.
     *
     * @param query - Query builder aliased on the test attempt.
     * @param includeVoided - Set only by elevated callers reading history.
     * @param alias - Query alias for the attempt entity.
     * @returns The same query builder for chaining.
     */
    private applyLiveAttemptFilter(
        query: SelectQueryBuilder<TestAttempt>,
        includeVoided = false,
        alias = 'attempt',
    ): SelectQueryBuilder<TestAttempt> {
        if (includeVoided) {
            return query;
        }
        return query.andWhere(`${alias}.voidedByResetId IS NULL`);
    }

    /**
     * Apply the caller's organization and branch boundaries to a query.
     *
     * Elevated roles (Admin / Owner / Master Admin) are org-scoped only so they
     * can manage learners and attempts across every branch in their organization.
     *
     * @param query - Query builder aliased on the test attempt.
     * @param scope - Caller org/branch scope.
     * @param alias - Query alias for the attempt entity.
     * @returns The same query builder for chaining.
     */
    private applyAttemptScopeFilters(
        query: SelectQueryBuilder<TestAttempt>,
        scope: OrgBranchScope,
        alias = 'attempt',
    ): SelectQueryBuilder<TestAttempt> {
        if (scope.orgId) {
            query.andWhere(`${alias}.orgId = :scopedOrgId`, {
                scopedOrgId: scope.orgId,
            });
        }
        // Admins operate org-wide; branch filter only applies to non-elevated callers.
        if (scope.branchId && !this.isElevatedRole(scope.userRole)) {
            query.andWhere(`${alias}.branchId = :scopedBranchId`, {
                scopedBranchId: scope.branchId,
            });
        }
        return query;
    }

    /**
     * Count the attempts that consume the learner's `maxAttempts` allowance.
     *
     * A single rule governs every counter in the system: an attempt is
     * chargeable when it has not been voided by a reset and was not cancelled.
     * Routing `startAttempt`, `validateAttemptLimits` and the test overview
     * through this helper is what makes a reset actually unlock the learner.
     *
     * @param testId - Test being counted.
     * @param userId - Learner being counted.
     * @param scope - Caller org/branch scope.
     * @returns Number of attempts already charged against the allowance.
     */
    private async countChargeableAttempts(
        testId: number,
        userId: string,
        scope: OrgBranchScope,
    ): Promise<number> {
        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .where('attempt.testId = :testId', { testId })
            .andWhere('attempt.userId = :userId', { userId })
            .andWhere('attempt.status != :cancelledStatus', {
                cancelledStatus: AttemptStatus.CANCELLED,
            });

        this.applyAttemptScopeFilters(query, scope);
        this.applyLiveAttemptFilter(query);

        return query.getCount();
    }

    /**
     * Cache invalidation helper for test attempts
     */
    private async invalidateAttemptCache(
        attemptId: number,
        userId?: string,
        testId?: number,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.ATTEMPT_BY_ID(attemptId, orgId, branchId),
        ];

        if (userId) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_ATTEMPTS(
                    userId,
                    testId,
                    '',
                    orgId,
                    branchId,
                ),
                this.CACHE_KEYS.ATTEMPT_VALIDATION(
                    testId!,
                    userId,
                    orgId,
                    branchId,
                ),
            );
        }

        if (testId) {
            keysToDelete.push(
                this.CACHE_KEYS.TEST_ATTEMPTS(testId, '', orgId, branchId),
                this.CACHE_KEYS.ATTEMPT_STATS(
                    testId,
                    userId,
                    false,
                    orgId,
                    branchId,
                ),
                this.CACHE_KEYS.ATTEMPT_STATS(
                    testId,
                    userId,
                    true,
                    orgId,
                    branchId,
                ),
            );
        }

        // Add general stats cache
        keysToDelete.push(
            this.CACHE_KEYS.ATTEMPT_STATS(
                undefined,
                undefined,
                false,
                orgId,
                branchId,
            ),
            this.CACHE_KEYS.ATTEMPT_STATS(
                undefined,
                undefined,
                true,
                orgId,
                branchId,
            ),
        );

        await Promise.all(
            keysToDelete.map(async key => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                }
            }),
        );
    }

    /**
     * Start a new test attempt or return existing active attempt
     * Intelligently handles expired attempts, corrupted data, and edge cases
     */
    async startAttempt(
        createAttemptDto: CreateTestAttemptDto,
        scope: OrgBranchScope,
        userId: string,
        locale: string = DEFAULT_LOCALE,
    ): Promise<TestAttemptResponseDto> {
        return this.retryService.executeDatabase(async () => {
            // Get test details with org/branch validation using TestService
            const test = await this.testService.getTestForAttempt(
                createAttemptDto.testId,
                scope,
            );

            if (!test) {
                throw new NotFoundException(
                    'Test not found or not accessible in your organization/branch',
                );
            }

            // Admin testing bypass: master_admin, owner, and admin may start a
            // test even when it is inactive or outside its exam window so they
            // can verify questions, options, and the submission flow.
            // Generic `user` callers remain fully gated.
            const mayBypassAvailability = this.isElevatedRole(scope.userRole);

            if (!test.isActive && !mayBypassAvailability) {
                throw new BadRequestException('Test is not active');
            }

            // Exam window gate (replaces the old single exam-day rule): a new
            // attempt may only begin between examStartDate and examEndDate.
            if (!mayBypassAvailability) {
                if (isExamWindowPending(test)) {
                    throw new BadRequestException(EXAM_WINDOW_NOT_OPEN_MESSAGE);
                }
                if (isExamWindowClosed(test)) {
                    throw new BadRequestException(EXAM_WINDOW_CLOSED_MESSAGE);
                }
            }

            // Smart attempt detection and cleanup
            const validAttempt = await this.findOrCleanupUserAttempt(
                createAttemptDto.testId,
                userId,
                scope,
            );

            if (validAttempt) {
                this.logger.log(
                    `Returning existing valid attempt ${validAttempt.attemptId} for test ${createAttemptDto.testId} and user ${userId}`,
                );
                return this.mapToResponseDto(validAttempt);
            }

            // Check attempt limits before creating new attempt
            const attemptValidation = await this.validateNewAttemptAllowed(
                createAttemptDto.testId,
                userId,
                scope,
                test.maxAttempts,
            );

            if (!attemptValidation.allowed) {
                throw new BadRequestException(attemptValidation.reason);
            }

            // Create new attempt with proper error handling
            const newAttempt = await this.createNewAttempt(
                createAttemptDto.testId,
                userId,
                scope,
                test,
                attemptValidation.attemptNumber,
                locale,
            );

            this.logger.log(
                `Created new attempt ${newAttempt.attemptId} for test ${createAttemptDto.testId} and user ${userId}`,
            );

            // Phase 3/4 — emit event for start-attempt XP (new attempts only)
            if (scope.orgId) {
                this.eventEmitter.emit(
                    'test.attempt.started',
                    new RewardsTestAttemptStartedEvent(
                        newAttempt.attemptId,
                        createAttemptDto.testId,
                        test.courseId,
                        userId,
                        newAttempt.attemptNumber,
                        scope.orgId,
                        scope.branchId,
                    ),
                );
            }

            return this.mapToResponseDto(newAttempt);
        });
    }

    /**
     * Intelligently find valid user attempt or cleanup invalid ones
     */
    private async findOrCleanupUserAttempt(
        testId: number,
        userId: string,
        scope: OrgBranchScope,
    ): Promise<TestAttempt | null> {
        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .where('attempt.testId = :testId', { testId })
            .andWhere('attempt.userId = :userId', { userId })
            .andWhere('attempt.status = :status', {
                status: AttemptStatus.IN_PROGRESS,
            });

        // Apply org/branch scoping
        if (scope.orgId) {
            query.andWhere('attempt.orgId = :orgId', { orgId: scope.orgId });
        }
        if (scope.branchId) {
            query.andWhere('attempt.branchId = :branchId', {
                branchId: scope.branchId,
            });
        }

        // A reset cancels and voids any in-flight attempt; resuming one would
        // let the learner submit into the fresh window with old answers.
        this.applyLiveAttemptFilter(query);

        const potentialAttempts = await query
            .orderBy('attempt.createdAt', 'DESC')
            .getMany();

        if (potentialAttempts.length === 0) {
            return null;
        }

        const now = new Date();
        const validAttempts: TestAttempt[] = [];
        const expiredAttempts: TestAttempt[] = [];

        // Categorize attempts by validity
        for (const attempt of potentialAttempts) {
            if (attempt.expiresAt && now > attempt.expiresAt) {
                expiredAttempts.push(attempt);
            } else {
                validAttempts.push(attempt);
            }
        }

        // Clean up expired attempts
        if (expiredAttempts.length > 0) {
            await this.cleanupExpiredAttempts(expiredAttempts);
        }

        // Handle multiple valid attempts (shouldn't happen, but be defensive)
        if (validAttempts.length > 1) {
            this.logger.warn(
                `Found ${validAttempts.length} valid in-progress attempts for test ${testId} and user ${userId}. Keeping the most recent.`,
            );

            // Keep the most recent, mark others as cancelled
            const [mostRecent, ...outdated] = validAttempts;
            await this.cleanupOutdatedAttempts(outdated);
            return mostRecent;
        }

        // Return the single valid attempt, if any
        return validAttempts[0] || null;
    }

    /**
     * Clean up expired attempts by updating their status
     */
    private async cleanupExpiredAttempts(
        expiredAttempts: TestAttempt[],
    ): Promise<void> {
        try {
            for (const attempt of expiredAttempts) {
                attempt.status = AttemptStatus.EXPIRED;
                await this.testAttemptRepository.save(attempt);

                this.logger.log(
                    `Marked attempt ${attempt.attemptId} as expired`,
                );

                // Invalidate cache for this attempt
                await this.invalidateAttemptCache(
                    attempt.attemptId,
                    attempt.userId,
                    attempt.testId,
                );
            }
        } catch (error) {
            this.logger.error(
                'Failed to cleanup expired attempts:',
                error instanceof Error ? error.stack : String(error),
            );
            // Don't throw - this is cleanup, not critical path
        }
    }

    /**
     * Clean up outdated attempts when multiple valid ones exist
     */
    private async cleanupOutdatedAttempts(
        outdatedAttempts: TestAttempt[],
    ): Promise<void> {
        try {
            for (const attempt of outdatedAttempts) {
                attempt.status = AttemptStatus.CANCELLED;
                await this.testAttemptRepository.save(attempt);

                this.logger.log(
                    `Marked outdated attempt ${attempt.attemptId} as cancelled`,
                );

                // Invalidate cache for this attempt
                await this.invalidateAttemptCache(
                    attempt.attemptId,
                    attempt.userId,
                    attempt.testId,
                );
            }
        } catch (error) {
            this.logger.error(
                'Failed to cleanup outdated attempts:',
                error instanceof Error ? error.stack : String(error),
            );
            // Don't throw - this is cleanup, not critical path
        }
    }

    /**
     * Clean up expired attempts for a specific test
     */
    private async cleanupExpiredAttemptsForTest(
        testId: number,
        scope: OrgBranchScope,
    ): Promise<void> {
        try {
            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .where('attempt.testId = :testId', { testId })
                .andWhere('attempt.status = :status', {
                    status: AttemptStatus.IN_PROGRESS,
                });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const potentialExpiredAttempts = await query.getMany();

            if (potentialExpiredAttempts.length === 0) {
                return;
            }

            const now = new Date();
            const expiredAttempts = potentialExpiredAttempts.filter(
                attempt => attempt.expiresAt && now > attempt.expiresAt,
            );

            if (expiredAttempts.length > 0) {
                this.logger.log(
                    `Found ${expiredAttempts.length} expired attempts for test ${testId}, cleaning up...`,
                );
                await this.cleanupExpiredAttempts(expiredAttempts);
            }
        } catch (error) {
            this.logger.error(
                `Failed to cleanup expired attempts for test ${testId}:`,
                error instanceof Error ? error.stack : String(error),
            );
            // Don't throw - this is cleanup, not critical path
        }
    }

    /**
     * Validate if a new attempt is allowed
     */
    private async validateNewAttemptAllowed(
        testId: number,
        userId: string,
        scope: OrgBranchScope,
        maxAttempts: number,
    ): Promise<{ allowed: boolean; reason?: string; attemptNumber: number }> {
        const totalAttempts = await this.countChargeableAttempts(
            testId,
            userId,
            scope,
        );

        if (totalAttempts >= maxAttempts) {
            return {
                allowed: false,
                reason: `Maximum attempts (${maxAttempts}) exceeded for this test`,
                attemptNumber: totalAttempts + 1,
            };
        }

        return {
            allowed: true,
            attemptNumber: totalAttempts + 1,
        };
    }

    /**
     * Create a new attempt with proper error handling
     */
    private async createNewAttempt(
        testId: number,
        userId: string,
        scope: OrgBranchScope,
        test: {
            durationMinutes?: number;
            orgId: Organization;
            branchId?: Branch;
        },
        attemptNumber: number,
        locale: string = DEFAULT_LOCALE,
    ): Promise<TestAttempt> {
        const startTime = new Date();
        const expiresAt = test.durationMinutes
            ? new Date(startTime.getTime() + test.durationMinutes * 60000)
            : undefined;

        const attempt = this.testAttemptRepository.create({
            testId,
            userId,
            attemptNumber,
            status: AttemptStatus.IN_PROGRESS,
            startTime,
            expiresAt,
            progressPercentage: 0,
            locale,
            // Org-wide tests have NULL branchId — stamp the learner's branch on
            // the attempt so reporting/leaderboards stay branch-accurate.
            orgId: test.orgId,
            branchId:
                test.branchId ??
                (scope.branchId ? ({ id: scope.branchId } as Branch) : undefined),
        });

        try {
            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Invalidate related caches
            await this.invalidateAttemptCache(
                savedAttempt.attemptId,
                userId,
                testId,
                scope.orgId,
                scope.branchId,
            );

            return savedAttempt;
        } catch (error) {
            this.logger.error(
                `Failed to create new attempt for test ${testId} and user ${userId}:`,
                error instanceof Error ? error.stack : String(error),
            );

            // Try to handle specific database errors
            if (error instanceof Error) {
                if (
                    error.message.includes('duplicate') ||
                    error.message.includes('unique')
                ) {
                    throw new BadRequestException(
                        'An attempt is already in progress. Please refresh and try again.',
                    );
                }
            }

            throw new BadRequestException(
                'Failed to start test attempt. Please try again.',
            );
        }
    }

    /**
     * Submit a test attempt with bulk answers
     */
    async submitAttempt(
        attemptId: number,
        submitData: SubmitTestAttemptDto,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const attempt = await this.findAttemptByIdAndUserWithScope(
                attemptId,
                userId,
                scope,
            );

            if (
                attempt.status !== AttemptStatus.IN_PROGRESS &&
                attempt.status !== AttemptStatus.SUBMITTED
            ) {
                throw new BadRequestException(
                    'Cannot submit attempt that is not in progress',
                );
            }

            // Submissions are bound to the exam window too. An attempt that
            // legitimately started while the window was open is still allowed
            // through, so work in progress at the exact moment the window
            // closes is never silently lost (the attempt timer still applies).
            // Admin testing bypass: elevated roles may also submit attempts
            // they started outside the window (inactive / not-yet-open tests)
            // so verification of questions and scoring can complete.
            if (attempt.test && isExamWindowClosed(attempt.test)) {
                const startedWhileWindowOpen = !isExamWindowClosed(
                    attempt.test,
                    attempt.startTime,
                );

                if (
                    !startedWhileWindowOpen &&
                    !this.isElevatedRole(scope.userRole)
                ) {
                    throw new BadRequestException(EXAM_WINDOW_CLOSED_MESSAGE);
                }
            }

            // Process bulk answers first
            let createdAnswerEntities: any[] = [];
            if (submitData.answers && submitData.answers.length > 0) {
                this.logger.log(
                    `Processing ${submitData.answers.length} answers for attempt ${attemptId}`,
                );

                // Create answers using the answers service.
                // Multi-select MC answers send selectedOptionIds (max 3); persist as JSON in textAnswer
                // while keeping selectedOptionId as the first selection for FK / legacy clients.
                const bulkAnswersDto = {
                    answers: submitData.answers.map(answer => {
                        const selectedOptionIds = normalizeSelectedOptionIds(
                            answer.selectedOptionIds,
                            answer.selectedOptionId,
                        );

                        return {
                            attemptId,
                            questionId: answer.questionId,
                            selectedOptionId:
                                selectedOptionIds.length > 0
                                    ? selectedOptionIds[0]
                                    : undefined,
                            textAnswer:
                                selectedOptionIds.length > 0
                                    ? JSON.stringify(selectedOptionIds)
                                    : answer.answerText,
                            timeSpent: answer.timeSpent,
                        };
                    }),
                };
                try {
                    const bulkResult =
                        await this.answersService.bulkCreateWithEntities(
                            bulkAnswersDto,
                            scope,
                            {
                                testId: attempt.testId,
                                attemptId: attemptId,
                                userId: userId
                            }
                        );
                    if (bulkResult.success) {
                        createdAnswerEntities = bulkResult.data.entities;
                        this.logger.log(
                            `Successfully created ${submitData.answers.length} answers for attempt ${attemptId} ` +
                            `(validation: ${bulkResult.validationResult?.validQuestions}/${bulkResult.validationResult?.questionsValidated} questions valid, ` +
                            `${bulkResult.validationResult?.validationTime}ms validation time)`
                        );
                        this.logger.log(
                            `🔍 DEBUG: Created ${createdAnswerEntities.length} answer entities for auto-marking`,
                        );
                        // Log first entity details for debugging
                        if (createdAnswerEntities.length > 0) {
                            const firstEntity = createdAnswerEntities[0];
                            this.logger.log(
                                `🔍 DEBUG: First entity - ID: ${firstEntity.answerId}, Question: ${firstEntity.questionId}, HasQuestion: ${!!firstEntity.question}`,
                            );
                        }
                        
                        // Log any errors that occurred during creation
                        if (bulkResult.errors && bulkResult.errors.length > 0) {
                            this.logger.warn(
                                `Partial success in answer creation: ${bulkResult.errors.length} errors occurred`,
                                bulkResult.errors
                            );
                        }
                    } else {
                        const errorMessage = `Bulk create failed: ${bulkResult.message}`;
                        if (bulkResult.errors && bulkResult.errors.length > 0) {
                            this.logger.error(
                                `${errorMessage}. Detailed errors:`,
                                bulkResult.errors
                            );
                        }
                        throw new Error(errorMessage);
                    }
                } catch (error) {
                    this.logger.error(
                        `Failed to create answers for attempt ${attemptId}:`,
                        error instanceof Error ? error.stack : String(error),
                    );
                    throw new BadRequestException(
                        'Failed to save answers. Please try again.',
                    );
                }
            }

            // Mark + persist the result BEFORE flipping status. The previous order
            // reported HTTP success after answers were saved even when result
            // creation timed out, which sent learners to an empty Past Results page.
            this.logger.log(
                `Starting auto-processing for attempt ${attemptId}`,
            );
            const markedCount = await this.answersService.autoMark(
                attemptId,
                scope,
            );
            this.logger.log(
                `Auto-marking completed for attempt ${attemptId} - marked ${markedCount} questions`,
            );

            const createdResult =
                await this.resultsService.createFromAttempt(attemptId);
            if (!createdResult?.resultId) {
                throw new InternalServerErrorException(
                    'Failed to save the test result. Please try submitting again.',
                );
            }
            this.logger.log(
                `Result created for attempt ${attemptId}: ${createdResult.resultId}`,
            );

            if (attempt.status !== AttemptStatus.SUBMITTED) {
                attempt.status = AttemptStatus.SUBMITTED;
                attempt.submitTime = new Date();
                attempt.progressPercentage = 100;
            }

            const savedAttempt =
                await this.testAttemptRepository.save(attempt);

            if (scope.orgId) {
                const courseId =
                    attempt.test?.courseId ??
                    (
                        await this.testRepository.findOne({
                            where: { testId: attempt.testId },
                            select: { courseId: true },
                        })
                    )?.courseId;

                if (courseId) {
                    this.eventEmitter.emit(
                        'test.attempt.submitted',
                        new TestAttemptSubmittedEvent(
                            attemptId,
                            attempt.testId,
                            courseId,
                            userId,
                            scope.orgId,
                            scope.branchId,
                        ),
                    );
                }
            }

            await this.invalidateAttemptCache(
                attemptId,
                userId,
                attempt.testId,
                scope.orgId,
                scope.branchId,
            );

            try {
                await this.testService.refreshTestStatistics(attempt.testId);
            } catch (statsError) {
                this.logger.warn(
                    `Test statistics refresh failed after result ${createdResult.resultId} (non-fatal)`,
                    statsError instanceof Error
                        ? statsError.message
                        : String(statsError),
                );
            }

            return {
                ...this.mapToResponseDto(savedAttempt),
                resultId: createdResult.resultId,
                score: createdResult.score,
                percentage: createdResult.percentage,
                passed: createdResult.passed,
            };
        });
    }

    /**
     * Update test attempt progress
     */
    async updateProgress(
        attemptId: number,
        updateDto: UpdateTestAttemptDto,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const attempt = await this.findAttemptByIdAndUserWithScope(
                attemptId,
                userId,
                scope,
            );

            if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Cannot update progress for completed attempt',
                );
            }

            // Check if attempt has expired
            if (attempt.expiresAt && new Date() > attempt.expiresAt) {
                attempt.status = AttemptStatus.EXPIRED;
                await this.testAttemptRepository.save(attempt);
                throw new BadRequestException('Test attempt has expired');
            }

            // Update fields
            if (updateDto.progressPercentage !== undefined) {
                attempt.progressPercentage = updateDto.progressPercentage;
            }
            if (updateDto.status !== undefined) {
                attempt.status = updateDto.status;
                if (updateDto.status === AttemptStatus.SUBMITTED) {
                    attempt.submitTime = new Date();
                    attempt.progressPercentage = 100;
                }
            }

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Invalidate related caches
            await this.invalidateAttemptCache(
                attemptId,
                userId,
                attempt.testId,
                scope.orgId,
                scope.branchId,
            );

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Get user's test attempts with caching
     */
    async getUserAttempts(
        userId: string,
        scope: OrgBranchScope,
        testId?: number,
        page: number = 1,
        pageSize: number = 10,
    ): Promise<{
        attempts: TestAttemptResponseDto[];
        total: number;
        page: number;
        pageSize: number;
        statistics: TestAttemptStatsDto;
    }> {
        const cacheKey = this.CACHE_KEYS.USER_ATTEMPTS(
            userId,
            testId,
            `${page}-${pageSize}`,
            scope.orgId,
            scope.branchId,
        );

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached as {
                attempts: TestAttemptResponseDto[];
                total: number;
                page: number;
                pageSize: number;
                statistics: TestAttemptStatsDto;
            };
        }

        const result = await this.retryService.executeDatabase(async () => {
            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('attempt.orgId', 'org')
                .leftJoinAndSelect('attempt.branchId', 'branch')
                .where('attempt.userId = :userId', { userId });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            if (testId) {
                query.andWhere('attempt.testId = :testId', { testId });
            }

            // Learner-owned list: pre-reset attempts stay hidden.
            this.applyLiveAttemptFilter(query);

            query
                .orderBy('attempt.createdAt', 'DESC')
                .skip((page - 1) * pageSize)
                .take(pageSize);

            const [attempts, total] = await query.getManyAndCount();

            return {
                attempts: attempts.map(attempt =>
                    this.mapToResponseDto(attempt),
                ),
                total,
                page,
                pageSize,
            };
        });

        // Attach aggregate stats (includes pass/fail from results table)
        const statistics = await this.getStats(scope, testId, userId);

        const response = {
            ...result,
            statistics,
        };

        await this.cacheManager.set(
            cacheKey,
            response,
            this.CACHE_TTL.USER_ATTEMPTS,
        );
        return response;
    }

    /**
     * Get attempt by ID with access control and caching
     */
    async findOne(
        attemptId: number,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        const cacheKey = this.CACHE_KEYS.ATTEMPT_BY_ID(
            attemptId,
            scope.orgId,
            scope.branchId,
        );

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            const cachedAttempt = cached as TestAttemptResponseDto;
            // Verify user access for cached data
            if (cachedAttempt.userId !== userId) {
                throw new ForbiddenException(
                    'Access denied to this test attempt',
                );
            }
            return cachedAttempt;
        }

        const result = await this.retryService.executeDatabase(async () => {
            const attempt = await this.findAttemptByIdAndUserWithScope(
                attemptId,
                userId,
                scope,
            );
            return this.mapToResponseDto(attempt);
        });

        await this.cacheManager.set(
            cacheKey,
            result,
            this.CACHE_TTL.ATTEMPT_DETAILS,
        );
        return result;
    }

    /**
     * Cancel an active attempt
     */
    async cancelAttempt(
        attemptId: number,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const attempt = await this.findAttemptByIdAndUserWithScope(
                attemptId,
                userId,
                scope,
            );

            if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Cannot cancel attempt that is not in progress',
                );
            }

            attempt.status = AttemptStatus.CANCELLED;
            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Invalidate related caches
            await this.invalidateAttemptCache(
                attemptId,
                userId,
                attempt.testId,
                scope.orgId,
                scope.branchId,
            );

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Private helper to find attempt by ID and validate user access with scope.
     *
     * Voided attempts are treated as non-existent rather than forbidden: a 403
     * would confirm the row exists and belongs to the learner, and 404 is the
     * state the clients render as "no longer available".
     */
    private async findAttemptByIdAndUserWithScope(
        attemptId: number,
        userId: string,
        scope: OrgBranchScope,
        includeVoided = false,
    ): Promise<TestAttempt> {
        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .leftJoinAndSelect('attempt.test', 'test')
            .leftJoin('attempt.orgId', 'orgId')
            .addSelect(['orgId.id'])
            .leftJoin('attempt.branchId', 'branchId')
            .addSelect(['branchId.id'])
            .where('attempt.attemptId = :attemptId', { attemptId })
            .andWhere('attempt.userId = :userId', { userId });

        // Apply org/branch scoping
        if (scope.orgId) {
            query.andWhere('attempt.orgId = :orgId', { orgId: scope.orgId });
        }
        if (scope.branchId) {
            query.andWhere('attempt.branchId = :branchId', {
                branchId: scope.branchId,
            });
        }

        this.applyLiveAttemptFilter(query, includeVoided);

        const attempt = await query.getOne();

        if (!attempt) {
            throw new NotFoundException('Test attempt not found');
        }

        return attempt;
    }

    /**
     * Map entity to response DTO
     */
    private mapToResponseDto(attempt: TestAttempt): TestAttemptResponseDto {
        return {
            attemptId: attempt.attemptId,
            testId: attempt.testId,
            userId: attempt.userId,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            startTime: attempt.startTime,
            submitTime: attempt.submitTime,
            expiresAt: attempt.expiresAt,
            progressPercentage: attempt.progressPercentage,
            createdAt: attempt.createdAt,
            updatedAt: attempt.updatedAt,
            test: attempt.test
                ? {
                      testId: attempt.test.testId,
                      title: attempt.test.title,
                      testType: attempt.test.testType,
                      durationMinutes: attempt.test.durationMinutes,
                  }
                : undefined,
            user: attempt.user
                ? {
                      id: attempt.user.id,
                      email: attempt.user.email,
                      firstName: attempt.user.firstName,
                      lastName: attempt.user.lastName,
                  }
                : undefined,
        };
    }

    /**
     * Get attempts for a specific test (instructor view) with caching and
     * scoping.
     *
     * The learner UI calls this endpoint with its own `userId`, so the route
     * cannot be gated behind `RolesGuard`. Instead, a non-elevated caller is
     * pinned to their own attempts here, which also stops the endpoint from
     * returning every learner's attempts for the test.
     */
    async findAttemptsByTest(
        testId: number,
        scope: OrgBranchScope,
        filters?: TestAttemptFilterDto,
    ): Promise<TestAttemptListResponseDto> {
        const isElevated = this.isElevatedRole(scope.userRole);
        const effectiveFilters: TestAttemptFilterDto = {
            ...(filters ?? {}),
            userId: isElevated ? filters?.userId : scope.userId,
        };

        // The effective user and visibility are part of the key so one
        // caller's cached page can never be served to another.
        const filtersKey = `${JSON.stringify(effectiveFilters)}:voided:${isElevated}`;
        const cacheKey = this.CACHE_KEYS.TEST_ATTEMPTS(
            testId,
            filtersKey,
            scope.orgId,
            scope.branchId,
        );

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached as TestAttemptListResponseDto;
        }

        const result = await this.retryService.executeDatabase(async () => {
            // Cheap PK + access check — do not call TestService.findOne() here.
            // findOne loads questions/options and used to join every attempt/result,
            // which timed out (read ETIMEDOUT) when listing attempts for a busy test.
            await this.testService.ensureTestAccessible(testId, scope);

            // Clean up expired attempts before retrieving data
            await this.cleanupExpiredAttemptsForTest(testId, scope);

            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('attempt.user', 'user')
                .where('attempt.testId = :testId', { testId });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            // Apply filters
            if (effectiveFilters.status) {
                query.andWhere('attempt.status = :status', {
                    status: effectiveFilters.status,
                });
            }
            if (effectiveFilters.userId) {
                query.andWhere('attempt.userId = :userId', {
                    userId: effectiveFilters.userId,
                });
            }
            if (effectiveFilters.startDateFrom) {
                query.andWhere('attempt.startTime >= :startDateFrom', {
                    startDateFrom: effectiveFilters.startDateFrom,
                });
            }
            if (effectiveFilters.startDateTo) {
                query.andWhere('attempt.startTime <= :startDateTo', {
                    startDateTo: effectiveFilters.startDateTo,
                });
            }

            this.applyLiveAttemptFilter(query, isElevated);

            query.orderBy('attempt.createdAt', 'DESC');

            const page = effectiveFilters.page || 1;
            const pageSize = effectiveFilters.pageSize || 10;
            const offset = (page - 1) * pageSize;

            const [attempts, total] = await query
                .skip(offset)
                .take(pageSize)
                .getManyAndCount();

            const totalPages = Math.ceil(total / pageSize);

            return {
                attempts: attempts.map(attempt =>
                    this.mapToResponseDto(attempt),
                ),
                total,
                page,
                pageSize,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            };
        });

        await this.cacheManager.set(
            cacheKey,
            result,
            this.CACHE_TTL.TEST_ATTEMPTS,
        );
        return result;
    }

    /**
     * Validate if user can attempt a test with caching
     */
    async validateAttemptLimits(
        testId: number,
        userId: string,
        scope: OrgBranchScope,
    ): Promise<{
        canAttempt: boolean;
        reason?: string;
        attemptsUsed: number;
        maxAttempts: number;
    }> {
        const cacheKey = this.CACHE_KEYS.ATTEMPT_VALIDATION(
            testId,
            userId,
            scope.orgId,
            scope.branchId,
        );

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached as {
                canAttempt: boolean;
                reason?: string;
                attemptsUsed: number;
                maxAttempts: number;
            };
        }

        const result = await this.retryService.executeDatabase(async () => {
            // Use TestService to get test configuration
            const testConfig =
                await this.testService.getTestConfiguration(testId);

            if (!testConfig) {
                throw new NotFoundException('Test not found');
            }

            // Admin testing bypass: elevated roles may validate/start attempts
            // on inactive tests. Learners cannot.
            if (
                !testConfig.isActive &&
                !this.isElevatedRole(scope.userRole)
            ) {
                return {
                    canAttempt: false,
                    reason: 'Test is not active',
                    attemptsUsed: 0,
                    maxAttempts: testConfig.maxAttempts,
                };
            }

            // Same chargeable rule as `startAttempt`, so the gate and the
            // number the UI renders can never disagree after a reset.
            const attemptsUsed = await this.countChargeableAttempts(
                testId,
                userId,
                scope,
            );

            const activeAttemptQuery = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .where('attempt.testId = :testId', { testId })
                .andWhere('attempt.userId = :userId', { userId })
                .andWhere('attempt.status = :status', {
                    status: AttemptStatus.IN_PROGRESS,
                });

            // Apply org/branch scoping
            if (scope.orgId) {
                activeAttemptQuery.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                activeAttemptQuery.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            this.applyLiveAttemptFilter(activeAttemptQuery);

            const activeAttempt = await activeAttemptQuery.getOne();

            if (activeAttempt) {
                return {
                    canAttempt: false,
                    reason: 'Active attempt already exists',
                    attemptsUsed,
                    maxAttempts: testConfig.maxAttempts,
                };
            }

            if (attemptsUsed >= testConfig.maxAttempts) {
                return {
                    canAttempt: false,
                    reason: `Maximum attempts (${testConfig.maxAttempts}) exceeded`,
                    attemptsUsed,
                    maxAttempts: testConfig.maxAttempts,
                };
            }

            return {
                canAttempt: true,
                attemptsUsed,
                maxAttempts: testConfig.maxAttempts,
            };
        });

        await this.cacheManager.set(
            cacheKey,
            result,
            this.CACHE_TTL.ATTEMPT_VALIDATION,
        );
        return result;
    }

    /**
     * Calculate and update score for an attempt
     */
    async calculateScore(
        attemptId: number,
        scope: OrgBranchScope,
    ): Promise<TestAttemptResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('attempt.answers', 'answers')
                .leftJoinAndSelect('answers.question', 'question')
                .leftJoinAndSelect('answers.selectedOption', 'selectedOption')
                .where('attempt.attemptId = :attemptId', { attemptId });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            this.applyLiveAttemptFilter(query);

            const attempt = await query.getOne();

            if (!attempt) {
                throw new NotFoundException('Test attempt not found');
            }

            if (attempt.status !== AttemptStatus.SUBMITTED) {
                throw new BadRequestException(
                    'Can only calculate score for submitted attempts',
                );
            }

            // This is a placeholder for score calculation
            // In a real implementation, you'd calculate based on answers
            // For now, we'll just update the progress to 100%
            attempt.progressPercentage = 100;

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Invalidate related caches
            await this.invalidateAttemptCache(
                attemptId,
                attempt.userId,
                attempt.testId,
                scope.orgId,
                scope.branchId,
            );

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Triggers a `training_progress` upsert for attempts that already have a `results` row.
     */
    async syncTrainingProgressSnapshot(
        attemptId: number,
        scope: OrgBranchScope,
        requesterUserId: string,
    ): Promise<void> {
        return this.retryService.executeDatabase(async () => {
            const queryBuilder = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .where('attempt.attemptId = :attemptId', { attemptId });

            if (scope.orgId) {
                queryBuilder.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                queryBuilder.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const attemptRecord = await queryBuilder.getOne();

            if (!attemptRecord) {
                throw new NotFoundException('Test attempt not found');
            }

            const isElevatedRole =
                scope.userRole === UserRole.ADMIN ||
                scope.userRole === UserRole.MASTER_ADMIN ||
                scope.userRole === UserRole.OWNER;

            if (attemptRecord.userId !== requesterUserId && !isElevatedRole) {
                throw new ForbiddenException(
                    'You can only sync training progress for your own attempts',
                );
            }

            await this.resultsService.syncTrainingProgressForAttemptId(
                attemptId,
            );
        });
    }

    /**
     * Get statistics for test attempts with caching and scoping.
     *
     * Learners see figures computed from live attempts only, so the numbers on
     * their dashboard match what a reset left them. Elevated callers keep the
     * full history.
     */
    async getStats(
        scope: OrgBranchScope,
        testId?: number,
        userId?: string,
    ): Promise<TestAttemptStatsDto> {
        const includeVoided = this.isElevatedRole(scope.userRole);
        const cacheKey = this.CACHE_KEYS.ATTEMPT_STATS(
            testId,
            userId,
            includeVoided,
            scope.orgId,
            scope.branchId,
        );

        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached as TestAttemptStatsDto;
        }

        const result = await this.retryService.executeDatabase(async () => {
            const query =
                this.testAttemptRepository.createQueryBuilder('attempt');

            // Apply org/branch scoping
            if (scope.orgId) {
                query.where('attempt.orgId = :orgId', { orgId: scope.orgId });
            }
            if (scope.branchId) {
                query.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            if (testId) {
                query.andWhere('attempt.testId = :testId', { testId });
            }
            if (userId) {
                query.andWhere('attempt.userId = :userId', { userId });
            }

            this.applyLiveAttemptFilter(query, includeVoided);

            const attempts = await query.getMany();

            const totalAttempts = attempts.length;
            const completedAttempts = attempts.filter(
                a => a.status === AttemptStatus.SUBMITTED,
            ).length;
            const inProgressAttempts = attempts.filter(
                a => a.status === AttemptStatus.IN_PROGRESS,
            ).length;
            const expiredAttempts = attempts.filter(
                a => a.status === AttemptStatus.EXPIRED,
            ).length;

            const statusBreakdown = attempts.reduce(
                (acc, attempt) => {
                    acc[attempt.status] = (acc[attempt.status] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );

            const completedWithTime = attempts.filter(
                a =>
                    a.status === AttemptStatus.SUBMITTED &&
                    a.submitTime &&
                    a.startTime,
            );

            const averageCompletionTime =
                completedWithTime.length > 0
                    ? completedWithTime.reduce((sum, attempt) => {
                          const duration =
                              attempt.submitTime!.getTime() -
                              attempt.startTime.getTime();
                          return sum + duration / (1000 * 60); // Convert to minutes
                      }, 0) / completedWithTime.length
                    : 0;

            const averageProgress =
                totalAttempts > 0
                    ? attempts.reduce(
                          (sum, attempt) => sum + attempt.progressPercentage,
                          0,
                      ) / totalAttempts
                    : 0;

            const completionRate =
                totalAttempts > 0
                    ? (completedAttempts / totalAttempts) * 100
                    : 0;

            const lastAttemptDate =
                attempts.length > 0
                    ? new Date(
                          Math.max(...attempts.map(a => a.createdAt.getTime())),
                      )
                    : new Date();

            // Pass/fail counts come from scored results, not raw attempts
            let passedAttempts = 0;
            let failedAttempts = 0;
            let averageScore = 0;
            let passRate = 0;

            if (userId) {
                const resultCounts =
                    await this.resultsService.getUserResultCounts(userId, {
                        testId,
                        scope,
                        includeVoided,
                    });
                passedAttempts = resultCounts.passedResults;
                failedAttempts = resultCounts.failedResults;
                averageScore = resultCounts.averageScore;
                passRate = resultCounts.passRate;
            }

            return {
                totalAttempts,
                completedAttempts,
                inProgressAttempts,
                expiredAttempts,
                averageCompletionTime,
                averageProgress,
                completionRate,
                lastAttemptDate,
                statusBreakdown,
                passedAttempts,
                failedAttempts,
                averageScore,
                passRate,
            };
        });

        await this.cacheManager.set(
            cacheKey,
            result,
            this.CACHE_TTL.ATTEMPT_STATS,
        );
        return result;
    }

    /**
     * Get active attempt for a test and user
     */
    async getActiveAttempt(
        testId: number,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<TestAttemptResponseDto | null> {
        return this.retryService.executeDatabase(async () => {
            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .where('attempt.testId = :testId', { testId })
                .andWhere('attempt.userId = :userId', { userId })
                .andWhere('attempt.status = :status', {
                    status: AttemptStatus.IN_PROGRESS,
                });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            this.applyLiveAttemptFilter(query);

            const activeAttempt = await query.getOne();

            if (!activeAttempt) {
                return null;
            }

            // Check if attempt has expired
            if (
                activeAttempt.expiresAt &&
                new Date() > activeAttempt.expiresAt
            ) {
                activeAttempt.status = AttemptStatus.EXPIRED;
                await this.testAttemptRepository.save(activeAttempt);

                // Invalidate related caches
                await this.invalidateAttemptCache(
                    activeAttempt.attemptId,
                    userId,
                    testId,
                    scope.orgId,
                    scope.branchId,
                );

                return null;
            }

            return this.mapToResponseDto(activeAttempt);
        });
    }

    /**
     * Get attempt with timing and progress data
     */
    async getAttemptWithProgress(
        attemptId: number,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<
        TestAttemptResponseDto & {
            timeRemaining?: number;
            timeElapsed: number;
            questionsAnswered: number;
            totalQuestions: number;
        }
    > {
        return this.retryService.executeDatabase(async () => {
            const attempt = await this.findAttemptByIdAndUserWithScope(
                attemptId,
                userId,
                scope,
            );

            const baseDto = this.mapToResponseDto(attempt);

            // Calculate timing data
            const now = new Date();
            const timeElapsed = Math.floor(
                (now.getTime() - attempt.startTime.getTime()) / 1000,
            );

            let timeRemaining: number | undefined;
            if (attempt.expiresAt) {
                timeRemaining = Math.max(
                    0,
                    Math.floor(
                        (attempt.expiresAt.getTime() - now.getTime()) / 1000,
                    ),
                );

                // If time has expired, update status
                if (
                    timeRemaining === 0 &&
                    attempt.status === AttemptStatus.IN_PROGRESS
                ) {
                    attempt.status = AttemptStatus.EXPIRED;
                    await this.testAttemptRepository.save(attempt);
                }
            }

            // Get answer count for this attempt
            const questionsAnswered = await this.answersService.countByAttempt(
                attemptId,
                scope,
            );

            // Get total questions for the test
            const totalQuestions = await this.testService.getQuestionCount(
                attempt.testId,
                scope,
            );

            return {
                ...baseDto,
                timeRemaining,
                timeElapsed,
                questionsAnswered,
                totalQuestions,
            };
        });
    }

    /**
     * Reset one learner's attempts for one test so they may sit it again.
     *
     * Everything the learner did before the reset is voided rather than
     * deleted: the audit row is the watermark, and every learner-facing read
     * path filters on it. This is an anti-cheat requirement — a submitted
     * result exposes the correct answer for every question, so a retake would
     * be worthless if the previous attempt stayed readable.
     *
     * @param resetDto - Target test, target learner and optional justification.
     * @param scope - Caller org/branch/role scope.
     * @returns The audit record plus the learner's refreshed attempt allowance.
     * @throws ForbiddenException when the caller is not elevated or the target
     * lies outside the caller's organization (branch is not restricted for
     * Admin / Owner / Master Admin).
     * @throws NotFoundException when the test or the learner does not exist.
     * @throws ConflictException when the learner has no live attempts to void.
     */
    async resetUserTestAttempts(
        resetDto: ResetTestAttemptsDto,
        scope: OrgBranchScope,
    ): Promise<TestAttemptResetResponseDto> {
        this.assertAdminAccess(scope);

        const { testId, userId } = resetDto;
        const test = await this.loadResettableTest(testId, scope);
        await this.loadResettableLearner(userId, scope);

        const liveAttempts = await this.countLiveAttempts(
            testId,
            userId,
            scope,
        );

        if (liveAttempts === 0) {
            throw new ConflictException(
                'This learner has no attempts to reset for this test',
            );
        }

        const resetId = await this.dataSource.transaction(manager =>
            this.performAttemptReset(manager, resetDto, scope, test),
        );

        // Post-commit side effects. They are deliberately outside the
        // transaction so a cache or statistics failure cannot roll back an
        // already-durable reset.
        await this.invalidateCachesAfterReset(testId, userId);

        this.logger.log(
            `Reset attempts for user ${userId} on test ${testId} (reset ${resetId}) by ${scope.userId}`,
        );

        return this.buildResetResponse(resetId, scope);
    }

    /**
     * Paginated audit history of attempt resets, newest first.
     *
     * @param scope - Caller org/branch/role scope.
     * @param filters - Optional test/learner filters and pagination.
     * @returns Reset records visible within the caller's scope.
     * @throws ForbiddenException when the caller is not elevated.
     */
    async findAttemptResets(
        scope: OrgBranchScope,
        filters: TestAttemptResetFilterDto,
    ): Promise<TestAttemptResetListResponseDto> {
        this.assertAdminAccess(scope);

        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;

        const query = this.testAttemptResetRepository
            .createQueryBuilder('reset')
            .leftJoinAndSelect('reset.test', 'test')
            .leftJoinAndSelect('reset.user', 'user')
            .leftJoinAndSelect('reset.resetByUser', 'resetByUser');

        if (scope.orgId) {
            query.andWhere('reset.orgId = :orgId', { orgId: scope.orgId });
        }
        // Elevated roles see reset history across all branches in the org.
        if (scope.branchId && !this.isElevatedRole(scope.userRole)) {
            query.andWhere('reset.branchId = :branchId', {
                branchId: scope.branchId,
            });
        }
        if (filters.testId) {
            query.andWhere('reset.testId = :filterTestId', {
                filterTestId: filters.testId,
            });
        }
        if (filters.userId) {
            query.andWhere('reset.userId = :filterUserId', {
                filterUserId: filters.userId,
            });
        }

        const [resets, total] = await query
            .orderBy('reset.resetAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        const chargeableAttempts = await this.countChargeableAttemptsForPairs(
            resets.map(reset => ({
                testId: reset.testId,
                userId: reset.userId,
            })),
            scope,
        );

        return {
            resets: resets.map(reset =>
                this.mapResetToResponseDto(
                    reset,
                    chargeableAttempts.get(
                        this.buildAttemptPairKey(reset.testId, reset.userId),
                    ) ?? 0,
                ),
            ),
            total,
            page,
            limit,
        };
    }

    /**
     * Load the target test and confirm it sits inside the caller's boundaries.
     *
     * A missing test is a 404; a test that exists in another organization or
     * branch is a 403, so an administrator cannot probe for tests they do not
     * administer.
     */
    private async loadResettableTest(
        testId: number,
        scope: OrgBranchScope,
    ): Promise<Test> {
        const test = await this.testRepository
            .createQueryBuilder('test')
            .leftJoinAndSelect('test.orgId', 'org')
            .leftJoinAndSelect('test.branchId', 'branch')
            .where('test.testId = :testId', { testId })
            .getOne();

        if (!test) {
            throw new NotFoundException('Test not found');
        }

        if (scope.orgId && test.orgId?.id !== scope.orgId) {
            throw new ForbiddenException(
                'You cannot reset attempts for a test outside your organization',
            );
        }
        // Elevated roles may reset attempts on any branch (or org-wide) test in their org.
        // Non-elevated callers still respect Method 1 org-wide visibility (NULL branchId).
        if (
            scope.branchId &&
            !this.isElevatedRole(scope.userRole) &&
            !canAccessBranchScopedContent(test.branchId?.id, scope.branchId)
        ) {
            throw new ForbiddenException(
                'You cannot reset attempts for a test outside your branch',
            );
        }

        return test;
    }

    /** Load the target learner and confirm they sit inside the caller's boundaries. */
    private async loadResettableLearner(
        userId: string,
        scope: OrgBranchScope,
    ): Promise<User> {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.orgId', 'org')
            .leftJoinAndSelect('user.branchId', 'branch')
            .where('user.id = :userId', { userId })
            .getOne();

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (scope.orgId && user.orgId?.id !== scope.orgId) {
            throw new ForbiddenException(
                'You cannot reset attempts for a learner outside your organization',
            );
        }
        // Admins / Owners / Master Admins may reset learners in any branch within the org.
        if (
            scope.branchId &&
            !this.isElevatedRole(scope.userRole) &&
            user.branchId?.id !== scope.branchId
        ) {
            throw new ForbiddenException(
                'You cannot reset attempts for a learner outside your branch',
            );
        }

        return user;
    }

    /** Count every not-yet-voided attempt, regardless of status. */
    private async countLiveAttempts(
        testId: number,
        userId: string,
        scope: OrgBranchScope,
    ): Promise<number> {
        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .where('attempt.testId = :testId', { testId })
            .andWhere('attempt.userId = :userId', { userId });

        this.applyAttemptScopeFilters(query, scope);
        this.applyLiveAttemptFilter(query);

        return query.getCount();
    }

    /**
     * Write the audit row and void the learner's history in one transaction, so
     * a partial reset — attempts hidden but results still readable — cannot
     * occur.
     *
     * @returns The identifier of the newly written reset record.
     */
    private async performAttemptReset(
        manager: EntityManager,
        resetDto: ResetTestAttemptsDto,
        scope: OrgBranchScope,
        test: Test,
    ): Promise<number> {
        const { testId, userId } = resetDto;

        const resetRecord = await manager.save(
            manager.create(TestAttemptReset, {
                testId,
                userId,
                resetByUserId: scope.userId,
                reason: resetDto.reason ?? null,
                attemptsVoided: 0,
                resultsVoided: 0,
                resetAt: new Date(),
                orgId: test.orgId,
                branchId: test.branchId ?? null,
            }),
        );

        // Attempts and results inherit the test's org/branch, so filtering on
        // (testId, userId) cannot reach another tenant's rows.
        await manager
            .createQueryBuilder()
            .update(TestAttempt)
            .set({ status: AttemptStatus.CANCELLED })
            .where('testId = :testId', { testId })
            .andWhere('userId = :userId', { userId })
            .andWhere('status = :inProgress', {
                inProgress: AttemptStatus.IN_PROGRESS,
            })
            .andWhere('voidedByResetId IS NULL')
            .execute();

        const voidedAttempts = await manager
            .createQueryBuilder()
            .update(TestAttempt)
            .set({ voidedByResetId: resetRecord.resetId })
            .where('testId = :testId', { testId })
            .andWhere('userId = :userId', { userId })
            .andWhere('voidedByResetId IS NULL')
            .execute();

        const attemptsVoided = voidedAttempts.affected ?? 0;

        // Concurrent resets: the `IS NULL` predicate makes the update
        // idempotent, so the loser voids nothing and its audit row is rolled
        // back rather than left behind as a no-op.
        if (attemptsVoided === 0) {
            throw new ConflictException(
                'This learner has no attempts to reset for this test',
            );
        }

        const voidedResults = await manager
            .createQueryBuilder()
            .update(Result)
            .set({ voidedByResetId: resetRecord.resetId })
            .where('testId = :testId', { testId })
            .andWhere('userId = :userId', { userId })
            .andWhere('voidedByResetId IS NULL')
            .execute();

        await manager.update(
            TestAttemptReset,
            { resetId: resetRecord.resetId },
            {
                attemptsVoided,
                resultsVoided: voidedResults.affected ?? 0,
            },
        );

        return resetRecord.resetId;
    }

    /**
     * Drop cached attempt and result payloads that would otherwise keep serving
     * pre-reset data.
     *
     * The attempt and result list caches are keyed by an opaque filter blob, so
     * there is no key pattern to target. Resets are rare, deliberate,
     * administrator-driven events, which makes flushing these two module-local
     * caches an acceptable price for closing the window in which a learner
     * could still read the answer key.
     */
    private async invalidateCachesAfterReset(
        testId: number,
        userId: string,
    ): Promise<void> {
        try {
            await this.cacheManager.clear();
            await this.resultsService.invalidateCachesAfterAttemptReset();
            await this.testService.refreshTestStatistics(testId);
        } catch (error) {
            this.logger.error(
                `Failed post-reset cleanup for test ${testId} and user ${userId}:`,
                error instanceof Error ? error.stack : String(error),
            );
            // The reset itself is committed; stale caches expire on their own.
        }
    }

    /** Reload a committed reset record and render it as the API response. */
    private async buildResetResponse(
        resetId: number,
        scope: OrgBranchScope,
    ): Promise<TestAttemptResetResponseDto> {
        const reset = await this.testAttemptResetRepository.findOne({
            where: { resetId },
            relations: ['test', 'user', 'resetByUser'],
        });

        if (!reset) {
            throw new NotFoundException('Reset record not found');
        }

        const chargeableAttempts = await this.countChargeableAttempts(
            reset.testId,
            reset.userId,
            scope,
        );

        return this.mapResetToResponseDto(reset, chargeableAttempts);
    }

    /** Stable map key for a (test, learner) pair. */
    private buildAttemptPairKey(testId: number, userId: string): string {
        return `${testId}:${userId}`;
    }

    /**
     * Count chargeable attempts for many (test, learner) pairs in one query,
     * keeping the reset history endpoint free of per-row lookups.
     */
    private async countChargeableAttemptsForPairs(
        pairs: ReadonlyArray<{ testId: number; userId: string }>,
        scope: OrgBranchScope,
    ): Promise<Map<string, number>> {
        const counts = new Map<string, number>();

        if (pairs.length === 0) {
            return counts;
        }

        const testIds = [...new Set(pairs.map(pair => pair.testId))];
        const userIds = [...new Set(pairs.map(pair => pair.userId))];

        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .select('attempt.testId', 'testId')
            .addSelect('attempt.userId', 'userId')
            .addSelect('COUNT(attempt.attemptId)', 'chargeableCount')
            .where('attempt.testId IN (:...testIds)', { testIds })
            .andWhere('attempt.userId IN (:...userIds)', { userIds })
            .andWhere('attempt.status != :cancelledStatus', {
                cancelledStatus: AttemptStatus.CANCELLED,
            })
            .groupBy('attempt.testId')
            .addGroupBy('attempt.userId');

        this.applyAttemptScopeFilters(query, scope);
        this.applyLiveAttemptFilter(query);

        const rows = await query.getRawMany<{
            testId: number;
            userId: string;
            chargeableCount: string;
        }>();

        for (const row of rows) {
            counts.set(
                this.buildAttemptPairKey(Number(row.testId), row.userId),
                Number(row.chargeableCount) || 0,
            );
        }

        return counts;
    }

    /** Map a reset entity plus the learner's current allowance to the API shape. */
    private mapResetToResponseDto(
        reset: TestAttemptReset,
        chargeableAttempts: number,
    ): TestAttemptResetResponseDto {
        const maxAttempts = reset.test?.maxAttempts ?? 0;

        return {
            resetId: reset.resetId,
            testId: reset.testId,
            testTitle: reset.test?.title ?? '',
            userId: reset.userId,
            userName: this.buildFullName(reset.user),
            resetByUserId: reset.resetByUserId,
            resetByName: this.buildFullName(reset.resetByUser),
            reason: reset.reason ?? null,
            attemptsVoided: reset.attemptsVoided,
            resultsVoided: reset.resultsVoided,
            resetAt: new Date(reset.resetAt).toISOString(),
            maxAttempts,
            attemptsRemaining: Math.max(0, maxAttempts - chargeableAttempts),
        };
    }

    /** Render a user's display name, tolerating partially loaded relations. */
    private buildFullName(user?: User | null): string {
        if (!user) {
            return '';
        }
        return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    }
}
