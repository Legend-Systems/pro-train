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
import { Repository, SelectQueryBuilder } from 'typeorm';
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

@Injectable()
export class ResultsService {
    private readonly logger = new Logger(ResultsService.name);

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
        private readonly leaderboardService: LeaderboardService,
        private readonly communicationsService: CommunicationsService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    async createFromAttempt(attemptId: number): Promise<ResultResponseDto> {
        try {
            this.logger.log(`Creating result from attempt ${attemptId}`);

            // Use query builder for more reliable relation loading
            const attempt = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('test.course', 'course')
                .leftJoinAndSelect('attempt.user', 'user')
                .leftJoinAndSelect('attempt.orgId', 'orgId')
                .leftJoinAndSelect('attempt.branchId', 'branchId')
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

            if (attempt.status !== AttemptStatus.SUBMITTED) {
                this.logger.warn(
                    `Attempt ${attemptId} status is ${attempt.status}, not SUBMITTED`,
                );
                throw new BadRequestException(
                    'Cannot create result for incomplete attempt',
                );
            }

            // Check if result already exists
            const existingResult = await this.resultRepository.findOne({
                where: { attemptId },
            });

            if (existingResult) {
                this.logger.warn(
                    `Result already exists for attempt ${attemptId}: ${existingResult.resultId}`,
                );
                throw new BadRequestException(
                    'Result already exists for this attempt',
                );
            }

            // Validate required data with fallback mechanism
            if (!attempt.test) {
                this.logger.warn(
                    `Test relation not loaded for attempt ${attemptId}. TestId: ${attempt.testId}. Attempting manual fetch...`,
                );

                // Fallback: manually fetch test data
                try {
                    const test = await this.testRepository
                        .createQueryBuilder('test')
                        .leftJoinAndSelect('test.course', 'course')
                        .leftJoinAndSelect('test.orgId', 'orgId')
                        .leftJoinAndSelect('test.branchId', 'branchId')
                        .where('test.testId = :testId', {
                            testId: attempt.testId,
                        })
                        .getOne();

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
            const { score, maxScore, percentage } =
                await this.calculateScore(attemptId);

            this.logger.debug(`Score calculated for attempt ${attemptId}:`, {
                score,
                maxScore,
                percentage,
            });

            // Determine if passed (assuming 60% pass rate)
            const passed = percentage >= 60;

            // Ensure we have org/branch data - inherit from attempt or use defaults
            let orgId = attempt.orgId;
            let branchId = attempt.branchId;

            // If attempt doesn't have org/branch, try to get from test or course
            if (!orgId && attempt.test?.course) {
                this.logger.debug(
                    `Attempting to inherit org/branch from test/course for attempt ${attemptId}`,
                );

                // Try to get org/branch from test first
                if (attempt.test.orgId) {
                    orgId = attempt.test.orgId;
                    this.logger.debug(`Inherited orgId from test: ${orgId.id}`);
                }

                if (attempt.test.branchId) {
                    branchId = attempt.test.branchId;
                    this.logger.debug(
                        `Inherited branchId from test: ${branchId.id}`,
                    );
                }

                // If still no org/branch, get from course
                if (!orgId && attempt.test.course.orgId) {
                    orgId = attempt.test.course.orgId;
                    this.logger.debug(
                        `Inherited orgId from course: ${orgId.id}`,
                    );
                }

                if (!branchId && attempt.test.course.branchId) {
                    branchId = attempt.test.course.branchId;
                    this.logger.debug(
                        `Inherited branchId from course: ${branchId.id}`,
                    );
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

            return this.findOne(
                savedResult.resultId,
                {
                    orgId: orgId?.id,
                    branchId: branchId?.id,
                    userId: attempt.userId,
                },
                attempt.userId,
            );
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

    async findUserResults(
        userId: string,
        scope: OrgBranchScope,
        filterDto: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
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

            return {
                results: responseResults,
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
            const queryBuilder = this.resultRepository
                .createQueryBuilder('result')
                .leftJoinAndSelect('result.user', 'user')
                .leftJoinAndSelect('result.test', 'test')
                .leftJoinAndSelect('result.course', 'course')
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
            const { score, maxScore, percentage } = await this.calculateScore(
                result.attemptId,
            );

            // Update the result
            await this.resultRepository.update(resultId, {
                score,
                maxScore,
                percentage,
                passed: percentage >= 60, // Assuming 60% pass rate
                calculatedAt: new Date(),
            });

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

    private async calculateScore(attemptId: number): Promise<{
        score: number;
        maxScore: number;
        percentage: number;
    }> {
        this.logger.debug(
            `Starting score calculation for attempt ${attemptId}`,
        );

        // Get the attempt with org/branch info for scoping
        const attempt = await this.testAttemptRepository.findOne({
            where: { attemptId },
            relations: ['test', 'orgId', 'branchId'],
        });

        if (!attempt) {
            throw new NotFoundException(`Attempt ${attemptId} not found`);
        }

        this.logger.debug(
            `Attempt found - testId: ${attempt.testId}, orgId: ${attempt.orgId?.id}, branchId: ${attempt.branchId?.id}`,
        );

        // Get all answers for the attempt with proper scoping
        const answersQuery = this.answerRepository
            .createQueryBuilder('answer')
            .leftJoinAndSelect('answer.question', 'question')
            .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
            .where('answer.attemptId = :attemptId', { attemptId });

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

        const answers = await answersQuery.getMany();
        this.logger.debug(
            `Found ${answers.length} scoped answers for attempt ${attemptId}`,
        );

        // Get all questions for the test with proper scoping
        const questionsQuery = this.questionRepository
            .createQueryBuilder('question')
            .where('question.testId = :testId', { testId: attempt.testId });

        // Apply org/branch scoping to questions
        if (attempt.orgId) {
            questionsQuery.andWhere('question.orgId = :orgId', {
                orgId: attempt.orgId.id,
            });
        }
        if (attempt.branchId) {
            questionsQuery.andWhere('question.branchId = :branchId', {
                branchId: attempt.branchId.id,
            });
        }

        const questions = await questionsQuery.getMany();
        this.logger.debug(
            `Found ${questions.length} scoped questions for test ${attempt.testId}`,
        );

        let totalScore = 0;
        let maxScore = 0;

        this.logger.debug(`Processing questions for score calculation:`);

        for (const question of questions) {
            const questionPoints = Number(question.points) || 0;
            maxScore += questionPoints;

            const answer = answers.find(
                a => a.questionId === question.questionId,
            );

            let pointsEarned = 0;

            if (answer) {
                // Check if answer has been marked with points
                if (
                    answer.pointsAwarded !== null &&
                    answer.pointsAwarded !== undefined
                ) {
                    pointsEarned = Number(answer.pointsAwarded) || 0;
                    this.logger.debug(
                        `Question ${question.questionId}: Using marked points ${pointsEarned}/${questionPoints}`,
                    );
                } else if (answer.selectedOption) {
                    // Auto-calculate for objective questions
                    const isCorrect = answer.selectedOption.isCorrect;
                    if (isCorrect) {
                        pointsEarned = questionPoints;
                    }
                    this.logger.debug(
                        `Question ${question.questionId}: Auto-calculated ${pointsEarned}/${questionPoints} (correct: ${isCorrect})`,
                    );
                } else {
                    this.logger.debug(
                        `Question ${question.questionId}: No answer or selection - 0/${questionPoints}`,
                    );
                }
            } else {
                this.logger.debug(
                    `Question ${question.questionId}: No answer found - 0/${questionPoints}`,
                );
            }

            totalScore += pointsEarned;
        }

        // Calculate percentage with proper validation
        let percentage = 0;
        if (maxScore > 0) {
            percentage = (totalScore / maxScore) * 100;
            // Round to 2 decimal places
            percentage = Math.round(percentage * 100) / 100;
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
        };
    }

    private buildFilterQuery(
        filters: Partial<ResultFilterDto>,
        scope: OrgBranchScope,
    ): SelectQueryBuilder<Result> {
        const queryBuilder = this.resultRepository
            .createQueryBuilder('result')
            // User relations with comprehensive data
            .leftJoinAndSelect('result.user', 'user')
            // Test relations with comprehensive data
            .leftJoinAndSelect('result.test', 'test')
            .leftJoinAndSelect('test.createdBy', 'testInstructor')
            // Course relations with comprehensive data
            .leftJoinAndSelect('result.course', 'course')
            .leftJoinAndSelect('course.createdBy', 'courseInstructor')
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

            // Apply org/branch scoping to questions
            if (attempt.orgId) {
                questionQuery.andWhere('question.orgId = :orgId', {
                    orgId: attempt.orgId.id,
                });
            }
            if (attempt.branchId) {
                questionQuery.andWhere('question.branchId = :branchId', {
                    branchId: attempt.branchId.id,
                });
            }

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

            // Calculate correct answers count properly
            let correctAnswersCount = 0;
            for (const answer of allAnswers) {
                // Check if answer has been marked with points
                if (
                    answer.pointsAwarded !== null &&
                    answer.pointsAwarded !== undefined &&
                    answer.pointsAwarded > 0
                ) {
                    correctAnswersCount++;
                } else if (answer.selectedOption && answer.question) {
                    // For auto-marked questions, check if the selected option is correct
                    if (answer.selectedOption.isCorrect) {
                        correctAnswersCount++;
                    }
                }
            }

            this.logger.debug(
                `Email data calculation for result ${result.resultId}:`,
                {
                    questionCount,
                    totalAnswers: allAnswers.length,
                    correctAnswersCount,
                    resultScore: result.score,
                    resultPercentage: result.percentage,
                },
            );

            // Prepare template data with proper data types and fallbacks
            const templateData = {
                recipientName:
                    `${attempt.user.firstName || ''} ${attempt.user.lastName || ''}`.trim() ||
                    'Student',
                recipientEmail: attempt.user.email || '',
                testTitle: attempt.test?.title || 'Test',
                score: Number(result.score) || 0,
                totalQuestions: questionCount || 1,
                correctAnswers: correctAnswersCount || 0,
                percentage: Number(result.percentage) || 0,
                completionTime: completionTime || 'Not available',
                resultsUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/results/${result.resultId}`,
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
            // Enhanced user data
            user: {
                id: result.user?.id,
                username: (result.user as any)?.username || result.user?.email?.split('@')[0] || 'unknown',
                firstName: result.user?.firstName,
                lastName: result.user?.lastName,
                email: result.user?.email,
                role: result.user?.role,
                status: (result.user as any)?.status || 'active',
                profilePicture: (result.user as any)?.profilePicture,
                phoneNumber: (result.user as any)?.phoneNumber,
                createdAt: result.user?.createdAt,
            },
            // Enhanced test data
            test: {
                testId: result.test?.testId,
                title: result.test?.title,
                description: result.test?.description,
                testType: result.test?.testType,
                durationMinutes: result.test?.durationMinutes,
                maxAttempts: (result.test as any)?.maxAttempts || 1,
                passingScore: (result.test as any)?.passingScore || 60,
                totalQuestions: additionalStats.totalQuestions,
                totalPoints: result.maxScore,
                status: (result.test as any)?.status || 'active',
                createdAt: result.test?.createdAt,
                instructions: (result.test as any)?.instructions,
                instructor: (result.test as any)?.createdBy ? {
                    id: (result.test as any).createdBy.id,
                    email: (result.test as any).createdBy.email,
                    // fullName will be calculated by Transform decorator
                    firstName: (result.test as any).createdBy.firstName,
                    lastName: (result.test as any).createdBy.lastName,
                    username: (result.test as any).createdBy.username,
                } : undefined,
            },
            // Enhanced course data
            course: {
                courseId: result.course?.courseId,
                title: result.course?.title,
                description: result.course?.description,
                courseCode: `COURSE-${result.course?.courseId}`,
                category: 'General',
                durationHours: 40,
                difficultyLevel: 'intermediate',
                status: result.course?.status || 'active',
                thumbnailUrl: undefined,
                enrolledStudents: additionalStats.enrolledStudents,
                createdAt: result.course?.createdAt,
                instructor: (result.course as any)?.creator ? {
                    id: (result.course as any).creator.id,
                    email: (result.course as any).creator.email,
                    // fullName will be calculated by Transform decorator
                    firstName: (result.course as any).creator.firstName,
                    lastName: (result.course as any).creator.lastName,
                    username: (result.course as any).creator.username || (result.course as any).creator.email?.split('@')[0],
                } : undefined,
            },
            // Enhanced attempt data
            attempt: {
                attemptId: result.attempt?.attemptId,
                attemptNumber: result.attempt?.attemptNumber,
                startTime: result.attempt?.startTime,
                submitTime: result.attempt?.submitTime,
                status: result.attempt?.status,
                questionsAnswered: additionalStats.questionsAnswered,
                totalQuestions: additionalStats.totalQuestions,
                // timeSpentMinutes and completionPercentage calculated by Transform decorators
            },
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
        
        // Get all questions for the test
        const questionsQuery = this.questionRepository
            .createQueryBuilder('question')
            .where('question.testId = :testId', { testId: result.testId });

        if (result.orgId) {
            questionsQuery.andWhere('question.orgId = :orgId', { orgId: result.orgId.id });
        }
        if (result.branchId) {
            questionsQuery.andWhere('question.branchId = :branchId', { branchId: result.branchId.id });
        }

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

        const incorrectAnswers = answeredQuestions - correctAnswers;
        const unansweredQuestions = totalQuestions - answeredQuestions;
        const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
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
        // Count questions for this test
        const questionsQuery = this.questionRepository
            .createQueryBuilder('question')
            .where('question.testId = :testId', { testId: result.testId });

        if (result.orgId) {
            questionsQuery.andWhere('question.orgId = :orgId', { orgId: result.orgId.id });
        }
        if (result.branchId) {
            questionsQuery.andWhere('question.branchId = :branchId', { branchId: result.branchId.id });
        }

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
