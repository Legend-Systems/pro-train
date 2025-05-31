import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import {
    CourseResponseDto,
    CourseListResponseDto,
    CourseDetailDto,
    CourseStatsDto,
} from './dto/course-response.dto';
import { Course } from './entities/course.entity';
import { Test } from '../test/entities/test.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { UserService } from '../user/user.service';
import { OrgBranchScopingService } from '../auth/services/org-branch-scoping.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

@Injectable()
export class CourseService {
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
        createCourseDto: CreateCourseDto,
        scope: OrgBranchScope,
    ): Promise<CourseResponseDto> {
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

            return {
                ...savedCourse,
                creator: user,
                testCount: 0,
                studentCount: 0,
            };
        });
    }

    async findAll(
        filters: CourseFilterDto,
        scope?: OrgBranchScope,
    ): Promise<CourseListResponseDto> {
        return this.retryOperation(async () => {
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

            // Calculate actual test counts for each course
            const coursesWithCounts = await Promise.all(
                courses.map(async course => {
                    const testCount = await this.testRepository.count({
                        where: { courseId: course.courseId },
                    });

                    // Calculate student count using TestAttempt entity
                    const studentCount = await this.testAttemptRepository
                        .createQueryBuilder('attempt')
                        .innerJoin('attempt.test', 'test')
                        .where('test.courseId = :courseId', {
                            courseId: course.courseId,
                        })
                        .select('COUNT(DISTINCT attempt.userId)', 'count')
                        .getRawOne()
                        .then(
                            (result: { count: string }) =>
                                parseInt(result.count) || 0,
                        );

                    return {
                        ...course,
                        testCount,
                        studentCount,
                    };
                }),
            );

            return {
                courses: coursesWithCounts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }

    async findOne(
        id: number,
        scope?: OrgBranchScope,
    ): Promise<CourseDetailDto | null> {
        return this.retryOperation(async () => {
            const whereCondition: any = { courseId: id };

            // Apply org/branch scoping
            if (scope?.orgId) {
                whereCondition.orgId = { id: scope.orgId };
            }
            if (scope?.branchId) {
                whereCondition.branchId = { id: scope.branchId };
            }

            const course = await this.courseRepository.findOne({
                where: whereCondition,
                relations: ['creator', 'orgId', 'branchId'],
            });

            if (!course) {
                return null;
            }

            // Calculate actual statistics with available entities
            const totalTests = await this.testRepository.count({
                where: { courseId: id },
            });

            const activeTests = await this.testRepository.count({
                where: { courseId: id, isActive: true },
            });

            // Calculate statistics using TestAttempt and Result entities
            const totalAttempts = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .innerJoin('attempt.test', 'test')
                .where('test.courseId = :courseId', { courseId: id })
                .getCount();

            const studentCount = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .innerJoin('attempt.test', 'test')
                .where('test.courseId = :courseId', { courseId: id })
                .select('COUNT(DISTINCT attempt.userId)', 'count')
                .getRawOne()
                .then(
                    (result: { count: string }) => parseInt(result.count) || 0,
                );

            const averageScoreResult: { avgScore: string } | undefined =
                await this.resultRepository
                    .createQueryBuilder('result')
                    .innerJoin('result.attempt', 'attempt')
                    .innerJoin('attempt.test', 'test')
                    .where('test.courseId = :courseId', { courseId: id })
                    .select('AVG(result.score)', 'avgScore')
                    .getRawOne();

            const averageScore = averageScoreResult?.avgScore
                ? parseFloat(averageScoreResult.avgScore)
                : 0;

            const statistics = {
                totalTests,
                activeTests,
                totalAttempts,
                averageScore,
            };

            return {
                ...course,
                testCount: totalTests,
                studentCount,
                statistics,
            };
        });
    }

    async findByCreator(
        userId: string,
        filters: Partial<CourseFilterDto>,
        scope?: OrgBranchScope,
    ): Promise<CourseListResponseDto> {
        return this.findAll({ ...filters, createdBy: userId }, scope);
    }

    async update(
        id: number,
        updateCourseDto: UpdateCourseDto,
        userId: string,
    ): Promise<CourseResponseDto> {
        return this.retryOperation(async () => {
            await this.validateOwnership(id, userId);

            const result = await this.courseRepository.update(
                id,
                updateCourseDto,
            );

            if (result.affected === 0) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            const updatedCourse = await this.findOne(id);
            if (!updatedCourse) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            return {
                courseId: updatedCourse.courseId,
                title: updatedCourse.title,
                description: updatedCourse.description,
                createdBy: updatedCourse.createdBy,
                createdAt: updatedCourse.createdAt,
                updatedAt: updatedCourse.updatedAt,
                creator: updatedCourse.creator,
                testCount: updatedCourse.testCount,
                studentCount: updatedCourse.studentCount,
            };
        });
    }

    async remove(id: number, userId: string): Promise<void> {
        return this.retryOperation(async () => {
            await this.validateOwnership(id, userId);

            // Check for active tests before deletion
            const activeTestCount = await this.testRepository.count({
                where: { courseId: id, isActive: true },
            });

            if (activeTestCount > 0) {
                throw new ForbiddenException(
                    `Cannot delete course with ${activeTestCount} active tests. Please deactivate all tests first.`,
                );
            }

            const result = await this.courseRepository.delete(id);
            if (result.affected === 0) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }
        });
    }

    async getStats(id: number): Promise<CourseStatsDto> {
        return this.retryOperation(async () => {
            const course = await this.findOne(id);
            if (!course) {
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            // Calculate actual statistics with available entities
            const totalTests = await this.testRepository.count({
                where: { courseId: id },
            });

            const activeTests = await this.testRepository.count({
                where: { courseId: id, isActive: true },
            });

            // Calculate real attempt statistics using TestAttempt and Result entities
            const totalAttempts = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .innerJoin('attempt.test', 'test')
                .where('test.courseId = :courseId', { courseId: id })
                .getCount();

            const uniqueStudents = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .innerJoin('attempt.test', 'test')
                .where('test.courseId = :courseId', { courseId: id })
                .select('COUNT(DISTINCT attempt.userId)', 'count')
                .getRawOne()
                .then(
                    (result: { count: string }) => parseInt(result.count) || 0,
                );

            const averageScoreResult: { avgScore: string } | undefined =
                await this.resultRepository
                    .createQueryBuilder('result')
                    .innerJoin('result.attempt', 'attempt')
                    .innerJoin('attempt.test', 'test')
                    .where('test.courseId = :courseId', { courseId: id })
                    .select('AVG(result.score)', 'avgScore')
                    .getRawOne();

            const averageScore = averageScoreResult?.avgScore
                ? parseFloat(averageScoreResult.avgScore)
                : 0;

            const passRateResult: { passRate: string } | undefined =
                await this.resultRepository
                    .createQueryBuilder('result')
                    .innerJoin('result.attempt', 'attempt')
                    .innerJoin('attempt.test', 'test')
                    .where('test.courseId = :courseId', { courseId: id })
                    .select(
                        'AVG(CASE WHEN result.passed = 1 THEN 1 ELSE 0 END) * 100',
                        'passRate',
                    )
                    .getRawOne();

            const passRate = passRateResult?.passRate
                ? parseFloat(passRateResult.passRate)
                : 0;

            const lastActivity = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .innerJoin('attempt.test', 'test')
                .where('test.courseId = :courseId', { courseId: id })
                .orderBy('attempt.updatedAt', 'DESC')
                .select('attempt.updatedAt')
                .getOne();

            return {
                courseId: id,
                totalTests,
                activeTests,
                totalAttempts,
                uniqueStudents,
                averageScore,
                passRate,
                lastActivityAt: lastActivity?.updatedAt,
            };
        });
    }

    async validateOwnership(courseId: number, userId: string): Promise<void> {
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

    // Additional helper methods
    async findById(id: number): Promise<Course | null> {
        return this.retryOperation(async () => {
            return await this.courseRepository.findOne({
                where: { courseId: id },
            });
        });
    }

    async exists(id: number): Promise<boolean> {
        return this.retryOperation(async () => {
            const count = await this.courseRepository.count({
                where: { courseId: id },
            });
            return count > 0;
        });
    }

    async findByOrganization(orgId: string): Promise<Course[]> {
        return this.retryOperation(async () => {
            return await this.courseRepository.find({
                where: { orgId: { id: orgId } },
                relations: ['creator', 'orgId', 'branchId'],
                order: { createdAt: 'DESC' },
            });
        });
    }

    async findByBranch(branchId: string): Promise<Course[]> {
        return this.retryOperation(async () => {
            return await this.courseRepository.find({
                where: { branchId: { id: branchId } },
                relations: ['creator', 'orgId', 'branchId'],
                order: { createdAt: 'DESC' },
            });
        });
    }

    /**
     * Find all courses with org/branch scoping applied
     */
    async findAllScoped(
        filters: CourseFilterDto,
        orgId?: string,
        branchId?: string,
    ): Promise<CourseListResponseDto> {
        return this.retryOperation(async () => {
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

            // Apply org/branch scoping
            this.orgBranchScopingService.applyScopeToQueryBuilder(
                query,
                { orgId, branchId },
                'course',
            );

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

            // Calculate actual test counts for each course
            const coursesWithCounts = await Promise.all(
                courses.map(async course => {
                    const testCount = await this.testRepository.count({
                        where: { courseId: course.courseId },
                    });

                    // TODO: Calculate student count when TestAttempt entity is available
                    const studentCount = 0;

                    return {
                        ...course,
                        testCount,
                        studentCount,
                    };
                }),
            );

            return {
                courses: coursesWithCounts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }

    /**
     * Find one course with org/branch scoping applied
     */
    async findOneScoped(
        id: number,
        orgId?: string,
        branchId?: string,
    ): Promise<CourseDetailDto | null> {
        return this.retryOperation(async () => {
            const findOptions =
                this.orgBranchScopingService.applyScopeToFindOptions(
                    {
                        where: { courseId: id },
                        relations: ['creator', 'orgId', 'branchId'],
                    },
                    { orgId, branchId },
                );

            const course = await this.courseRepository.findOne(findOptions);

            if (!course) {
                return null;
            }

            // Calculate actual statistics with available entities
            const totalTests = await this.testRepository.count({
                where: { courseId: id },
            });

            const activeTests = await this.testRepository.count({
                where: { courseId: id, isActive: true },
            });

            // TODO: Calculate totalAttempts and averageScore when TestAttempt entity is available
            const statistics = {
                totalTests,
                activeTests,
                totalAttempts: 0,
                averageScore: 0,
            };

            return {
                ...course,
                testCount: totalTests,
                studentCount: 0, // TODO: Calculate when TestAttempt entity is available
                statistics,
            };
        });
    }

    /**
     * Create course with org/branch assignment
     */
    async createScoped(
        createCourseDto: CreateCourseDto,
        userId: string,
        orgId?: string,
        branchId?: string,
    ): Promise<CourseResponseDto> {
        return this.retryOperation(async () => {
            // Validate user exists
            const user = await this.userService.findById(userId);
            if (!user) {
                throw new NotFoundException(`User with ID ${userId} not found`);
            }

            const course = this.courseRepository.create({
                ...createCourseDto,
                createdBy: userId,
                orgId: orgId ? ({ id: orgId } as any) : undefined,
                branchId: branchId ? ({ id: branchId } as any) : undefined,
            });

            const savedCourse = await this.courseRepository.save(course);

            return {
                ...savedCourse,
                creator: user,
                testCount: 0,
                studentCount: 0,
            };
        });
    }
}
