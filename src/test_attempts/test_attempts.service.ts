import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Logger,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';
import { TestAttemptResponseDto } from './dto/test-attempt-response.dto';
import { TestAttempt, AttemptStatus } from './entities/test_attempt.entity';
import { Test } from '../test/entities/test.entity';
import { User } from '../user/entities/user.entity';
import { TestAttemptStatsDto } from './dto/test-attempt-stats.dto';
import { TestAttemptFilterDto } from './dto/test-attempt-filter.dto';
import { TestAttemptListResponseDto } from './dto/test-attempt-list-response.dto';
import { ResultsService } from '../results/results.service';
import { AnswersService } from '../answers/answers.service';
import { TestService } from '../test/test.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { RetryService } from '../common/services/retry.service';

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
        ATTEMPT_STATS: (
            testId: number | undefined,
            userId: string | undefined,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:attempt:stats:test:${testId || 'all'}:user:${userId || 'all'}`,
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
    ) {}

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
                this.CACHE_KEYS.ATTEMPT_STATS(testId, userId, orgId, branchId),
            );
        }

        // Add general stats cache
        keysToDelete.push(
            this.CACHE_KEYS.ATTEMPT_STATS(
                undefined,
                undefined,
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
     */
    async startAttempt(
        createAttemptDto: CreateTestAttemptDto,
        scope: OrgBranchScope,
        userId: string,
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

            if (!test.isActive) {
                throw new BadRequestException('Test is not active');
            }

            // Check if user has an active attempt first
            const activeAttemptQuery = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .where('attempt.testId = :testId', {
                    testId: createAttemptDto.testId,
                })
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

            const activeAttempt = await activeAttemptQuery.getOne();

            // If active attempt exists, return it instead of throwing error
            if (activeAttempt) {
                this.logger.log(
                    `Returning existing active attempt ${activeAttempt.attemptId} for test ${createAttemptDto.testId} and user ${userId}`,
                );
                return this.mapToResponseDto(activeAttempt);
            }

            // Check if user has exceeded max attempts
            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .where('attempt.testId = :testId', {
                    testId: createAttemptDto.testId,
                })
                .andWhere('attempt.userId = :userId', { userId });

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

            const userAttempts = await query.getCount();

            if (userAttempts >= test.maxAttempts) {
                throw new BadRequestException(
                    `Maximum attempts (${test.maxAttempts}) exceeded for this test`,
                );
            }

            // Calculate expiration time
            const startTime = new Date();
            const expiresAt = test.durationMinutes
                ? new Date(startTime.getTime() + test.durationMinutes * 60000)
                : undefined;

            // Create new attempt
            const attempt = this.testAttemptRepository.create({
                testId: createAttemptDto.testId,
                userId,
                attemptNumber: userAttempts + 1,
                status: AttemptStatus.IN_PROGRESS,
                startTime,
                expiresAt,
                progressPercentage: 0,
                // Inherit org/branch from test
                orgId: test.orgId,
                branchId: test.branchId,
            });

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Invalidate related caches
            await this.invalidateAttemptCache(
                savedAttempt.attemptId,
                userId,
                createAttemptDto.testId,
                scope.orgId,
                scope.branchId,
            );

            this.logger.log(
                `Created new attempt ${savedAttempt.attemptId} for test ${createAttemptDto.testId} and user ${userId}`,
            );

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Submit a test attempt
     */
    async submitAttempt(
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
                    'Cannot submit attempt that is not in progress',
                );
            }

            // Update attempt status
            attempt.status = AttemptStatus.SUBMITTED;
            attempt.submitTime = new Date();
            attempt.progressPercentage = 100;

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Invalidate related caches
            await this.invalidateAttemptCache(
                attemptId,
                userId,
                attempt.testId,
                scope.orgId,
                scope.branchId,
            );

            // Trigger auto-marking and result creation flow
            try {
                this.logger.log(
                    `Starting auto-processing for attempt ${attemptId}`,
                );

                // Step 1: Auto-mark objective questions
                await this.answersService.autoMark(attemptId, scope);
                this.logger.log(
                    `Auto-marking completed for attempt ${attemptId}`,
                );

                // Step 2: Create result based on marked answers
                const result =
                    await this.resultsService.createFromAttempt(attemptId);
                this.logger.log(
                    `Result created for attempt ${attemptId}: ${result.resultId}`,
                );

                // Step 3: Refresh test statistics
                await this.testService.refreshTestStatistics(attempt.testId);
                this.logger.log(
                    `Test statistics refreshed for test ${attempt.testId}`,
                );

                this.logger.log(
                    `Auto-processing completed successfully for attempt ${attemptId}`,
                );
            } catch (error) {
                this.logger.error(
                    `Error during auto-processing for attempt ${attemptId}`,
                    error instanceof Error ? error.stack : String(error),
                );
                // Don't throw here - the attempt submission itself was successful
                // The processing can be retried later if needed
            }

            return this.mapToResponseDto(savedAttempt);
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

        await this.cacheManager.set(
            cacheKey,
            result,
            this.CACHE_TTL.USER_ATTEMPTS,
        );
        return result;
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
     * Private helper to find attempt by ID and validate user access with scope
     */
    private async findAttemptByIdAndUserWithScope(
        attemptId: number,
        userId: string,
        scope: OrgBranchScope,
    ): Promise<TestAttempt> {
        const query = this.testAttemptRepository
            .createQueryBuilder('attempt')
            .leftJoinAndSelect('attempt.test', 'test')
            .leftJoinAndSelect('attempt.test.course', 'course')
            .leftJoinAndSelect('attempt.orgId', 'orgId')
            .leftJoinAndSelect('attempt.branchId', 'branchId')
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
     * Get attempts for a specific test (instructor view) with caching and scoping
     */
    async findAttemptsByTest(
        testId: number,
        scope: OrgBranchScope,
        filters?: TestAttemptFilterDto,
    ): Promise<TestAttemptListResponseDto> {
        const filtersKey = JSON.stringify(filters || {});
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
            // Verify test exists and is accessible
            const test = await this.testService.findOne(testId, scope.userId);
            if (!test) {
                throw new NotFoundException('Test not found');
            }

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
            if (filters?.status) {
                query.andWhere('attempt.status = :status', {
                    status: filters.status,
                });
            }
            if (filters?.userId) {
                query.andWhere('attempt.userId = :userId', {
                    userId: filters.userId,
                });
            }
            if (filters?.startDateFrom) {
                query.andWhere('attempt.startTime >= :startDateFrom', {
                    startDateFrom: filters.startDateFrom,
                });
            }
            if (filters?.startDateTo) {
                query.andWhere('attempt.startTime <= :startDateTo', {
                    startDateTo: filters.startDateTo,
                });
            }

            query.orderBy('attempt.createdAt', 'DESC');

            const page = filters?.page || 1;
            const pageSize = filters?.pageSize || 10;
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

            if (!testConfig.isActive) {
                return {
                    canAttempt: false,
                    reason: 'Test is not active',
                    attemptsUsed: 0,
                    maxAttempts: testConfig.maxAttempts,
                };
            }

            const attemptsQuery = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .where('attempt.testId = :testId', { testId })
                .andWhere('attempt.userId = :userId', { userId });

            // Apply org/branch scoping
            if (scope.orgId) {
                attemptsQuery.andWhere('attempt.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                attemptsQuery.andWhere('attempt.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const attemptsUsed = await attemptsQuery.getCount();

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
     * Get statistics for test attempts with caching and scoping
     */
    async getStats(
        scope: OrgBranchScope,
        testId?: number,
        userId?: string,
    ): Promise<TestAttemptStatsDto> {
        const cacheKey = this.CACHE_KEYS.ATTEMPT_STATS(
            testId,
            userId,
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

            const activeAttempt = await query.getOne();

            if (!activeAttempt) {
                return null;
            }

            // Check if attempt has expired
            if (activeAttempt.expiresAt && new Date() > activeAttempt.expiresAt) {
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
    ): Promise<TestAttemptResponseDto & { 
        timeRemaining?: number; 
        timeElapsed: number; 
        questionsAnswered: number;
        totalQuestions: number;
    }> {
        return this.retryService.executeDatabase(async () => {
            const attempt = await this.findAttemptByIdAndUserWithScope(
                attemptId,
                userId,
                scope,
            );

            const baseDto = this.mapToResponseDto(attempt);
            
            // Calculate timing data
            const now = new Date();
            const timeElapsed = Math.floor((now.getTime() - attempt.startTime.getTime()) / 1000);
            
            let timeRemaining: number | undefined;
            if (attempt.expiresAt) {
                timeRemaining = Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000));
                
                // If time has expired, update status
                if (timeRemaining === 0 && attempt.status === AttemptStatus.IN_PROGRESS) {
                    attempt.status = AttemptStatus.EXPIRED;
                    await this.testAttemptRepository.save(attempt);
                }
            }

            // Get answer count for this attempt
            const questionsAnswered = await this.answersService.countByAttempt(attemptId, scope);
            
            // Get total questions for the test
            const totalQuestions = await this.testService.getQuestionCount(attempt.testId, scope);

            return {
                ...baseDto,
                timeRemaining,
                timeElapsed,
                questionsAnswered,
                totalQuestions,
            };
        });
    }
}
