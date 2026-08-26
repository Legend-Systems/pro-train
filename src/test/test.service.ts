import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import {
    applyBranchVisibilityToQuery,
    canAccessBranchScopedContent,
} from '../auth/utils/branch-visibility.util';
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
import { Test, TestType } from './entities/test.entity';
import {
    applyOpenExamWindowFilter,
    isExamWindowOpen,
    toNullableDate,
} from './utils/exam-window.util';
import { Question } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import {
    TestAttempt,
    AttemptStatus,
} from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { PASSING_SCORE_PERCENTAGE } from '../results/constants/passing-score.constants';
import { CourseService } from '../course/course.service';
import { Course } from '../course/entities/course.entity';
import { RetryService } from '../common/services/retry.service';
import {
    TestContentSavedEvent,
    TestCreatedEvent,
    TestActivatedEvent,
    TestAttemptStartedEvent,
    TestResultsReadyEvent,
} from '../common/events';
import { CONTENT_SAVED_EVENTS, CONTENT_TRANSLATED_EVENTS } from '../locale/translation/translation.constants';
import { hasTextChanged } from '../locale/translation/translation-text.util';
import { ContentLocalizationService } from '../locale/content-localization.service';
import { DEFAULT_LOCALE } from '../locale/locale.constants';

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
        private readonly contentLocalizationService: ContentLocalizationService,
    ) {}

    /** Bust test caches after pt-PT rows are written. */
    @OnEvent(CONTENT_TRANSLATED_EVENTS.TEST, { async: true })
    async handleTestTranslated(payload: {
        readonly testId: number;
    }): Promise<void> {
        const test = await this.testRepository.findOne({
            where: { testId: payload.testId },
            relations: ['orgId', 'branchId'],
        });
        if (!test) {
            return;
        }

        await this.invalidateTestCache(
            test.testId,
            test.courseId,
            test.orgId?.id,
            test.branchId?.id,
        );
    }

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

    /** True when the caller is a plain learner rather than an admin/owner. */
    private isLearnerScope(scope: OrgBranchScope): boolean {
        return scope.userRole?.toLowerCase() === 'user';
    }

    /**
     * Normalizes and validates the exam availability window.
     *
     * Replaces the previous single `examDate`: exam-type tests must declare
     * both boundaries so learners get an explicit multi-day window, while
     * quizzes and training tests may stay unscheduled.
     */
    private resolveExamWindow(input: {
        testType?: TestType;
        examStartDate?: Date | string | null;
        examEndDate?: Date | string | null;
    }): { examStartDate: Date | null; examEndDate: Date | null } {
        const examStartDate = toNullableDate(input.examStartDate);
        const examEndDate = toNullableDate(input.examEndDate);

        if (
            examStartDate &&
            examEndDate &&
            examStartDate.getTime() > examEndDate.getTime()
        ) {
            throw new BadRequestException(
                'Exam window is invalid: the end date must be on or after the start date',
            );
        }

        if (
            input.testType === TestType.EXAM &&
            (!examStartDate || !examEndDate)
        ) {
            throw new BadRequestException(
                'Exam tests require both an exam start date and an exam end date',
            );
        }

        return { examStartDate, examEndDate };
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
                const {
                    questions,
                    examStartDate,
                    examEndDate,
                    testThumbnail,
                    ...testData
                } = createTestDto;

                const examWindow = this.resolveExamWindow({
                    testType: createTestDto.testType,
                    examStartDate,
                    examEndDate,
                });

                const test = queryRunner.manager.create(Test, {
                    ...testData,
                    ...(testThumbnail ? { testThumbnail } : {}),
                    ...examWindow,
                    maxAttempts: createTestDto.maxAttempts || 1,
                    orgId: course.orgId,
                    branchId: course.branchId,
                });

                const savedTest = await queryRunner.manager.save(test);

                if (testThumbnail) {
                    this.logger.log(
                        `Test ${savedTest.testId} thumbnail URL saved: ${testThumbnail}`,
                    );
                }

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
                        scope.userId,
                    ),
                );

                // Nested questions/options are translated in one job after commit.
                this.eventEmitter.emit(
                    CONTENT_SAVED_EVENTS.TEST,
                    new TestContentSavedEvent(
                        savedTest.testId,
                        true,
                        course.orgId?.id ?? scope.orgId,
                        course.branchId?.id ?? scope.branchId,
                        savedTest.courseId,
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
            // Do not join questions/options here. Those OneToMany collections
            // cartesian-expand every list row and fight skip/take pagination.
            // Question counts are queried separately; full question payloads
            // belong on GET /tests/:id.

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('test.orgId = :orgId', { orgId: scope.orgId });
            }
            // Method 1: branch users see tests for their branch plus org-wide (NULL branchId).
            applyBranchVisibilityToQuery(query, 'test', scope.branchId, 'testList');

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

            // Learners only see tests whose exam window is currently open, so a
            // test disappears from their lists once examEndDate has passed.
            // They also never receive inactive tests unless they explicitly
            // filtered for them (which learner clients do not).
            // Admins keep full visibility in order to manage schedules and
            // start verification attempts on inactive / not-yet-open tests.
            if (this.isLearnerScope(scope)) {
                applyOpenExamWindowFilter(query, 'test');
                if (isActive === undefined) {
                    query.andWhere('test.isActive = :learnerActive', {
                        learnerActive: true,
                    });
                }
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
                                  creator: test.course.creator
                                      ? {
                                            id: test.course.creator.id,
                                            firstName:
                                                test.course.creator.firstName,
                                            lastName:
                                                test.course.creator.lastName,
                                            email: test.course.creator.email,
                                        }
                                      : undefined,
                                  orgId: test.course.orgId?.id,
                                  branchId: test.course.branchId?.id,
                              }
                            : undefined,
                        questionCount,
                        attemptCount,
                        userAttemptData,
                        statistics,
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
     * Aggregate attempt/result stats in SQL instead of hydrating every row.
     * Loading all attempts+results in JS (and joining them) was a major
     * contributor to GET /tests/:id timing out under production load.
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
        const [totalQuestions, attemptRow, resultRow] = await Promise.all([
            this.questionRepository.count({ where: { testId } }),
            this.testAttemptRepository
                .createQueryBuilder('attempt')
                .select('COUNT(attempt.attemptId)', 'totalAttempts')
                .addSelect('COUNT(DISTINCT attempt.userId)', 'uniqueStudents')
                .addSelect(
                    `SUM(CASE WHEN attempt.status = :submitted THEN 1 ELSE 0 END)`,
                    'completedAttempts',
                )
                .addSelect(
                    `SUM(CASE WHEN attempt.status = :inProgress THEN 1 ELSE 0 END)`,
                    'inProgressAttempts',
                )
                .addSelect(
                    `AVG(CASE WHEN attempt.status = :submitted AND attempt.startTime IS NOT NULL AND attempt.submitTime IS NOT NULL THEN TIMESTAMPDIFF(SECOND, attempt.startTime, attempt.submitTime) / 60 END)`,
                    'averageCompletionTime',
                )
                .where('attempt.testId = :testId', { testId })
                .setParameter('submitted', AttemptStatus.SUBMITTED)
                .setParameter('inProgress', AttemptStatus.IN_PROGRESS)
                .getRawOne<{
                    totalAttempts: string | number | null;
                    uniqueStudents: string | number | null;
                    completedAttempts: string | number | null;
                    inProgressAttempts: string | number | null;
                    averageCompletionTime: string | number | null;
                }>(),
            this.resultRepository
                .createQueryBuilder('result')
                .select('COUNT(result.resultId)', 'resultCount')
                .addSelect('AVG(result.score)', 'averageScore')
                .addSelect('MAX(result.percentage)', 'highestScore')
                .addSelect('MIN(result.percentage)', 'lowestScore')
                .addSelect(
                    `SUM(CASE WHEN result.percentage >= :passMark THEN 1 ELSE 0 END)`,
                    'passedCount',
                )
                .addSelect(
                    `SUM(CASE WHEN result.percentage >= 90 THEN 1 ELSE 0 END)`,
                    'bucket90',
                )
                .addSelect(
                    `SUM(CASE WHEN result.percentage >= 80 AND result.percentage < 90 THEN 1 ELSE 0 END)`,
                    'bucket80',
                )
                .addSelect(
                    `SUM(CASE WHEN result.percentage >= 70 AND result.percentage < 80 THEN 1 ELSE 0 END)`,
                    'bucket70',
                )
                .addSelect(
                    `SUM(CASE WHEN result.percentage >= 60 AND result.percentage < 70 THEN 1 ELSE 0 END)`,
                    'bucket60',
                )
                .addSelect(
                    `SUM(CASE WHEN result.percentage >= 50 AND result.percentage < 60 THEN 1 ELSE 0 END)`,
                    'bucket50',
                )
                .addSelect(
                    `SUM(CASE WHEN result.percentage < 50 THEN 1 ELSE 0 END)`,
                    'bucket0',
                )
                .where('result.testId = :testId', { testId })
                .setParameter('passMark', PASSING_SCORE_PERCENTAGE)
                .getRawOne<{
                    resultCount: string | number | null;
                    averageScore: string | number | null;
                    highestScore: string | number | null;
                    lowestScore: string | number | null;
                    passedCount: string | number | null;
                    bucket90: string | number | null;
                    bucket80: string | number | null;
                    bucket70: string | number | null;
                    bucket60: string | number | null;
                    bucket50: string | number | null;
                    bucket0: string | number | null;
                }>(),
        ]);

        const totalAttempts = this.toNumber(attemptRow?.totalAttempts);
        const completedAttempts = this.toNumber(attemptRow?.completedAttempts);
        const resultCount = this.toNumber(resultRow?.resultCount);
        const completionRate =
            totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;

        const distribution = {
            '90-100': this.toNumber(resultRow?.bucket90),
            '80-89': this.toNumber(resultRow?.bucket80),
            '70-79': this.toNumber(resultRow?.bucket70),
            '60-69': this.toNumber(resultRow?.bucket60),
            '50-59': this.toNumber(resultRow?.bucket50),
            '0-49': this.toNumber(resultRow?.bucket0),
        };

        let medianScore = 0;
        if (resultCount > 0) {
            // Median of percentages only: two middle rows when the count is even.
            const isEven = resultCount % 2 === 0;
            const offset = isEven
                ? resultCount / 2 - 1
                : Math.floor(resultCount / 2);
            const limit = isEven ? 2 : 1;
            const midRows = await this.resultRepository
                .createQueryBuilder('result')
                .select('result.percentage', 'percentage')
                .where('result.testId = :testId', { testId })
                .orderBy('result.percentage', 'ASC')
                .offset(offset)
                .limit(limit)
                .getRawMany<{ percentage: string | number | null }>();
            const values = midRows.map(row => this.toNumber(row.percentage));
            medianScore =
                values.length > 0
                    ? values.reduce((sum, value) => sum + value, 0) /
                      values.length
                    : 0;
        }

        return {
            totalQuestions,
            totalAttempts,
            uniqueStudents: this.toNumber(attemptRow?.uniqueStudents),
            completedAttempts,
            inProgressAttempts: this.toNumber(attemptRow?.inProgressAttempts),
            averageScore:
                resultCount > 0 ? this.toNumber(resultRow?.averageScore) : 0,
            medianScore,
            highestScore:
                resultCount > 0 ? this.toNumber(resultRow?.highestScore) : 0,
            lowestScore:
                resultCount > 0 ? this.toNumber(resultRow?.lowestScore) : 0,
            passRate:
                resultCount > 0
                    ? (this.toNumber(resultRow?.passedCount) / resultCount) *
                      100
                    : 0,
            completionRate,
            averageCompletionTime:
                resultCount > 0
                    ? this.toNumber(attemptRow?.averageCompletionTime)
                    : 0,
            distribution,
        };
    }

    /** mysql2 can return aggregates as strings when bigNumberStrings is enabled. */
    private toNumber(value: string | number | null | undefined): number {
        if (value === null || value === undefined) {
            return 0;
        }
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    /**
     * Confirms a test exists and the caller may access it, without loading
     * questions, attempts, or results. Attempt-list routes used to call
     * findOne() for this check, which re-ran the cartesian join under load.
     */
    async ensureTestAccessible(
        testId: number,
        scope: OrgBranchScope,
    ): Promise<void> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId },
                select: [
                    'testId',
                    'courseId',
                    'isActive',
                    'examStartDate',
                    'examEndDate',
                ],
            });

            if (!test) {
                throw new NotFoundException('Test not found');
            }

            if (scope.userId) {
                await this.validateCourseAccess(
                    test.courseId,
                    scope.userId,
                    scope,
                    false,
                );
            }

            if (
                this.isLearnerScope(scope) &&
                (!test.isActive || !isExamWindowOpen(test))
            ) {
                throw new NotFoundException('Test not found');
            }
        });
    }

    /**
     * Loads one test for take/edit/detail views.
     *
     * Relations are fetched in separate queries so TypeORM cannot JOIN
     * questions × options × attempts × results into one result set
     * (production `read ETIMEDOUT` on GET /tests/:id, e.g. test 83).
     */
    async findOne(
        id: number,
        scope?: OrgBranchScope,
        locale: string = DEFAULT_LOCALE,
    ): Promise<TestDetailDto | null> {
        return this.retryService.executeDatabase(async () => {
            // ManyToOne only — never mix independent OneToMany collections here.
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: [
                    'course',
                    'course.creator',
                    'course.orgId',
                    'course.branchId',
                    'orgId',
                    'branchId',
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

            // Learners cannot open a test that is inactive or outside its exam
            // window, so the detail view 404s the same way the listing hides it.
            // Admin/owner/master_admin keep access so they can review and start
            // verification attempts before the window opens.
            if (
                scope &&
                this.isLearnerScope(scope) &&
                (!test.isActive || !isExamWindowOpen(test))
            ) {
                return null;
            }

            // Questions×options is bounded by test content; stats are SQL aggregates.
            // Attempt/result rows belong on dedicated list/stats endpoints.
            const [statistics, questions] = await Promise.all([
                this.calculateTestStatistics(id),
                this.questionRepository.find({
                    where: { testId: id },
                    relations: ['options', 'mediaFile'],
                    order: { orderIndex: 'ASC', createdAt: 'ASC' },
                }),
            ]);

            const {
                questions: _unusedQuestions,
                testAttempts: _unusedAttempts,
                results: _unusedResults,
                trainingProgress: _unusedProgress,
                ...testFields
            } = test;

            const detail = {
                ...testFields,
                course: test.course
                    ? {
                          courseId: test.course.courseId,
                          title: test.course.title,
                          description: test.course.description,
                          creator: test.course.creator
                              ? {
                                    id: test.course.creator.id,
                                    firstName: test.course.creator.firstName,
                                    lastName: test.course.creator.lastName,
                                    email: test.course.creator.email,
                                }
                              : undefined,
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
                    mediaFile: q.mediaFile
                        ? {
                              id: q.mediaFile.id,
                              originalName: q.mediaFile.originalName,
                              url: q.mediaFile.url,
                              type: q.mediaFile.type,
                              mimeType: q.mediaFile.mimeType,
                              size: q.mediaFile.size,
                          }
                        : undefined,
                    options:
                        q.options?.map(option => ({
                            optionId: option.optionId,
                            optionText: option.optionText,
                            isCorrect: option.isCorrect,
                            orderIndex: option.orderIndex,
                        })) || [],
                })),
            };

            return this.localizeTestDetail(detail, id, locale);
        });
    }

    /**
     * Merges translation sidecar rows over English base fields for a test detail DTO.
     */
    private async localizeTestDetail<T extends TestDetailDto>(
        detail: T,
        testId: number,
        locale: string,
    ): Promise<T> {
        if (!this.contentLocalizationService.shouldLocalize(locale)) {
            return detail;
        }

        const [testTranslation, questionTranslations] = await Promise.all([
            this.contentLocalizationService.loadTestTranslation(testId, locale),
            this.contentLocalizationService.loadQuestionTranslations(
                detail.questions?.map((q) => q.questionId) ?? [],
                locale,
            ),
        ]);

        const optionIds =
            detail.questions?.flatMap(
                (q) => q.options?.map((o) => o.optionId) ?? [],
            ) ?? [];
        const optionTranslations =
            await this.contentLocalizationService.loadOptionTranslations(
                optionIds,
                locale,
            );

        const localized = this.contentLocalizationService.applyTestFields(
            detail,
            testTranslation,
        );

        if (detail.course) {
            const courseTranslation =
                await this.contentLocalizationService.loadCourseTranslation(
                    detail.course.courseId,
                    locale,
                );
            localized.course = this.contentLocalizationService.applyCourseFields(
                detail.course,
                courseTranslation,
            );
        }

        localized.questions = (detail.questions ?? []).map((question) =>
            this.contentLocalizationService.applyQuestionFields(
                question,
                questionTranslations.get(question.questionId),
                optionTranslations,
            ),
        );

        return localized;
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
                relations: ['course', 'orgId', 'branchId'],
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
            const { questions, examStartDate, examEndDate, ...restUpdateData } =
                updateTestDto;

            // Partial updates must be validated against the merged window so a
            // caller sending only one boundary cannot invert the range.
            const examWindow = this.resolveExamWindow({
                testType: updateTestDto.testType ?? test.testType,
                examStartDate:
                    examStartDate === undefined
                        ? test.examStartDate
                        : examStartDate,
                examEndDate:
                    examEndDate === undefined ? test.examEndDate : examEndDate,
            });

            const testUpdateData = {
                ...restUpdateData,
                ...(examStartDate !== undefined && {
                    examStartDate: examWindow.examStartDate,
                }),
                ...(examEndDate !== undefined && {
                    examEndDate: examWindow.examEndDate,
                }),
            };

            const previousTitle = test.title;
            const previousDescription = test.description;

            Object.assign(test, testUpdateData);
            if (updateTestDto.testThumbnail === null) {
                test.testThumbnail = undefined;
            }
            const updatedTest = await this.testRepository.save(test);

            if (updateTestDto.testThumbnail) {
                this.logger.log(
                    `Test ${id} thumbnail URL updated: ${updateTestDto.testThumbnail}`,
                );
            } else if (updateTestDto.testThumbnail === null) {
                this.logger.log(`Test ${id} thumbnail removed`);
            }

            if (!updatedTest) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            await this.invalidateTestCache(
                updatedTest.testId,
                updatedTest.courseId,
                updatedTest.orgId?.id,
                updatedTest.branchId?.id,
            );

            const titleChanged =
                updateTestDto.title !== undefined &&
                hasTextChanged(previousTitle, updatedTest.title);
            const descriptionChanged =
                updateTestDto.description !== undefined &&
                hasTextChanged(previousDescription, updatedTest.description);

            if (titleChanged || descriptionChanged) {
                this.eventEmitter.emit(
                    CONTENT_SAVED_EVENTS.TEST,
                    new TestContentSavedEvent(
                        updatedTest.testId,
                        false,
                        updatedTest.orgId?.id,
                        updatedTest.branchId?.id,
                        updatedTest.courseId,
                        {
                            title: titleChanged,
                            description: descriptionChanged,
                        },
                    ),
                );
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
                    examStartDate: test.examStartDate ?? null,
                    examEndDate: test.examEndDate ?? null,
                    isWithinExamWindow: isExamWindowOpen(test),
                },
                content: {
                    totalQuestions,
                    totalPoints,
                    // Pass mark raised from 70% default to global 80%
                    passingPercentage: PASSING_SCORE_PERCENTAGE,
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
                // Check if user has elevated permissions (admin or master_admin) within the same organization
                if (scope?.userRole && scope?.orgId) {
                    const hasElevatedPermissions =
                        scope.userRole === 'master_admin' ||
                        scope.userRole === 'admin' ||
                        scope.userRole === 'owner';

                    if (hasElevatedPermissions) {
                        // For elevated users, check if the course belongs to their organization
                        const courseOrgId = course.orgId?.id;

                        // Brandon users can edit across organizations
                        if (scope.userRole === 'master_admin') {
                            this.logger.debug(
                                `Write access granted - User ${userId} has master_admin role`,
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

                // Method 1: org-wide courses (NULL branchId) are readable by every branch.
                if (
                    scope.branchId &&
                    !canAccessBranchScopedContent(
                        course.branchId?.id,
                        scope.branchId,
                    )
                ) {
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
            // Method 1: org-wide tests (NULL branchId) are startable from any branch.
            if (
                scope.branchId &&
                !canAccessBranchScopedContent(test.branchId?.id, scope.branchId)
            ) {
                return null;
            }

            return test;
        });
    }

    /**
     * Check if test is available for attempts.
     * A test must be active *and* inside its exam window.
     */
    async isTestAvailableForAttempts(testId: number): Promise<boolean> {
        return this.retryService.executeDatabase(async () => {
            const test = await this.testRepository.findOne({
                where: { testId, isActive: true },
            });

            if (!test) {
                return false;
            }

            return isExamWindowOpen(test);
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
        examStartDate?: Date | null;
        examEndDate?: Date | null;
        isWithinExamWindow: boolean;
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
                    'examStartDate',
                    'examEndDate',
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
                examStartDate: test.examStartDate ?? null,
                examEndDate: test.examEndDate ?? null,
                isWithinExamWindow: isExamWindowOpen(test),
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
            // Method 1: include org-wide tests in scoped admin/learner listings.
            applyBranchVisibilityToQuery(
                query,
                'test',
                scope.branchId,
                'testWithStats',
            );

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
            // Only live attempts are visible to the learner. Attempts voided by
            // an admin reset must not inflate the counter or surface answer keys
            // via bestAttempt / allAttempts after a reset.
            const liveAttempts = await this.testAttemptRepository.find({
                where: { testId, userId, voidedByResetId: IsNull() },
                order: { createdAt: 'DESC' },
            });

            // Same chargeable rule as TestAttemptsService: live + not cancelled.
            const chargeableAttempts = liveAttempts.filter(
                a => a.status !== AttemptStatus.CANCELLED,
            );

            if (liveAttempts.length === 0) {
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
            const inProgressAttempt = liveAttempts.find(
                a => a.status === AttemptStatus.IN_PROGRESS,
            );
            const completedAttempts = liveAttempts.filter(
                a => a.status === AttemptStatus.SUBMITTED,
            );

            // For now, we'll get score/percentage from Results entity since TestAttempt doesn't have these fields
            let bestAttempt: any = undefined;
            if (completedAttempts.length > 0) {
                const results = await this.resultRepository.find({
                    where: {
                        testId: testId,
                        userId: userId,
                        voidedByResetId: IsNull(),
                    },
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

            // Get last attempt (most recent live attempt)
            const lastAttempt = liveAttempts[0];
            const attemptsCount = chargeableAttempts.length;
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
                allAttempts: liveAttempts.map(attempt => ({
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
            // Method 1: count questions on org-wide tests for non-owning branches.
            applyBranchVisibilityToQuery(
                query,
                'question',
                scope?.branchId,
                'questionCount',
            );

            return await query.getCount();
        });
    }
}
