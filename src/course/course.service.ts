import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Inject,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import {
    CourseListResponseDto,
    CourseDetailDto,
    CourseStatsDto,
    StandardOperationResponse,
    CourseCreatorDto,
} from './dto/course-response.dto';
import { Course, CourseStatus } from './entities/course.entity';
import { Test } from '../test/entities/test.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { UserService } from '../user/user.service';
import { OrgBranchScopingService } from '../auth/services/org-branch-scoping.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CourseCreatedEvent } from '../common/events';

@Injectable()
export class CourseService {
    private readonly logger = new Logger(CourseService.name);

    // Cache keys with comprehensive coverage
    private readonly CACHE_KEYS = {
        COURSE_BY_ID: (id: number) => `course:${id}`,
        COURSES_BY_ORG: (orgId: string, filters: string) =>
            `courses:org:${orgId}:${filters}`,
        COURSES_BY_BRANCH: (branchId: string, filters: string) =>
            `courses:branch:${branchId}:${filters}`,
        COURSES_BY_CREATOR: (userId: string, filters: string) =>
            `courses:creator:${userId}:${filters}`,
        COURSE_STATS: (courseId: number) => `course:stats:${courseId}`,
        COURSE_LIST: (filters: string) => `courses:list:${filters}`,
        USER_COURSES: (userId: string) => `user:${userId}:courses`,
        ALL_COURSES: 'courses:all',
        COURSE_DETAIL: (id: number) => `course:detail:${id}`,
        COURSE_TESTS_COUNT: (courseId: number) =>
            `course:tests:count:${courseId}`,
        COURSE_STUDENTS_COUNT: (courseId: number) =>
            `course:students:count:${courseId}`,
    };

    // Cache TTL in seconds with different durations for different data types
    private readonly CACHE_TTL = {
        COURSE: 300, // 5 minutes
        COURSE_LIST: 180, // 3 minutes
        STATS: 600, // 10 minutes
        COUNTS: 120, // 2 minutes
        USER_DATA: 240, // 4 minutes
        ALL_COURSES: 900, // 15 minutes
        COURSE_DETAIL: 300, // 5 minutes
    };

