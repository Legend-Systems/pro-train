import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
    HttpCode,
    Logger,
    NotFoundException,
    ParseIntPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiHeader,
    ApiSecurity,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseFilterDto } from './dto/course-filter.dto';
import {
    CourseResponseDto,
    CourseListResponseDto,
    CourseDetailDto,
    CourseStatsDto,
    StandardApiResponse,
    StandardOperationResponse,
    CourseApiResponse,
    CourseListApiResponse,
    CourseDetailApiResponse,
    CourseStatsApiResponse,
    CourseCreatedResponse,
    CourseUpdatedResponse,
    CourseDeletedResponse,
} from './dto/course-response.dto';

@ApiTags('🎓 Course Management')
@Controller('courses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class CourseController {
    private readonly logger = new Logger(CourseController.name);

    constructor(private readonly courseService: CourseService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '🆕 Create New Course',
        description: `
      **Creates a new course with comprehensive validation and caching**
      
      This endpoint allows authenticated users to create new courses with:
      - Course title and description validation
      - Automatic creator assignment from JWT context
      - Organization/branch scope assignment
      - Comprehensive caching invalidation
      - Input validation and sanitization
      
      **Security Features:**
      - Requires valid JWT authentication
      - Organization/branch scope validation
      - Automatic creator ownership tracking
      - Input validation and sanitization
      
      **Business Rules:**
      - Course title must be at least 3 characters
      - Description is optional but recommended
      - Creator is automatically set from authenticated user
      - Course inherits organization/branch from user context
      
      **Use Cases:**
      - Creating new educational courses
      - Setting up exam structures
      - Organizing learning content
      - Building course catalogs
    `,
        operationId: 'createCourse',
    })
    @ApiBody({
        type: CreateCourseDto,
        description: 'Course creation data',
        examples: {
            'computer-science': {
                summary: '💻 Computer Science Course',
                description: 'Example of a comprehensive CS course',
                value: {
                    title: 'Introduction to Computer Science',
                    description:
                        'A comprehensive introduction to computer science fundamentals including programming, algorithms, data structures, and problem-solving techniques. Perfect for beginners with no prior experience.',
                },
            },
            mathematics: {
                summary: '📊 Mathematics Course',
                description: 'Example of a mathematics course',
                value: {
                    title: 'Calculus I - Differential Calculus',
                    description:
                        'First course in calculus covering limits, derivatives, and applications of differentiation.',
                },
            },
            minimal: {
                summary: '📝 Minimal Course',
                description: 'Minimal required fields only',
                value: {
                    title: 'Basic Programming Concepts',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Course created successfully',
        type: CourseCreatedResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Course title must be at least 3 characters long',
                        'Course title is required',
                        'Course description must be a string',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 400 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'User with ID xxx not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async create(
        @Body() createCourseDto: CreateCourseDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating course "${createCourseDto.title}" for user: ${scope.userId} in org: ${scope.orgId}, branch: ${scope.branchId}`,
            );

            return await this.courseService.create(createCourseDto, scope);
        } catch (error) {
            this.logger.error(
                `Error creating course for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get()
    @ApiOperation({
        summary: '📋 List All Courses',
        description: `
      **Retrieves a paginated list of courses with filtering and comprehensive caching**
      
      This endpoint provides comprehensive course discovery with:
      - Advanced pagination support for large datasets
      - Multiple filtering options (title, creator, date range)
      - Flexible sorting capabilities
      - Course statistics and metadata
      - Comprehensive caching for performance
      
      **Filtering Options:**
      - **Title**: Partial text search in course titles
      - **Creator**: Filter by specific user who created courses
      - **Date Range**: Filter by creation date (after/before)
      - **Sorting**: Sort by title, creation date, or update date
      - **Pagination**: Page-based navigation with configurable page size
      
      **Response Includes:**
      - Course basic information with creator details
      - Test count per course (cached)
      - Student enrollment count (cached)
      - Organization and branch information
      - Comprehensive pagination metadata
      
      **Performance Features:**
      - Intelligent caching at multiple levels
      - Optimized database queries with eager loading
      - Efficient count calculations
      - Cache invalidation on course changes
    `,
        operationId: 'getAllCourses',
    })
    @ApiQuery({
        name: 'title',
        required: false,
        description: 'Filter courses by title (partial match)',
        example: 'Computer Science',
    })
    @ApiQuery({
        name: 'createdBy',
        required: false,
        description: 'Filter courses by creator user ID',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @ApiQuery({
        name: 'createdAfter',
        required: false,
        description: 'Filter courses created after this date',
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'createdBefore',
        required: false,
        description: 'Filter courses created before this date',
        example: '2024-12-31',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        description: 'Page number for pagination',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Number of courses per page',
        example: 10,
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        description: 'Sort field',
        example: 'createdAt',
        enum: ['title', 'createdAt', 'updatedAt'],
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        description: 'Sort order',
        example: 'DESC',
        enum: ['ASC', 'DESC'],
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Courses retrieved successfully',
        type: CourseListApiResponse,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async findAll(
        @Query() filters: CourseFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting courses for user: ${scope.userId} with filters:`,
                JSON.stringify(filters),
            );

            const result = await this.courseService.findAll(filters, scope);

            return {
                success: true,
                message: 'Courses retrieved successfully',
                data: result,
                meta: {
                    timestamp: new Date().toISOString(),
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages,
                    },
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting courses for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('my-courses')
    @ApiOperation({
        summary: '👤 Get My Created Courses',
        description: `
      **Retrieves courses created by the authenticated user with caching**
      
      This endpoint provides a filtered view of courses created by the current user:
      - Automatic filtering by creator (authenticated user)
      - Same filtering and pagination options as general course list
      - Comprehensive caching for performance
      - Creator-specific optimizations
      
      **Use Cases:**
      - User dashboard showing their courses
      - Course management interface
      - Creator analytics and insights
      - Personal course portfolio
    `,
        operationId: 'getMyCreatedCourses',
    })
    @ApiQuery({
        name: 'title',
        required: false,
        description: 'Filter your courses by title (partial match)',
        example: 'Computer Science',
    })
    @ApiQuery({
        name: 'createdAfter',
        required: false,
        description: 'Filter your courses created after this date',
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'createdBefore',
        required: false,
        description: 'Filter your courses created before this date',
        example: '2024-12-31',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        description: 'Page number for pagination',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Number of courses per page',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User courses retrieved successfully',
        type: CourseListApiResponse,
    })
    async getMyCreatedCourses(
        @Query() filters: CourseFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Getting courses created by user: ${scope.userId}`);

            const result = await this.courseService.findByCreator(
                scope.userId,
                filters,
                scope,
            );

            return {
                success: true,
                message: 'User courses retrieved successfully',
                data: result,
                meta: {
                    timestamp: new Date().toISOString(),
                    pagination: {
                        page: result.page,
                        limit: result.limit,
                        total: result.total,
                        totalPages: result.totalPages,
                    },
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting courses for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Course Details',
        description: `
      **Retrieves detailed information about a specific course with caching**
      
      This endpoint provides comprehensive course details including:
      - Complete course information with creator details
      - Detailed statistics (test counts, attempts, scores)
      - Organization and branch information
      - Comprehensive caching for performance
      
      **Statistics Included:**
      - Total and active test counts
      - Student enrollment and attempt statistics
      - Average scores and pass rates
      - Recent activity timestamps
      
      **Use Cases:**
      - Course detail pages
      - Course analytics and reporting
      - Instructor dashboards
      - Course performance monitoring
    `,
        operationId: 'getCourseById',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to retrieve',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course details retrieved successfully',
        type: CourseDetailApiResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'Course with ID 1 not found',
                },
                data: { type: 'null' },
            },
        },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Getting course ${id} for user: ${scope.userId}`);

            const course = await this.courseService.findOne(id, scope);

            if (!course) {
                return {
                    success: false,
                    message: `Course with ID ${id} not found`,
                    data: null,
                };
            }

            return {
                success: true,
                message: 'Course details retrieved successfully',
                data: course,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting course ${id} for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: '📊 Get Course Statistics',
        description: `
      **Retrieves comprehensive statistics for a specific course with caching**
      
      This endpoint provides detailed analytics including:
      - Test and student counts with breakdowns
      - Performance metrics (average scores, pass rates)
      - Activity tracking (last attempt timestamps)
      - Comprehensive caching for performance
      
      **Statistics Included:**
      - **Test Metrics**: Total tests, active tests
      - **Student Metrics**: Unique students, total attempts
      - **Performance**: Average scores, pass rates
      - **Activity**: Last activity timestamps
      
      **Use Cases:**
      - Course analytics dashboards
      - Performance monitoring
      - Instructor insights
      - Administrative reporting
    `,
        operationId: 'getCourseStats',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to get statistics for',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course statistics retrieved successfully',
        type: CourseStatsApiResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'Course with ID 1 not found',
                },
                data: { type: 'null' },
            },
        },
    })
    async getStats(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting stats for course ${id} by user: ${req.user.id}`,
            );

            const stats = await this.courseService.getStats(id);

            return {
                success: true,
                message: 'Course statistics retrieved successfully',
                data: stats,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting stats for course ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Course',
        description: `
      **Updates an existing course with validation and cache management**
      
      This endpoint allows course creators to update their courses:
      - Title and description modifications
      - Ownership validation (only creator can update)
      - Comprehensive cache invalidation
      - Input validation and sanitization
      
      **Security Features:**
      - Ownership validation (only creator can update)
      - Input validation and sanitization
      - Automatic cache invalidation
      
      **Use Cases:**
      - Course information updates
      - Content improvements
      - Course maintenance
      - Information corrections
    `,
        operationId: 'updateCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateCourseDto,
        description: 'Course update data',
        examples: {
            'title-update': {
                summary: '📝 Update Title',
                description: 'Update course title only',
                value: {
                    title: 'Advanced Computer Science Concepts',
                },
            },
            'full-update': {
                summary: '🔄 Complete Update',
                description: 'Update both title and description',
                value: {
                    title: 'Advanced Computer Science Concepts',
                    description:
                        'An advanced course covering complex computer science topics including advanced algorithms, system design, and software architecture patterns.',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course updated successfully',
        type: CourseUpdatedResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Course title must be at least 3 characters long',
                        'Course description must be a string',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 400 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - Not course creator',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'You are not authorized to modify this course',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course with ID 1 not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCourseDto: UpdateCourseDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Updating course ${id} by user: ${req.user.id}`);

            return await this.courseService.update(
                id,
                updateCourseDto,
                req.user.id,
            );
        } catch (error) {
            this.logger.error(
                `Error updating course ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Course',
        description: `
      **Deletes a course with validation and cache management**
      
      This endpoint allows course creators to delete their courses:
      - Ownership validation (only creator can delete)
      - Test dependency checking (cannot delete course with tests)
      - Comprehensive cache invalidation
      - Safe deletion with validation
      
      **Security Features:**
      - Ownership validation (only creator can delete)
      - Dependency checking before deletion
      - Comprehensive cache invalidation
      
      **Business Rules:**
      - Cannot delete course that has tests
      - Only course creator can delete
      - Deletion is permanent and irreversible
      
      **Use Cases:**
      - Removing obsolete courses
      - Cleaning up test/draft courses
      - Course management maintenance
    `,
        operationId: 'deleteCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course deleted successfully',
        type: CourseDeletedResponse,
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description:
            '⛔ Forbidden - Cannot delete course with tests or not creator',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'You are not authorized to modify this course',
                        'Cannot delete course that has tests',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course with ID 1 not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Deleting course ${id} by user: ${req.user.id}`);

            return await this.courseService.remove(id, req.user.id);
        } catch (error) {
            this.logger.error(
                `Error deleting course ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
