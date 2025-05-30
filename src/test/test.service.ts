import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { CourseService } from '../course/course.service';
import { Course } from '../course/entities/course.entity';

@Injectable()
export class TestService {
    constructor(
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
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
        userId: string,
    ): Promise<TestResponseDto> {
        return this.retryOperation(async () => {
            // Validate course exists and user has ownership
            await this.validateCourseAccess(createTestDto.courseId, userId);

            const test = this.testRepository.create({
                ...createTestDto,
                maxAttempts: createTestDto.maxAttempts || 1,
            });

            const savedTest = await this.testRepository.save(test);

            // Get course information for response
            const course = await this.courseRepository.findOne({
                where: { courseId: createTestDto.courseId },
            });

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

    async findAll(filters: TestFilterDto): Promise<TestListResponseDto> {
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
            const testsWithCounts = tests.map(test => ({
                ...test,
                course: test.course
                    ? {
                          courseId: test.course.courseId,
                          title: test.course.title,
                          description: test.course.description,
                      }
                    : undefined,
                questionCount: 0, // TODO: Will be calculated when Question entity is available
                attemptCount: 0, // TODO: Will be calculated when TestAttempt entity is available
            }));

            return {
                tests: testsWithCounts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }

    async findOne(id: number, userId?: string): Promise<TestDetailDto | null> {
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
                relations: ['course'],
            });

            if (!test) {
                return null;
            }

            // If userId provided, validate access (course ownership or admin)
            if (userId) {
                try {
                    await this.validateCourseAccess(test.courseId, userId);
                } catch {
                    // If not owner, still allow read access for now
                    // This will be refined based on business requirements
                }
            }

            // Calculate available statistics with current entities
            const statistics = {
                totalQuestions: 0, // TODO: Will be calculated when Question entity is available
                totalAttempts: 0, // TODO: Will be calculated when TestAttempt entity is available
                uniqueStudents: 0, // TODO: Will be calculated when TestAttempt entity is available
                averageScore: 0, // TODO: Will be calculated when Result entity is available
                passRate: 0, // TODO: Will be calculated when Result entity is available
                completionRate: 0, // TODO: Will be calculated when TestAttempt entity is available
            };

            return {
                ...test,
                course: test.course
                    ? {
                          courseId: test.course.courseId,
                          title: test.course.title,
                          description: test.course.description,
                      }
                    : undefined,
                questionCount: statistics.totalQuestions,
                attemptCount: statistics.totalAttempts,
                statistics,
                questions: [], // TODO: Will be populated when Question entity is available
            };
        });
    }

    async findByCourse(courseId: number): Promise<TestListResponseDto> {
        return this.findAll({ courseId, page: 1, limit: 100 });
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

            // For now, allow deletion since we don't have TestAttempt entity yet
            // TODO: Check for existing attempts when TestAttempt entity is available
            // Example: const attemptCount = await this.testAttemptRepository.count({ where: { testId: id } });
            // if (attemptCount > 0) {
            //     throw new ForbiddenException(`Cannot delete test with ${attemptCount} existing attempts`);
            // }

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

            // Prepare statistics structure with TODOs for future implementation
            return {
                test: {
                    testId: test.testId,
                    title: test.title,
                    testType: test.testType,
                    isActive: test.isActive,
                },
                overview: {
                    totalQuestions: 0, // TODO: Calculate when Question entity is available
                    totalAttempts: 0, // TODO: Calculate when TestAttempt entity is available
                    uniqueStudents: 0, // TODO: Calculate when TestAttempt entity is available
                    completedAttempts: 0, // TODO: Calculate when TestAttempt entity is available
                    inProgressAttempts: 0, // TODO: Calculate when TestAttempt entity is available
                },
                performance: {
                    averageScore: 0, // TODO: Calculate when Result entity is available
                    medianScore: 0, // TODO: Calculate when Result entity is available
                    highestScore: 0, // TODO: Calculate when Result entity is available
                    lowestScore: 0, // TODO: Calculate when Result entity is available
                    passRate: 0, // TODO: Calculate when Result entity is available
                    averageCompletionTime: 0, // TODO: Calculate when TestAttempt entity is available
                },
                distribution: {
                    '90-100': 0, // TODO: Calculate when Result entity is available
                    '80-89': 0, // TODO: Calculate when Result entity is available
                    '70-79': 0, // TODO: Calculate when Result entity is available
                    '60-69': 0, // TODO: Calculate when Result entity is available
                    '50-59': 0, // TODO: Calculate when Result entity is available
                    '0-49': 0, // TODO: Calculate when Result entity is available
                },
            };
        });
    }

    async getConfig(id: number, userId: string): Promise<TestConfigDto> {
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId: id },
            });

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            // Validate course ownership
            await this.validateCourseAccess(test.courseId, userId);

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
                    totalQuestions: 0, // Will be calculated when Question entity is available
                    totalPoints: 0, // Will be calculated when Question entity is available
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
}