    constructor(
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        private readonly userService: UserService,
        private readonly orgBranchScopingService: OrgBranchScopingService,
        private readonly eventEmitter: EventEmitter2,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
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
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                throw error;
            }
        }
        throw new Error('Max retries exceeded');
    }

    /**
     * Cache helper methods
     */
    private async invalidateCourseCache(
        courseId: number,
        userId?: string,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.COURSE_BY_ID(courseId),
            this.CACHE_KEYS.COURSE_DETAIL(courseId),
            this.CACHE_KEYS.COURSE_STATS(courseId),
            this.CACHE_KEYS.COURSE_TESTS_COUNT(courseId),
            this.CACHE_KEYS.COURSE_STUDENTS_COUNT(courseId),
        ];

        if (userId) {
            keysToDelete.push(this.CACHE_KEYS.USER_COURSES(userId));
        }

        // Also invalidate general course lists
        keysToDelete.push(this.CACHE_KEYS.ALL_COURSES);

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

    private async invalidateCourseListCaches(): Promise<void> {
        // Note: This is a simplified approach. In production, you might want to
        // maintain a list of active org/branch cache keys or use cache tags
        // For now, we'll just clear specific pattern-based keys
        // await this.cacheManager.reset(); // This method might not exist in all cache implementations
    }

    private async invalidateUserCoursesCache(userId: string): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.USER_COURSES(userId),
            this.CACHE_KEYS.ALL_COURSES,
        ];

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

    private generateCacheKeyForCourses(
        filters?: CourseFilterDto,
        prefix: string = 'list',
    ): string {
        const filterKey = JSON.stringify({
            title: filters?.title,
            createdBy: filters?.createdBy,
            createdAfter: filters?.createdAfter,
            createdBefore: filters?.createdBefore,
            page: filters?.page,
            limit: filters?.limit,
            sortBy: filters?.sortBy,
            sortOrder: filters?.sortOrder,
        });
        return `${this.CACHE_KEYS.COURSE_LIST(filterKey)}:${prefix}`;
    }

    async create(
        createCourseDto: CreateCourseDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate user exists
            const user = await this.userService.findById(scope.userId);
            if (!user) {
                throw new NotFoundException(
                    `User with ID ${scope.userId} not found`,
                );
            }

            const course = this.courseRepository.create({
                ...createCourseDto,
                createdBy: scope.userId,
                orgId: scope.orgId ? { id: scope.orgId } : undefined,
                branchId: scope.branchId ? { id: scope.branchId } : undefined,
            });

            const savedCourse = await this.courseRepository.save(course);

            // Invalidate list caches since a new course was created
            await this.invalidateCourseListCaches();

            // Emit course created event
            this.eventEmitter.emit(
                'course.created',
                new CourseCreatedEvent(
                    savedCourse.courseId,
                    savedCourse.title,
                    savedCourse.description || '',
                    user.id,
                    user.email,
                    user.firstName,
                    user.lastName,
                    scope.orgId,
                    user.orgId?.name,
                    scope.branchId,
                    user.branchId?.name,
                ),
            );

            this.logger.log(
                `Course ${savedCourse.courseId} created successfully by user ${scope.userId}`,
            );

            return {
                message: 'Course created successfully',
                status: 'success',
                code: 201,
            };
        });
    }

    async findAll(
        filters: CourseFilterDto,
        scope?: OrgBranchScope,
    ): Promise<CourseListResponseDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.generateCacheKeyForCourses(filters, 'all');

            const cachedResult =
                await this.cacheManager.get<CourseListResponseDto>(cacheKey);

            if (cachedResult) {
                return cachedResult;
            }

            const {
                title,
                createdBy,
                createdAfter,
                createdBefore,
                page = 1,
                limit = 10,
                sortBy = 'createdAt',
                sortOrder = 'DESC',
            } = filters;

            const query = this.courseRepository.createQueryBuilder('course');
            query.leftJoinAndSelect('course.creator', 'creator');
            query.leftJoinAndSelect('course.orgId', 'org');
            query.leftJoinAndSelect('course.branchId', 'branch');

            // Filter by status - only show active courses by default
            query.andWhere('course.status = :status', {
                status: CourseStatus.ACTIVE,
            });

            // Apply org/branch scoping
            if (scope?.orgId) {
                query.andWhere('course.orgId = :orgId', { orgId: scope.orgId });
            }
            if (scope?.branchId) {
                query.andWhere('course.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            // Apply filters
            if (title) {
                query.andWhere('course.title LIKE :title', {
                    title: `%${title}%`,
                });
            }

            if (createdBy) {
                query.andWhere('course.createdBy = :createdBy', {
                    createdBy,
                });
            }

            if (createdAfter) {
                query.andWhere('course.createdAt >= :createdAfter', {
                    createdAfter,
                });
            }

            if (createdBefore) {
                query.andWhere('course.createdAt <= :createdBefore', {
                    createdBefore,
                });
            }

            // Add sorting
            query.orderBy(`course.${sortBy}`, sortOrder);

            // Add pagination
            const skip = (page - 1) * limit;
            query.skip(skip).take(limit);

            const [courses, total] = await query.getManyAndCount();

            // Calculate actual test counts for each course with caching and map creator
            const coursesWithCounts = await Promise.all(
                courses.map(async course => {
                    const testCount = await this.getCachedTestCount(
                        course.courseId,
                    );
                    const studentCount = await this.getCachedStudentCount(
                        course.courseId,
                    );

                    // Map User entity to simplified CourseCreatorDto
                    const creatorDto: CourseCreatorDto | undefined =
                        course.creator
                            ? {
                                  id: course.creator.id,
                                  email: course.creator.email,
                                  firstName: course.creator.firstName,
                                  lastName: course.creator.lastName,
                                  role: course.creator.role,
                              }
                            : undefined;

                    return {
                        ...course,
                        creator: creatorDto,
                        testCount,
                        studentCount,
                    };
                }),
            );

            const result = {
                courses: coursesWithCounts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.COURSE_LIST * 1000,
            );

            return result;
        });
    }

    async findOne(
        id: number,
        scope?: OrgBranchScope,
    ): Promise<CourseDetailDto | null> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.COURSE_DETAIL(id);

            const cachedCourse =
                await this.cacheManager.get<CourseDetailDto>(cacheKey);

            if (cachedCourse) {
                return cachedCourse;
            }

            const query = this.courseRepository.createQueryBuilder('course');
            query.leftJoinAndSelect('course.creator', 'creator');
            query.leftJoinAndSelect('course.orgId', 'org');
            query.leftJoinAndSelect('course.branchId', 'branch');
            query.leftJoinAndSelect(
                'course.courseMaterials',
                'courseMaterials',
            );
            query.where('course.courseId = :id', { id });

            // Filter by status - only show active courses by default
            query.andWhere('course.status = :status', {
                status: CourseStatus.ACTIVE,
            });

            // Apply org/branch scoping
            if (scope?.orgId) {
                query.andWhere('course.orgId = :orgId', { orgId: scope.orgId });
            }
            if (scope?.branchId) {
                query.andWhere('course.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const course = await query.getOne();

            if (!course) {
                return null;
            }

            // Get statistics with caching
            const stats = await this.getStats(id);

            // Map User entity to simplified CourseCreatorDto to avoid complex nested structures
            const creatorDto: CourseCreatorDto | undefined = course.creator
                ? {
                      id: course.creator.id,
                      email: course.creator.email,
                      firstName: course.creator.firstName,
                      lastName: course.creator.lastName,
                      role: course.creator.role,
                  }
                : undefined;

            const result: CourseDetailDto = {
                ...course,
                creator: creatorDto,
                testCount: stats.totalTests,
                studentCount: stats.uniqueStudents,
                statistics: {
                    totalTests: stats.totalTests,
                    activeTests: stats.activeTests,
                    totalAttempts: stats.totalAttempts,
                    averageScore: stats.averageScore,
                },
            };

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.COURSE_DETAIL * 1000,
            );

            return result;
        });
    }

    async findByCreator(
        userId: string,
        filters: Partial<CourseFilterDto>,
        scope?: OrgBranchScope,
    ): Promise<CourseListResponseDto> {
        const fullFilters = { ...filters, createdBy: userId };
        return this.findAll(fullFilters as CourseFilterDto, scope);
    }

    async update(
        id: number,
        updateCourseDto: UpdateCourseDto,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const course = await this.findById(id);
            if (!course) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            // Validate ownership
            await this.validateOwnership(id, userId);

            Object.assign(course, updateCourseDto);
            await this.courseRepository.save(course);

            // Invalidate course cache
            await this.invalidateCourseCache(id, userId);

            this.logger.log(
                `Course ${id} updated successfully by user ${userId}`,
            );

            return {
                message: 'Course updated successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    async remove(
        id: number,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const course = await this.findById(id);
            if (!course) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            // Validate ownership
            await this.validateOwnership(id, userId);

            // Check if course has tests
            const testCount = await this.getCachedTestCount(id);
            if (testCount > 0) {
                throw new ForbiddenException(
                    'Cannot delete course that has tests',
                );
            }

            await this.courseRepository.remove(course);

            // Invalidate course cache
            await this.invalidateCourseCache(id, userId);
            await this.invalidateCourseListCaches();

            this.logger.log(
                `Course ${id} deleted successfully by user ${userId}`,
            );

            return {
                message: 'Course deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    async getStats(id: number): Promise<CourseStatsDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.COURSE_STATS(id);

            const cachedStats =
                await this.cacheManager.get<CourseStatsDto>(cacheKey);

            if (cachedStats) {
                return cachedStats;
            }

            const course = await this.findById(id);
            if (!course) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            // Get tests for this course
            const tests = await this.testRepository.find({
                where: { courseId: id },
            });

            const totalTests = tests.length;
            const activeTests = tests.filter(test => test.isActive).length;

            let totalAttempts = 0;
            let uniqueStudents = 0;
            let averageScore = 0;
            let passRate = 0;
            let lastActivityAt: Date | undefined;

            if (totalTests > 0) {
                const testIds = tests.map(test => test.testId);

                // Get all attempts for these tests
                const attempts = await this.testAttemptRepository
                    .createQueryBuilder('attempt')
                    .where('attempt.testId IN (:...testIds)', { testIds })
                    .getMany();

                totalAttempts = attempts.length;

                if (totalAttempts > 0) {
                    // Count unique students
                    const uniqueUserIds = new Set(
                        attempts.map(attempt => attempt.userId),
                    );
                    uniqueStudents = uniqueUserIds.size;

                    // Get results for these attempts
                    const results = await this.resultRepository
                        .createQueryBuilder('result')
                        .innerJoin('result.testAttempt', 'attempt')
                        .where('attempt.testId IN (:...testIds)', { testIds })
                        .getMany();

                    if (results.length > 0) {
                        const totalScore = results.reduce(
                            (sum, result) => sum + result.score,
                            0,
                        );
                        averageScore = totalScore / results.length;

                        // Calculate pass rate (assuming 60% is passing)
                        const passedResults = results.filter(
                            result => result.score >= 60,
                        );
                        passRate =
                            (passedResults.length / results.length) * 100;
                    }

                    // Get last activity
                    const lastAttempt = attempts.sort(
                        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
                    )[0];
                    lastActivityAt = lastAttempt?.createdAt;
                }
            }

            const result: CourseStatsDto = {
                courseId: id,
                totalTests,
                activeTests,
                totalAttempts,
                uniqueStudents,
                averageScore: Math.round(averageScore * 100) / 100,
                passRate: Math.round(passRate * 100) / 100,
                lastActivityAt,
            };

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.STATS * 1000,
            );

            return result;
        });
    }

    async validateOwnership(courseId: number, userId: string): Promise<void> {
        const course = await this.findById(courseId);
        if (!course) {
            throw new NotFoundException(`Course with ID ${courseId} not found`);
        }

        if (course.createdBy !== userId) {
            throw new ForbiddenException(
                'You are not authorized to modify this course',
            );
        }
    }

    async findById(id: number): Promise<Course | null> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.COURSE_BY_ID(id);

            const cachedCourse = await this.cacheManager.get<Course>(cacheKey);

            if (cachedCourse) {
                return cachedCourse;
            }

            const course = await this.courseRepository.findOne({
                where: { courseId: id, status: CourseStatus.ACTIVE },
                relations: ['creator', 'orgId', 'branchId', 'courseMaterials'],
            });

            if (course) {
                // Cache the result
                await this.cacheManager.set(
                    cacheKey,
                    course,
                    this.CACHE_TTL.COURSE * 1000, // Convert to milliseconds
                );
            }

            return course;
        });
    }

    async exists(id: number): Promise<boolean> {
        const course = await this.findById(id);
        return !!course;
    }

    async findByOrganization(orgId: string): Promise<Course[]> {
        return this.retryOperation(async () => {
            return this.courseRepository.find({
                where: { orgId: { id: orgId }, status: CourseStatus.ACTIVE },
                relations: ['creator', 'orgId', 'branchId'],
            });
        });
    }

    async findByBranch(branchId: string): Promise<Course[]> {
        return this.retryOperation(async () => {
            return this.courseRepository.find({
                where: { branchId: { id: branchId }, status: CourseStatus.ACTIVE },
                relations: ['creator', 'orgId', 'branchId'],
            });
        });
    }

    // Helper methods for cached counts
    private async getCachedTestCount(courseId: number): Promise<number> {
        const cacheKey = this.CACHE_KEYS.COURSE_TESTS_COUNT(courseId);

        const cachedCount = await this.cacheManager.get<number>(cacheKey);
        if (cachedCount !== undefined && cachedCount !== null) {
            return cachedCount;
        }

        const count = await this.testRepository.count({
            where: { courseId },
        });

        await this.cacheManager.set(
            cacheKey,
            count,
            this.CACHE_TTL.COUNTS * 1000,
        );

        return count;
    }

    private async getCachedStudentCount(courseId: number): Promise<number> {
        const cacheKey = this.CACHE_KEYS.COURSE_STUDENTS_COUNT(courseId);

        const cachedCount = await this.cacheManager.get<number>(cacheKey);
        if (cachedCount !== undefined && cachedCount !== null) {
            return cachedCount;
        }

        const count = await this.testAttemptRepository
            .createQueryBuilder('attempt')
            .innerJoin('attempt.test', 'test')
            .where('test.courseId = :courseId', { courseId })
            .select('COUNT(DISTINCT attempt.userId)', 'count')
            .getRawOne()
            .then((result: { count: string }) => parseInt(result.count) || 0);

        await this.cacheManager.set(
            cacheKey,
            count,
            this.CACHE_TTL.COUNTS * 1000,
        );

        return count;
    }

    /**
     * Soft delete a course by setting status to DELETED
     */
    async softDelete(
        courseId: number,
        deletedBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // First check if course exists and is not already deleted
            const course = await this.courseRepository.findOne({
                where: { courseId },
                relations: ['creator', 'orgId', 'branchId'],
            });

            if (!course) {
                throw new NotFoundException(`Course with ID ${courseId} not found`);
            }

            if (course.status === CourseStatus.DELETED) {
                throw new BadRequestException('Course is already deleted');
            }

            // Update status to DELETED
            await this.courseRepository.update(courseId, {
                status: CourseStatus.DELETED,
            });

            // Invalidate course cache
            await this.invalidateCourseCache(courseId, course.createdBy);

            return {
                message: 'Course deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Restore a soft-deleted course by setting status to ACTIVE
     */
    async restoreCourse(
        courseId: number,
        restoredBy?: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // First check if course exists and is deleted
            const course = await this.courseRepository.findOne({
                where: { courseId },
                relations: ['creator', 'orgId', 'branchId'],
            });

            if (!course) {
                throw new NotFoundException(`Course with ID ${courseId} not found`);
            }

            if (course.status !== CourseStatus.DELETED) {
                throw new BadRequestException(
                    'Course is not deleted and cannot be restored',
                );
            }

            // Update status to ACTIVE
            await this.courseRepository.update(courseId, {
                status: CourseStatus.ACTIVE,
            });

            // Invalidate course cache
            await this.invalidateCourseCache(courseId, course.createdBy);

            return {
                message: 'Course restored successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Find all soft-deleted courses (for admin purposes)
     */
    async findDeleted(): Promise<Course[]> {
        return this.retryOperation(async () => {
            const courses = await this.courseRepository.find({
                where: { status: CourseStatus.DELETED },
                relations: ['creator', 'orgId', 'branchId', 'courseMaterials'],
            });

            return courses;
        });
    }

    /**
     * Find all courses with any status (for admin purposes)
     */
    async findAllWithDeleted(): Promise<Course[]> {
        return this.retryOperation(async () => {
            const courses = await this.courseRepository.find({
                relations: ['creator', 'orgId', 'branchId', 'courseMaterials'],
            });

            return courses;
        });
    }

    /**
     * Find course by ID including deleted courses (for admin purposes)
     */
    async findByIdWithDeleted(id: number): Promise<Course | null> {
        return this.retryOperation(async () => {
            const course = await this.courseRepository.findOne({
                where: { courseId: id },
                relations: ['creator', 'orgId', 'branchId', 'courseMaterials'],
            });

            return course;
        });
    }

    // Legacy methods with deprecation notice - keeping for backward compatibility
    async findAllScoped(
        filters: CourseFilterDto,
        orgId?: string,
        branchId?: string,
    ): Promise<CourseListResponseDto> {
        const scope: OrgBranchScope = {
            userId: '',
            orgId,
            branchId,
        };
        return this.findAll(filters, scope);
    }

    async findOneScoped(
        id: number,
        orgId?: string,
        branchId?: string,
    ): Promise<CourseDetailDto | null> {
        const scope: OrgBranchScope = {
            userId: '',
            orgId,
            branchId,
        };
        return this.findOne(id, scope);
    }

    async createScoped(
        createCourseDto: CreateCourseDto,
        userId: string,
        orgId?: string,
        branchId?: string,
    ): Promise<StandardOperationResponse> {
        const scope: OrgBranchScope = {
            userId,
            orgId,
            branchId,
        };
        return this.create(createCourseDto, scope);
    }
}
