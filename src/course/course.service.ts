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
import { UserService } from '../user/user.service';

@Injectable()
export class CourseService {
    constructor(
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        private readonly userService: UserService,
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
        userId: string,
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

    async findAll(filters: CourseFilterDto): Promise<CourseListResponseDto> {
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

            // TODO: Add test and student counts when other entities are implemented
            const coursesWithCounts = courses.map(course => ({
                ...course,
                testCount: 0, // Will be calculated when Test entity is available
                studentCount: 0, // Will be calculated when TestAttempt entity is available
            }));

            return {
                courses: coursesWithCounts,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            };
        });
    }

    async findOne(id: number): Promise<CourseDetailDto | null> {
        return this.retryOperation(async () => {
            const course = await this.courseRepository.findOne({
                where: { courseId: id },
                relations: ['creator'],
            });

            if (!course) {
                return null;
            }

            // TODO: Calculate real statistics when other entities are implemented
            const statistics = {
                totalTests: 0,
                activeTests: 0,
                totalAttempts: 0,
                averageScore: 0,
            };

            return {
                ...course,
                testCount: statistics.totalTests,
                studentCount: 0,
                statistics,
            };
        });
    }

    async findByCreator(
        userId: string,
        filters: Partial<CourseFilterDto>,
    ): Promise<CourseListResponseDto> {
        return this.findAll({ ...filters, createdBy: userId });
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

            // TODO: Check for active tests when Test entity is implemented
            // const activeTests = await this.testService.countActiveTests(id);
            // if (activeTests > 0) {
            //     throw new BadRequestException('Cannot delete course with active tests');
            // }

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

            // TODO: Calculate real statistics when other entities are implemented
            return {
                courseId: id,
                totalTests: 0,
                activeTests: 0,
                totalAttempts: 0,
                uniqueStudents: 0,
                averageScore: 0,
                passRate: 0,
                lastActivityAt: undefined,
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
}
