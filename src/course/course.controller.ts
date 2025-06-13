import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    Request,
    HttpStatus,
    HttpCode,
    Logger,
    ParseIntPipe,
    ForbiddenException,
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
    StandardApiResponse,
    StandardOperationResponse,
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
                    example:
                        'User with ID a1b2c3d4-e5f6-7890-abcd-ef1234567890 not found',
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
        example: '2025-01-01',
    })
    @ApiQuery({
        name: 'createdBefore',
        required: false,
        description: 'Filter courses created before this date',
        example: '2025-12-31',
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
        example: '2025-01-01',
    })
    @ApiQuery({
        name: 'createdBefore',
        required: false,
        description: 'Filter your courses created before this date',
        example: '2025-12-31',
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

    @Get(':id/edit')
    @ApiOperation({
        summary: '✏️ Get Course for Editing',
        description: `
      **Retrieves course details specifically for editing purposes**
      
      This endpoint provides the same course details as the regular findOne endpoint
      but is specifically designed for edit forms and course management interfaces.
      
      **Security Features:**
      - Validates user has permission to edit the course
      - Returns comprehensive course data for form population
      - Includes all necessary fields for course editing
      
      **Use Cases:**
      - Course edit forms
      - Course management interfaces
      - Pre-populating edit data
    `,
        operationId: 'getCourseForEdit',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to edit',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course edit data retrieved successfully',
        type: CourseDetailApiResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Not authorized to edit this course',
    })
    async getCourseForEdit(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting course ${id} for editing by user: ${scope.userId}`,
            );

            const course = await this.courseService.findOne(id, scope);

            if (!course) {
                this.logger.warn(
                    `Course ${id} not found for edit by user: ${scope.userId}`,
                );
                return {
                    success: false,
                    message: `Course with ID ${id} not found`,
                    data: null,
                };
            }

            // Validate edit permissions
            await this.courseService.validateOwnership(id, scope.userId, scope);

            this.logger.log(
                `Course ${id} edit data retrieved successfully for user: ${scope.userId}`,
            );

            return {
                success: true,
                message: 'Course edit data retrieved successfully',
                data: course,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting course ${id} for edit by user ${scope.userId}:`,
                error instanceof Error ? error.message : error,
            );

            if (error instanceof ForbiddenException) {
                return {
                    success: false,
                    message: 'You are not authorized to edit this course',
                    data: null,
                };
            }

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
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting stats for course ${id} by user: ${scope.userId}`,
            );

            const stats = await this.courseService.getStats(id, scope);

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
                `Error getting stats for course ${id} by user ${scope.userId}:`,
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
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Updating course ${id} by user: ${scope.userId}`);

            return await this.courseService.update(id, updateCourseDto, scope);
        } catch (error) {
            this.logger.error(
                `Error updating course ${id} by user ${scope.userId}:`,
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
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Deleting course ${id} by user: ${scope.userId}`);

            return await this.courseService.remove(id, scope);
        } catch (error) {
            this.logger.error(
                `Error deleting course ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id/soft-delete')
    @ApiOperation({
        summary: '🗑️ Soft Delete Course',
        description: `
      **Soft deletes a course by setting status to DELETED**
      
      This endpoint performs a soft delete of the course:
      - Sets course status to DELETED instead of removing the record
      - Preserves course data for potential restoration
      - Course will no longer appear in normal queries
      - Course can be restored later using the restore endpoint
      
      **Security Features:**
      - Requires valid JWT authentication
      - Only course creator can soft delete their course
      - Checks if course is already deleted before proceeding
      
      **Use Cases:**
      - Course deactivation
      - Temporary course suspension
      - Course archival
      - Course management cleanup
    `,
        operationId: 'softDeleteCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to soft delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course soft deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course deleted successfully',
                },
                status: {
                    type: 'string',
                    example: 'success',
                },
                code: {
                    type: 'number',
                    example: 200,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Course is already deleted',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course is already deleted',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
                },
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
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 404,
                },
            },
        },
    })
    async softDeleteCourse(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Soft deleting course ${id} by user: ${scope.userId}`,
            );

            // First validate ownership
            await this.courseService.validateOwnershipWithDeleted(
                id,
                scope.userId,
                scope,
            );

            return await this.courseService.softDelete(id, scope.userId);
        } catch (error) {
            this.logger.error(
                `Error soft deleting course ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Patch(':id/restore')
    @ApiOperation({
        summary: '♻️ Restore Soft Deleted Course',
        description: `
      **Restores a soft-deleted course by setting status to ACTIVE**
      
      This endpoint restores a previously soft-deleted course:
      - Sets course status back to ACTIVE
      - Makes the course accessible again
      - Course will appear in normal queries again
      - Validates that course is currently in DELETED status
      
      **Security Features:**
      - Requires valid JWT authentication
      - Only course creator can restore their course
      - Checks if course is actually deleted before proceeding
      
      **Use Cases:**
      - Course reactivation
      - Undoing accidental deletion
      - Course returning after temporary deactivation
      - Course management restoration
    `,
        operationId: 'restoreCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to restore',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course restored successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course restored successfully',
                },
                status: {
                    type: 'string',
                    example: 'success',
                },
                code: {
                    type: 'number',
                    example: 200,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Course is not deleted and cannot be restored',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course is not deleted and cannot be restored',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
                },
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
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 404,
                },
            },
        },
    })
    async restoreCourse(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Restoring course ${id} by user: ${scope.userId}`);

            // Validate ownership with proper permission logic
            await this.courseService.validateOwnershipWithDeleted(
                id,
                scope.userId,
                scope,
            );

            return await this.courseService.restoreCourse(id, scope.userId);
        } catch (error) {
            this.logger.error(
                `Error restoring course ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('debug/all')
    @ApiOperation({
        summary: '🔍 Debug: Get All Courses (Any Status)',
        description: 'Debug endpoint to see all courses regardless of status',
        operationId: 'debugGetAllCourses',
    })
    async debugGetAllCourses(
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Debug: Getting all courses for user: ${scope.userId}`,
            );

            const allCourses = await this.courseService.findAllWithDeleted();

            this.logger.log(`Debug: Found ${allCourses.length} total courses`);

            return {
                success: true,
                message: `Found ${allCourses.length} courses (all statuses)`,
                data: allCourses.map(course => ({
                    courseId: course.courseId,
                    title: course.title,
                    status: course.status,
                    createdBy: course.createdBy,
                    orgId: course.orgId?.id,
                    branchId: course.branchId?.id,
                    createdAt: course.createdAt,
                })),
            };
        } catch (error) {
            this.logger.error(`Debug error getting all courses:`, error);
            throw error;
        }
    }

    @Get('admin/deleted')
    @ApiOperation({
        summary: '📋 Get Deleted Courses (Admin)',
        description: `
      **Retrieves all soft-deleted courses (for administrative purposes)**
      
      This endpoint returns all courses with DELETED status:
      - Shows courses that have been soft-deleted
      - Includes full course data
      - Intended for administrative use
      - Helps with course recovery operations
      
      **Security Features:**
      - Requires valid JWT authentication
      - Should be restricted to admin users in production
      
      **Use Cases:**
      - Administrative course management
      - Course recovery operations
      - Audit trails and reporting
      - Bulk restoration operations
    `,
        operationId: 'adminGetDeletedCourses',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Deleted courses retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Deleted courses retrieved successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'array',
                    description: 'List of soft-deleted courses',
                    items: {
                        type: 'object',
                        description: 'Deleted course data',
                    },
                },
            },
        },
    })
    async adminGetDeletedCourses(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting deleted courses for admin: ${req.user.id}`,
            );

            const deletedCourses = await this.courseService.findDeleted();

            this.logger.log(
                `Retrieved ${deletedCourses.length} deleted courses for admin: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Deleted courses retrieved successfully',
                data: deletedCourses,
            };
        } catch (error) {
            this.logger.error(
                `Error getting deleted courses for admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Patch('admin/restore/:id')
    @ApiOperation({
        summary: '♻️ Restore Course by ID (Admin)',
        description: `
      **Restores a soft-deleted course by course ID (for administrative use)**
      
      This endpoint allows administrators to restore any soft-deleted course:
      - Sets specified course status back to ACTIVE
      - Makes the course accessible again
      - Validates that target course exists and is deleted
      - Returns success confirmation only
      
      **Security Features:**
      - Requires valid JWT authentication
      - Should be restricted to admin users in production
      - Validates target course exists and is deleted
      
      **Use Cases:**
      - Administrative course recovery
      - Bulk course restoration
      - Customer support operations
      - Data recovery procedures
    `,
        operationId: 'adminRestoreCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course ID to restore',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course restored successfully by admin',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course restored successfully',
                },
                status: {
                    type: 'string',
                    example: 'success',
                },
                code: {
                    type: 'number',
                    example: 200,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Course is not deleted and cannot be restored',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course is not deleted and cannot be restored',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
                },
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
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 404,
                },
            },
        },
    })
    async adminRestoreCourse(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Admin ${req.user.id} restoring course: ${id}`);

            const result = await this.courseService.restoreCourse(
                id,
                req.user.id,
            );

            this.logger.log(
                `Course ${id} restored successfully by admin: ${req.user.id}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error restoring course ${id} by admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
