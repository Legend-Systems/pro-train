import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';
import { TestFilterDto } from './dto/test-filter.dto';
import {
    TestResponseDto,
    TestListResponseDto,
    TestDetailDto,
    TestStatsDto,
    TestConfigDto,
} from './dto/test-response.dto';
import { Test } from './entities/test.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import {
    TestAttempt,
    AttemptStatus,
} from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { CourseService } from '../course/course.service';
import { Course } from '../course/entities/course.entity';
import { RetryService } from '../common/services/retry.service';
import {
    TestCreatedEvent,
    TestActivatedEvent,
    TestAttemptStartedEvent,
    TestResultsReadyEvent,
} from '../common/events';

@Injectable()
export class TestService {
    private readonly logger = new Logger(TestService.name);

    // Cache key patterns with org/branch scoping
    private readonly CACHE_KEYS = {
        TEST_BY_ID: (testId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}`,
        TESTS_LIST: (filters: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:tests:list:${filters}`,
        TEST_STATS: (testId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:stats:${testId}`,
        TEST_CONFIG: (testId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:config:${testId}`,
        COURSE_TESTS: (courseId: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:course:${courseId}:tests`,
        TEST_ATTEMPTS_STATS: (
            testId: number,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}:attempts:stats`,
    };

    // Cache TTL configurations (in seconds)
    private readonly CACHE_TTL = {
        TEST_DETAILS: 300, // 5 minutes - test details change moderately
        TESTS_LIST: 180, // 3 minutes - lists change more frequently
        TEST_STATS: 600, // 10 minutes - statistics change less frequently
        TEST_CONFIG: 1800, // 30 minutes - configuration rarely changes
        COURSE_TESTS: 300, // 5 minutes - course test lists
        ATTEMPTS_STATS: 300, // 5 minutes - attempt statistics
    };

    constructor(
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(QuestionOption)
        private readonly questionOptionRepository: Repository<QuestionOption>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
        private readonly courseService: CourseService,
        private readonly dataSource: DataSource,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /**
     * Cache invalidation helper for tests
     */
    private async invalidateTestCache(
        testId: number,
        courseId?: number,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.TEST_BY_ID(testId, orgId, branchId),
            this.CACHE_KEYS.TEST_STATS(testId, orgId, branchId),
            this.CACHE_KEYS.TEST_CONFIG(testId, orgId, branchId),
            this.CACHE_KEYS.TEST_ATTEMPTS_STATS(testId, orgId, branchId),
        ];

        if (courseId) {
            keysToDelete.push(
                this.CACHE_KEYS.COURSE_TESTS(courseId, orgId, branchId),
            );
        }

        // Invalidate general lists cache (with wildcard pattern approximation)
        keysToDelete.push(this.CACHE_KEYS.TESTS_LIST('*', orgId, branchId));

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
     * Create a new test with questions and options in a single transaction
     */
    async create(
        createTestDto: CreateTestDto,
        scope: OrgBranchScope,
    ): Promise<TestResponseDto> {
        return this.retryService.executeDatabase(async () => {
            // Validate course exists and user has ownership
            await this.validateCourseAccess(
                createTestDto.courseId,
                scope.userId,
            );

            // Get course information to inherit org and branch
            const course = await this.courseRepository.findOne({
                where: { courseId: createTestDto.courseId },
                relations: ['orgId', 'branchId'],
            });

            if (!course) {
                throw new NotFoundException(
                    `Course with ID ${createTestDto.courseId} not found`,
                );
            }

            // Use transaction to ensure atomic creation
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                // Create test entity (excluding questions from the test data)
                const { questions, ...testData } = createTestDto;
                const test = queryRunner.manager.create(Test, {
                    ...testData,
                    maxAttempts: createTestDto.maxAttempts || 1,
                    orgId: course.orgId,
                    branchId: course.branchId,
                });

                const savedTest = await queryRunner.manager.save(test);

                let questionCount = 0;

                // Create questions if provided
                if (questions && questions.length > 0) {
                    for (const questionDto of questions) {
                        // Create question
                        const question = queryRunner.manager.create(Question, {
                            testId: savedTest.testId,
                            questionText: questionDto.questionText,
                            questionType: questionDto.questionType,
                            points: questionDto.points,
                            orderIndex: questionDto.orderIndex,
                            explanation: questionDto.explanation,
                            hint: questionDto.hint,
                            difficulty: questionDto.difficulty || 'medium',
                            tags: questionDto.tags,
                            orgId: course.orgId,
                            branchId: course.branchId,
                        });

                        const savedQuestion =
                            await queryRunner.manager.save(question);
                        questionCount++;

                        // Create options if provided
                        if (
                            questionDto.options &&
                            questionDto.options.length > 0
                        ) {
                            for (const optionDto of questionDto.options) {
                                const option = queryRunner.manager.create(
                                    QuestionOption,
                                    {
                                        questionId: savedQuestion.questionId,
                                        optionText: optionDto.optionText,
                                        isCorrect: optionDto.isCorrect || false,
                                        orderIndex: optionDto.orderIndex,
                                        orgId: course.orgId,
                                        branchId: course.branchId,
                                    },
                                );

                                await queryRunner.manager.save(option);
                            }
                        }
                    }
                }

                await queryRunner.commitTransaction();

                // Invalidate cache
                await this.invalidateTestCache(
                    savedTest.testId,
                    savedTest.courseId,
                    scope.orgId,
                    scope.branchId,
                );

                // Emit test created event
                this.eventEmitter.emit(
                    'test.created',
                    new TestCreatedEvent(
                        savedTest.testId,
                        savedTest.title,
                        savedTest.testType,
                        savedTest.courseId,
                        course.title,
                        savedTest.durationMinutes,
                        savedTest.maxAttempts,
                        scope.orgId,
                        scope.branchId,
                        savedTest.isActive,
                    ),
                );

                return {
                    ...savedTest,
                    course: course
                        ? {
                              courseId: course.courseId,
                              title: course.title,
                              description: course.description,
                          }
                        : undefined,
                    questionCount,
                    attemptCount: 0,
                };
            } catch (error) {
                await queryRunner.rollbackTransaction();
                this.logger.error('Error creating test with questions:', error);
                throw error;
            } finally {
                await queryRunner.release();
            }
        });
    }

    async findAll(
        filters: TestFilterDto,
        scope: OrgBranchScope,
    ): Promise<TestListResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const {
                courseId,
                title,
                testType,
                isActive,
                createdAfter,
                createdBefore,
                minDuration,
                maxDuration,
                minAttempts,
                maxAttempts,
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'DESC',
                includeUserData = false,
                includeStatistics = false,
            } = filters;

            const query = this.testRepository.createQueryBuilder('test');
            query.leftJoinAndSelect('test.course', 'course');
            query.leftJoinAndSelect('course.creator', 'courseCreator');
            query.leftJoinAndSelect('course.orgId', 'courseOrg');
            query.leftJoinAndSelect('course.branchId', 'courseBranch');
            query.leftJoinAndSelect('test.orgId', 'org');
            query.leftJoinAndSelect('test.branchId', 'branch');
            query.leftJoinAndSelect('test.questions', 'questions');
            query.leftJoinAndSelect('questions.options', 'questionOptions');

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('test.orgId = :orgId', { orgId: scope.orgId });
            }
            if (scope.branchId) {
                query.andWhere('test.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            // Apply filters
            if (courseId) {
                query.andWhere('test.courseId = :courseId', { courseId });
            }

            if (title) {
                query.andWhere('test.title LIKE :title', {
                    title: `%${title}%`,
                });
            }

            if (testType) {
                query.andWhere('test.testType = :testType', { testType });
            }

            if (isActive !== undefined) {
                query.andWhere('test.isActive = :isActive', { isActive });
            }

            if (createdAfter) {
                query.andWhere('test.createdAt >= :createdAfter', {
                    createdAfter,
                });
            }

            if (createdBefore) {
                query.andWhere('test.createdAt <= :createdBefore', {
                    createdBefore,
                });
            }

            if (minDuration) {
                query.andWhere('test.durationMinutes >= :minDuration', {
                    minDuration,
                });
            }

            if (maxDuration) {
                query.andWhere('test.durationMinutes <= :maxDuration', {
                    maxDuration,
                });
            }

            if (minAttempts) {
                query.andWhere('test.maxAttempts >= :minAttempts', {
                    minAttempts,
                });
            }

            if (maxAttempts) {
                query.andWhere('test.maxAttempts <= :maxAttempts', {
                    maxAttempts,
                });
            }

            // Add sorting
            query.orderBy(`test.${sortBy}`, sortOrder);

            // Add pagination
            const skip = (page - 1) * limit;
            query.skip(skip).take(limit);

            const [tests, total] = await query.getManyAndCount();

            // Calculate actual question counts and prepare test data
            const testsWithCounts = await Promise.all(
                tests.map(async test => {
                    const questionCount = await this.questionRepository.count({
                        where: { testId: test.testId },
                    });

                    const attemptCount = await this.testAttemptRepository.count(
                        {
                            where: { testId: test.testId },
                        },
                    );

                    let userAttemptData: any = undefined;

                    // Include user-specific attempt data if requested and user is provided
                    if (includeUserData && scope.userId) {
                        userAttemptData = await this.getUserAttemptData(
                            test.testId,
                            scope.userId,
                        );
                    }

                    let statistics: any = undefined;

                    // Include detailed statistics if requested
                    if (includeStatistics) {
                        statistics = await this.calculateTestStatistics(
                            test.testId,
                        );
                    }

                    return {
                        ...test,
                        course: test.course
                            ? {
                                  courseId: test.course.courseId,
                                  title: test.course.title,
                                  description: test.course.description,
                                  creator: test.course.creator ? {
                                      id: test.course.creator.id,
                                      firstName: test.course.creator.firstName,
                                      lastName: test.course.creator.lastName,
                                      email: test.course.creator.email,
                                  } : undefined,
                                  orgId: test.course.orgId?.id,
                                  branchId: test.course.branchId?.id,
                              }
                            : undefined,
                        questionCount,
                        attemptCount,
                        userAttemptData,
                        statistics,
                        questions: test.questions?.map(q => ({
                            questionId: q.questionId,
                            questionText: q.questionText,
                            questionType: q.questionType,
                            points: q.points,
                            orderIndex: q.orderIndex,
                            difficulty: q.difficulty,
                            options: q.options?.map(option => ({
                                optionId: option.optionId,
                                optionText: option.optionText,
                                isCorrect: option.isCorrect,
                                orderIndex: option.orderIndex,
                            })) || [],
                        })) || [],
                    };
                }),
            );

            return {
                tests: testsWithCounts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }

    /**
     * Calculate comprehensive test statistics
     */
    private async calculateTestStatistics(testId: number): Promise<{
        totalQuestions: number;
        totalAttempts: number;
        uniqueStudents: number;
        completedAttempts: number;
        inProgressAttempts: number;
        averageScore: number;
        medianScore: number;
        highestScore: number;
        lowestScore: number;
        passRate: number;
        completionRate: number;
        averageCompletionTime: number;
        distribution: {
            '90-100': number;
            '80-89': number;
            '70-79': number;
            '60-69': number;
            '50-59': number;
            '0-49': number;
        };
    }> {
        // Get question count
        const totalQuestions = await this.questionRepository.count({
            where: { testId },
        });

        // Get all attempts for this test
        const attempts = await this.testAttemptRepository.find({
            where: { testId },
            relations: ['results'],
        });

        const totalAttempts = attempts.length;
        const uniqueStudents = new Set(attempts.map(a => a.userId)).size;
        const completedAttempts = attempts.filter(
            a => a.status === AttemptStatus.SUBMITTED,
        ).length;
        const inProgressAttempts = attempts.filter(
            a => a.status === AttemptStatus.IN_PROGRESS,
        ).length;

        // Calculate completion rate
        const completionRate =
            totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;

        // Get all results for completed attempts
        const results = await this.resultRepository.find({
            where: { testId },
            relations: ['attempt'],
        });

        let averageScore = 0;
        let medianScore = 0;
        let highestScore = 0;
        let lowestScore = 0;
        let passRate = 0;
        let averageCompletionTime = 0;

        const distribution = {
            '90-100': 0,
            '80-89': 0,
            '70-79': 0,
            '60-69': 0,
            '50-59': 0,
            '0-49': 0,
        };

        if (results.length > 0) {
            const scores = results.map(r => r.score || 0);
            const percentages = results.map(r => r.percentage || 0);

            // Calculate average score
            averageScore =
                scores.reduce((sum, score) => sum + score, 0) / scores.length;

            // Calculate median score
            const sortedPercentages = [...percentages].sort((a, b) => a - b);
            const mid = Math.floor(sortedPercentages.length / 2);
            medianScore =
                sortedPercentages.length % 2 !== 0
                    ? sortedPercentages[mid]
                    : (sortedPercentages[mid - 1] + sortedPercentages[mid]) / 2;

            // Calculate highest and lowest scores
            highestScore = Math.max(...percentages);
            lowestScore = Math.min(...percentages);

            // Calculate pass rate (assuming 70% is passing)
            const passingGrade = 70;
            const passedCount = percentages.filter(
                p => p >= passingGrade,
            ).length;
            passRate = (passedCount / results.length) * 100;

            // Calculate score distribution
            percentages.forEach(percentage => {
                if (percentage >= 90) distribution['90-100']++;
                else if (percentage >= 80) distribution['80-89']++;
                else if (percentage >= 70) distribution['70-79']++;
                else if (percentage >= 60) distribution['60-69']++;
                else if (percentage >= 50) distribution['50-59']++;
                else distribution['0-49']++;
            });

            // Calculate average completion time
            const completedAttemptsWithTime = attempts.filter(
                a =>
                    a.status === AttemptStatus.SUBMITTED &&
                    a.startTime &&
                    a.submitTime,
            );

            if (completedAttemptsWithTime.length > 0) {
                const totalTime = completedAttemptsWithTime.reduce(
                    (sum, attempt) => {
                        const duration =
                            attempt.submitTime!.getTime() -
                            attempt.startTime.getTime();
                        return sum + duration / (1000 * 60); // Convert to minutes
                    },
                    0,
                );
                averageCompletionTime =
                    totalTime / completedAttemptsWithTime.length;
            }
        }

        return {
            totalQuestions,
            totalAttempts,
            uniqueStudents,
            completedAttempts,
            inProgressAttempts,
            averageScore,
            medianScore,
            highestScore,
            lowestScore,
            passRate,
            completionRate,
            averageCompletionTime,
            distribution,
        };
    }

    async findOne(
        id: number,
        scope?: OrgBranchScope,
    ): Promise<TestDetailDto | null> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: [
                    'course',
                    'course.creator',
                    'course.orgId',
                    'course.branchId',
                    'orgId',
                    'branchId',
                    'questions',
                    'questions.options',
                    'questions.mediaFile',
                    'testAttempts',
                    'testAttempts.user',
                    'results',
                    'results.user',
                ],
            });

            if (!test) {
                return null;
            }

            // If scope is provided, validate access (read operation)
            if (scope?.userId) {
                await this.validateCourseAccess(
                    test.courseId,
                    scope.userId,
                    scope,
                    false,
                );
            }

            // Calculate comprehensive statistics
            const statistics = await this.calculateTestStatistics(id);

            // Get questions with proper ordering if not already loaded
            const questions = test.questions?.length 
                ? test.questions.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                : await this.questionRepository.find({
                    where: { testId: id },
                    relations: ['options', 'mediaFile'],
                    order: { orderIndex: 'ASC', createdAt: 'ASC' },
                });

            return {
                ...test,
                course: test.course
                    ? {
                          courseId: test.course.courseId,
                          title: test.course.title,
                          description: test.course.description,
                          creator: test.course.creator ? {
                              id: test.course.creator.id,
                              firstName: test.course.creator.firstName,
                              lastName: test.course.creator.lastName,
                              email: test.course.creator.email,
                          } : undefined,
                          organization: test.course.orgId,
                          branch: test.course.branchId,
                      }
                    : undefined,
                questionCount: statistics.totalQuestions,
                attemptCount: statistics.totalAttempts,
                statistics,
                questions: questions.map(q => ({
                    questionId: q.questionId,
                    questionText: q.questionText,
                    questionType: q.questionType,
                    points: q.points,
                    orderIndex: q.orderIndex,
                    explanation: q.explanation,
                    hint: q.hint,
                    difficulty: q.difficulty,
                    tags: q.tags,
                    mediaFile: q.mediaFile ? {
                        id: q.mediaFile.id,
                        originalName: q.mediaFile.originalName,
                        url: q.mediaFile.url,
                        type: q.mediaFile.type,
                        mimeType: q.mediaFile.mimeType,
                        size: q.mediaFile.size,
                    } : undefined,
                    options:
                        q.options?.map(option => ({
                            optionId: option.optionId,
                            optionText: option.optionText,
                            isCorrect: option.isCorrect,
                            orderIndex: option.orderIndex,
                        })) || [],
                })),
                testAttempts: test.testAttempts?.map(attempt => ({
                    attemptId: attempt.attemptId,
                    userId: attempt.userId,
                    attemptNumber: attempt.attemptNumber,
                    status: attempt.status,
                    startTime: attempt.startTime,
                    submitTime: attempt.submitTime,
                    progressPercentage: attempt.progressPercentage,
                    user: attempt.user ? {
                        id: attempt.user.id,
                        firstName: attempt.user.firstName,
                        lastName: attempt.user.lastName,
                        email: attempt.user.email,
                    } : undefined,
                })) || [],
                results: test.results?.map(result => ({
                    resultId: result.resultId,
                    attemptId: result.attemptId,
                    userId: result.userId,
                    score: result.score,
                    percentage: result.percentage,
                    passed: result.passed,
                    maxScore: result.maxScore,
                    calculatedAt: result.calculatedAt,
                    user: result.user ? {
                        id: result.user.id,
                        firstName: result.user.firstName,
                        lastName: result.user.lastName,
                        email: result.user.email,
                    } : undefined,
                })) || [],
            };
        });
    }

    async findByCourse(
        courseId: number,
        scope: OrgBranchScope,
    ): Promise<TestListResponseDto> {
        return this.findAll({ courseId, page: 1, limit: 100 }, scope);
    }

    async update(
        id: number,
        updateTestDto: UpdateTestDto,
        userId: string,
    ): Promise<TestResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership (write operation)
            await this.validateCourseAccess(
                test.courseId,
                userId,
                undefined,
                true,
            );

            // Exclude questions from update (questions are handled separately)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { questions, ...testUpdateData } = updateTestDto;
            const result = await this.testRepository.update(id, testUpdateData);

            if (result.affected === 0) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            const updatedTest = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!updatedTest) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            return {
                ...updatedTest,
                course: updatedTest.course
                    ? {
                          courseId: updatedTest.course.courseId,
                          title: updatedTest.course.title,
                          description: updatedTest.course.description,
                      }
                    : undefined,
                questionCount: 0,
                attemptCount: 0,
            };
        });
    }

    async remove(id: number, userId: string): Promise<void> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership (write operation)
            await this.validateCourseAccess(
                test.courseId,
                userId,
                undefined,
                true,
            );

            // Check for existing attempts
            const attemptCount = await this.testAttemptRepository.count({
                where: { testId: id },
            });

            if (attemptCount > 0) {
                throw new BadRequestException(
                    `Cannot delete test with ${attemptCount} existing attempt(s). ` +
                        `Please deactivate the test instead.`,
                );
            }

            // Check for existing questions
            const questionCount = await this.questionRepository.count({
                where: { testId: id },
            });

            if (questionCount > 0) {
                throw new BadRequestException(
                    `Cannot delete test with ${questionCount} existing question(s). ` +
                        `Please remove all questions first.`,
                );
            }

            const result = await this.testRepository.delete(id);
            if (result.affected === 0) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }
        });
    }

    async activate(id: number, userId: string): Promise<TestResponseDto> {
        return this.updateStatus(id, userId, true);
    }

    async deactivate(id: number, userId: string): Promise<TestResponseDto> {
        return this.updateStatus(id, userId, false);
    }

    private async updateStatus(
        id: number,
        userId: string,
        isActive: boolean,
    ): Promise<TestResponseDto> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership (write operation)
            await this.validateCourseAccess(
                test.courseId,
                userId,
                undefined,
                true,
            );

            await this.testRepository.update(id, { isActive });

            const updatedTest = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!updatedTest) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            return {
                ...updatedTest,
                course: updatedTest.course
                    ? {
                          courseId: updatedTest.course.courseId,
                          title: updatedTest.course.title,
                          description: updatedTest.course.description,
                      }
                    : undefined,
                questionCount: 0,
                attemptCount: 0,
            };
        });
    }

    async getStats(id: number, scope: OrgBranchScope): Promise<TestStatsDto> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course access (read operation)
            await this.validateCourseAccess(
                test.courseId,
                scope.userId,
                scope,
                false,
            );

            // Calculate comprehensive statistics
            const statistics = await this.calculateTestStatistics(id);

            return {
                test: {
                    testId: test.testId,
                    title: test.title,
                    testType: test.testType,
                    isActive: test.isActive,
                },
                overview: {
                    totalQuestions: statistics.totalQuestions,
                    totalAttempts: statistics.totalAttempts,
                    uniqueStudents: statistics.uniqueStudents,
                    completedAttempts: statistics.completedAttempts,
                    inProgressAttempts: statistics.inProgressAttempts,
                },
                performance: {
                    averageScore: statistics.averageScore,
                    medianScore: statistics.medianScore,
                    highestScore: statistics.highestScore,
                    lowestScore: statistics.lowestScore,
                    passRate: statistics.passRate,
                    averageCompletionTime: statistics.averageCompletionTime,
                },
                distribution: statistics.distribution,
            };
        });
    }

    async getConfig(id: number, scope: OrgBranchScope): Promise<TestConfigDto> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['questions'],
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course access (read operation)
            await this.validateCourseAccess(
                test.courseId,
                scope.userId,
                scope,
                false,
            );

            // Calculate question statistics
            const questions = await this.questionRepository.find({
                where: { testId: id },
            });

            const totalQuestions = questions.length;
            const totalPoints = questions.reduce(
                (sum, q) => sum + (q.points || 0),
                0,
            );

            return {
                test: {
                    testId: test.testId,
                    title: test.title,
                    courseId: test.courseId,
                },
                timing: {
                    durationMinutes: test.durationMinutes,
                    isTimeLimited: !!test.durationMinutes,
                    bufferTimeMinutes: 5, // Default buffer time
                },
                access: {
                    maxAttempts: test.maxAttempts,
                    isActive: test.isActive,
                    requiresApproval: false, // Default value
                    allowLateSubmission: false, // Default value
                },
                content: {
                    totalQuestions,
                    totalPoints,
                    passingPercentage: 70, // Default passing percentage
                    showCorrectAnswers: false, // Default value
                    shuffleQuestions: true, // Default value
                },
            };
        });
    }

    async validateCourseAccess(
        courseId: number,
        userId: string,
        scope?: OrgBranchScope,
        isWriteOperation: boolean = false,
    ): Promise<void> {
        return this.retryService.executeDatabase(async () => {
            const course = await this.courseRepository.findOne({
                where: { courseId },
                relations: ['orgId', 'branchId'],
            });

            if (!course) {
                this.logger.warn(
                    `Course validation failed - Course ${courseId} not found for user ${userId}`,
                );
                throw new NotFoundException(
                    `Course with ID ${courseId} not found`,
                );
            }

            this.logger.debug(
                `Validating course access: courseId=${courseId}, userId=${userId}, ` +
                `courseCreatedBy=${course.createdBy}, courseOrgId=${course.orgId?.id}, ` +
                `courseBranchId=${course.branchId?.id}, userOrgId=${scope?.orgId}, ` +
                `userBranchId=${scope?.branchId}, userRole=${scope?.userRole}, ` +
                `isWriteOperation=${isWriteOperation}`,
            );

            // If user is the creator, they always have access
            if (course.createdBy === userId) {
                this.logger.debug(
                    `Access granted - User ${userId} is creator of course ${courseId}`,
                );
                return;
            }

            // For write operations (create, edit, delete), require ownership or elevated permissions
            if (isWriteOperation) {
                // Check if user has elevated permissions (admin or brandon) within the same organization
                if (scope?.userRole && scope?.orgId) {
                    const hasElevatedPermissions =
                        scope.userRole === 'brandon' ||
                        scope.userRole === 'admin' ||
                        scope.userRole === 'owner';

                    if (hasElevatedPermissions) {
                        // For elevated users, check if the course belongs to their organization
                        const courseOrgId = course.orgId?.id;

                        // Brandon users can edit across organizations
                        if (scope.userRole === 'brandon') {
                            this.logger.debug(
                                `Write access granted - User ${userId} has brandon role`,
                            );
                            return;
                        }

                        // Admin and owner users can edit within their organization
                        if (courseOrgId === scope.orgId) {
                            this.logger.debug(
                                `Write access granted - User ${userId} has ${scope.userRole} role in same organization ${scope.orgId}`,
                            );
                            return;
                        }

                        this.logger.warn(
                            `Write access denied - User ${userId} with role ${scope.userRole} ` +
                            `in org ${scope.orgId} attempted to modify course ${courseId} in org ${courseOrgId}`,
                        );
                    } else {
                        this.logger.warn(
                            `Write access denied - User ${userId} has insufficient role ${scope.userRole}`,
                        );
                    }
                } else {
                    this.logger.warn(
                        `Write access denied - User ${userId} missing role or organization scope`,
                    );
                }

                throw new ForbiddenException(
                    'You are not authorized to modify this course',
                );
            }

            // For read operations, allow access within the same org/branch scope
            if (scope?.orgId || scope?.branchId) {
                // Validate organization access if orgId provided
                if (scope.orgId && course.orgId?.id !== scope.orgId) {
                    this.logger.warn(
                        `Read access denied - User ${userId} in org ${scope.orgId} ` +
                        `attempted to access course ${courseId} in org ${course.orgId?.id}`,
                    );
                    throw new ForbiddenException(
                        'Access denied: Course belongs to different organization',
                    );
                }

                // Validate branch access if branchId provided
                if (scope.branchId && course.branchId?.id !== scope.branchId) {
                    this.logger.warn(
                        `Read access denied - User ${userId} in branch ${scope.branchId} ` +
                        `attempted to access course ${courseId} in branch ${course.branchId?.id}`,
                    );
                    throw new ForbiddenException(
                        'Access denied: Course belongs to different branch',
                    );
                }

                // If we reach here, user has proper org/branch access
                this.logger.debug(
                    `Read access granted - User ${userId} has proper org/branch scope for course ${courseId}`,
                );
                return;
            }

            // If no scope provided or doesn't match, deny access
            this.logger.warn(
                `Access denied - User ${userId} has no valid scope to access course ${courseId}. ` +
                `User scope: orgId=${scope?.orgId}, branchId=${scope?.branchId}`,
            );
            throw new ForbiddenException(
                'You do not have permission to access this course',
            );
        });
    }

    /**
     * Get test information for attempt creation validation
     */
    async getTestForAttempt(
        testId: number,
        scope: OrgBranchScope,
    ): Promise<Test | null> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId },
                relations: ['course', 'orgId', 'branchId'],
            });

            if (!test) {
                return null;
            }

            // Validate org/branch access
            if (scope.orgId && test.orgId?.id !== scope.orgId) {
                return null;
            }
            if (scope.branchId && test.branchId?.id !== scope.branchId) {
                return null;
            }

            return test;
        });
    }

    /**
     * Check if test is available for attempts
     */
    async isTestAvailableForAttempts(testId: number): Promise<boolean> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId, isActive: true },
            });
            return !!test;
        });
    }

    /**
     * Get test configuration for attempt validation
     */
    async getTestConfiguration(testId: number): Promise<{
        maxAttempts: number;
        durationMinutes?: number;
        isActive: boolean;
        title: string;
        testType: string;
    } | null> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId },
                select: [
                    'testId',
                    'maxAttempts',
                    'durationMinutes',
                    'isActive',
                    'title',
                    'testType',
                ],
            });

            if (!test) {
                return null;
            }

            return {
                maxAttempts: test.maxAttempts,
                durationMinutes: test.durationMinutes,
                isActive: test.isActive,
                title: test.title,
                testType: test.testType,
            };
        });
    }

    /**
     * Update test statistics after attempt completion
     */
    async refreshTestStatistics(testId: number): Promise<void> {
        return this.retryService.executeDatabase(async () => {
            // This method can be called to refresh cached statistics
            // For now, we'll just verify the test exists
            const test = await this.testRepository.findOne({
                where: { testId },
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${testId} not found`);
            }

            // In the future, we could add caching invalidation logic here
            this.logger.log(`Statistics refreshed for test ${testId}`);
        });
    }

    /**
     * Get tests with attempt statistics for reporting
     */
    async getTestsWithAttemptStats(
        scope: OrgBranchScope,
        courseId?: number,
    ): Promise<
        Array<{
            testId: number;
            title: string;
            testType: string;
            isActive: boolean;
            createdAt: Date;
            totalAttempts: number;
            completedAttempts: number;
            averageScore: number;
            passRate: number;
        }>
    > {
        return this.retryService.executeDatabase(async () => {
            const query = this.testRepository
                .createQueryBuilder('test')
                .leftJoinAndSelect('test.course', 'course');

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('test.orgId = :orgId', { orgId: scope.orgId });
            }
            if (scope.branchId) {
                query.andWhere('test.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            if (courseId) {
                query.andWhere('test.courseId = :courseId', { courseId });
            }

            query.orderBy('test.createdAt', 'DESC');

            const tests = await query.getMany();

            const testsWithStats = await Promise.all(
                tests.map(async test => {
                    const stats = await this.calculateTestStatistics(
                        test.testId,
                    );
                    return {
                        testId: test.testId,
                        title: test.title,
                        testType: test.testType,
                        isActive: test.isActive,
                        createdAt: test.createdAt,
                        totalAttempts: stats.totalAttempts,
                        completedAttempts: stats.completedAttempts,
                        averageScore: stats.averageScore,
                        passRate: stats.passRate,
                    };
                }),
            );

            return testsWithStats;
        });
    }

    /**
     * Get user-specific attempt data for a test
     */
    private async getUserAttemptData(testId: number, userId: string) {
        try {
            // Get all user attempts for this test
            const allAttempts = await this.testAttemptRepository.find({
                where: { testId, userId },
                order: { createdAt: 'DESC' },
            });

            if (allAttempts.length === 0) {
                return {
                    attemptsCount: 0,
                    attemptsRemaining: await this.getMaxAttemptsForTest(testId),
                    canStartNewAttempt: true,
                    nextAttemptNumber: 1,
                    attemptLimitReached: false,
                    allAttempts: [],
                };
            }

            const maxAttempts = await this.getMaxAttemptsForTest(testId);
            const inProgressAttempt = allAttempts.find(
                a => a.status === AttemptStatus.IN_PROGRESS,
            );
            const completedAttempts = allAttempts.filter(
                a => a.status === AttemptStatus.SUBMITTED,
            );

            // For now, we'll get score/percentage from Results entity since TestAttempt doesn't have these fields
            let bestAttempt: any = undefined;
            if (completedAttempts.length > 0) {
                const results = await this.resultRepository.find({
                    where: { testId: testId, userId: userId },
                    order: { percentage: 'DESC' },
                });

                if (results.length > 0) {
                    const bestResult = results[0];
                    bestAttempt = {
                        attemptId: bestResult.attemptId,
                        score: bestResult.score || 0,
                        percentage: bestResult.percentage || 0,
                        submittedAt:
                            bestResult.calculatedAt?.toISOString() || '',
                        timeSpent: 0, // Not available in Result entity
                    };
                }
            }

            // Get last attempt (most recent)
            const lastAttempt = allAttempts[0];
            const attemptsCount = allAttempts.length;
            const attemptsRemaining = Math.max(0, maxAttempts - attemptsCount);
            const canStartNewAttempt =
                !inProgressAttempt && attemptsRemaining > 0;
            const attemptLimitReached =
                attemptsRemaining === 0 && !inProgressAttempt;

            return {
                attemptsCount,
                attemptsRemaining,
                lastAttempt: lastAttempt
                    ? {
                          attemptId: lastAttempt.attemptId,
                          status: lastAttempt.status,
                          score: 0, // Will be populated from results
                          percentage: 0, // Will be populated from results
                          submittedAt: lastAttempt.submitTime?.toISOString(),
                          timeSpent: 0, // Will be calculated from start/end time
                          currentQuestionIndex: 0, // Will be tracked separately
                          progressPercentage:
                              lastAttempt.progressPercentage || 0,
                          questionsAnswered: 0, // Will be calculated from answers
                          flaggedQuestions: [], // Will be tracked separately
                          lastActivity: lastAttempt.updatedAt.toISOString(),
                      }
                    : undefined,
                inProgressAttempt: inProgressAttempt
                    ? {
                          attemptId: inProgressAttempt.attemptId,
                          testId: inProgressAttempt.testId,
                          userId: inProgressAttempt.userId,
                          attemptNumber: inProgressAttempt.attemptNumber,
                          status: inProgressAttempt.status,
                          startTime: inProgressAttempt.startTime.toISOString(),
                          submitTime:
                              inProgressAttempt.submitTime?.toISOString(),
                          expiresAt: inProgressAttempt.expiresAt?.toISOString(),
                          progressPercentage:
                              inProgressAttempt.progressPercentage || 0,
                          createdAt: inProgressAttempt.createdAt.toISOString(),
                          updatedAt: inProgressAttempt.updatedAt.toISOString(),
                          resumeUrl: `/dashboard/tests/${testId}/take`,
                          timeElapsed: 0, // Calculate from start time
                          currentProgress:
                              inProgressAttempt.progressPercentage || 0,
                          canResume: true,
                      }
                    : undefined,
                bestAttempt,
                allAttempts: allAttempts.map(attempt => ({
                    attemptId: attempt.attemptId,
                    attemptNumber: attempt.attemptNumber,
                    status: attempt.status,
                    score: 0, // Will be populated from results
                    percentage: 0, // Will be populated from results
                    timeSpent: 0, // Will be calculated
                    submittedAt: attempt.submitTime?.toISOString(),
                    isExpired: attempt.expiresAt
                        ? new Date() > attempt.expiresAt
                        : false,
                })),
                canStartNewAttempt,
                nextAttemptNumber: attemptsCount + 1,
                attemptLimitReached,
            };
        } catch (error) {
            this.logger.error(
                `Error getting user attempt data for test ${testId} and user ${userId}:`,
                error,
            );
            return {
                attemptsCount: 0,
                attemptsRemaining: 1,
                canStartNewAttempt: true,
                nextAttemptNumber: 1,
                attemptLimitReached: false,
                allAttempts: [],
            };
        }
    }

    /**
     * Get max attempts allowed for a test
     */
    private async getMaxAttemptsForTest(testId: number): Promise<number> {
        const test = await this.testRepository.findOne({
            where: { testId },
            select: ['maxAttempts'],
        });
        return test?.maxAttempts || 1;
    }

    /**
     * Get question count for a test
     */
    async getQuestionCount(
        testId: number,
        scope?: OrgBranchScope,
    ): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const query = this.questionRepository
                .createQueryBuilder('question')
                .where('question.testId = :testId', { testId });

            // Apply org/branch scoping if scope is provided
            if (scope?.orgId) {
                query.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope?.branchId) {
                query.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            return await query.getCount();
        });
    }
}
