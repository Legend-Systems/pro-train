import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import {
    TestAttempt,
    AttemptStatus,
} from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { CourseService } from '../course/course.service';
import { Course } from '../course/entities/course.entity';

@Injectable()
export class TestService {
    private readonly logger = new Logger(TestService.name);

    constructor(
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        private readonly courseService: CourseService,
    ) {}

    private async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries = 3,
        delay = 1000,
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                const isConnectionError =
                    error instanceof Error &&
                    (error.message.includes('ECONNRESET') ||
                        error.message.includes('Connection lost') ||
                        error.message.includes('connect ETIMEDOUT'));

                if (isConnectionError && attempt < maxRetries) {
                    console.log(
                        `Database connection error on attempt ${attempt}, retrying in ${delay}ms...`,
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
        throw new Error('Max retries exceeded');
    }

    async create(
        createTestDto: CreateTestDto,
        scope: OrgBranchScope,
    ): Promise<TestResponseDto> {
        return this.retryOperation(async () => {
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

            const test = this.testRepository.create({
                ...createTestDto,
                maxAttempts: createTestDto.maxAttempts || 1,
                orgId: course.orgId,
                branchId: course.branchId,
            });

            const savedTest = await this.testRepository.save(test);

            return {
                ...savedTest,
                course: course
                    ? {
                          courseId: course.courseId,
                          title: course.title,
                          description: course.description,
                      }
                    : undefined,
                questionCount: 0,
                attemptCount: 0,
            };
        });
    }

    async findAll(
        filters: TestFilterDto,
        scope: OrgBranchScope,
    ): Promise<TestListResponseDto> {
        return this.retryOperation(async () => {
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
            } = filters;

            const query = this.testRepository.createQueryBuilder('test');
            query.leftJoinAndSelect('test.course', 'course');
            query.leftJoinAndSelect('test.orgId', 'org');
            query.leftJoinAndSelect('test.branchId', 'branch');

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

                    return {
                        ...test,
                        course: test.course
                            ? {
                                  courseId: test.course.courseId,
                                  title: test.course.title,
                                  description: test.course.description,
                              }
                            : undefined,
                        questionCount,
                        attemptCount,
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

    async findOne(id: number, userId?: string): Promise<TestDetailDto | null> {
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: [
                    'course',
                    'course.orgId',
                    'course.branchId',
                    'orgId',
                    'branchId',
                ],
            });

            if (!test) {
                return null;
            }

            // If userId is provided, validate access
            if (userId) {
                await this.validateCourseAccess(test.courseId, userId);
            }

            // Calculate comprehensive statistics
            const statistics = await this.calculateTestStatistics(id);

            // Get questions for this test
            const questions = await this.questionRepository.find({
                where: { testId: id },
                relations: ['options'],
                order: { createdAt: 'ASC' },
            });

            return {
                ...test,
                course: test.course
                    ? {
                          courseId: test.course.courseId,
                          title: test.course.title,
                          description: test.course.description,
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
                })),
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
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership
            await this.validateCourseAccess(test.courseId, userId);

            const result = await this.testRepository.update(id, updateTestDto);

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
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership
            await this.validateCourseAccess(test.courseId, userId);

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
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership
            await this.validateCourseAccess(test.courseId, userId);

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

    async getStats(id: number, userId: string): Promise<TestStatsDto> {
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership
            await this.validateCourseAccess(test.courseId, userId);

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

    async getConfig(id: number, userId: string): Promise<TestConfigDto> {
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['questions'],
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership
            await this.validateCourseAccess(test.courseId, userId);

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
    ): Promise<void> {
        return this.retryOperation(async () => {
            const course = await this.courseRepository.findOne({
                where: { courseId },
            });

            if (!course) {
                throw new NotFoundException(
                    `Course with ID ${courseId} not found`,
                );
            }

            if (course.createdBy !== userId) {
                throw new ForbiddenException(
                    'You do not have permission to access this course',
                );
            }
        });
    }

    /**
     * Get test information for attempt creation validation
     */
    async getTestForAttempt(
        testId: number,
        scope: OrgBranchScope,
    ): Promise<Test | null> {
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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
        return this.retryOperation(async () => {
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
}
