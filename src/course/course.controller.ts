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
} from './dto/course-response.dto';
import { StandardApiResponse } from '../user/dto/common-response.dto';

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
    @ApiOperation({
        summary: '🆕 Create New Course',
        description: `
      **Creates a new course with comprehensive validation**
      
      This endpoint allows authenticated users to create new courses including:
      - Course title and description
      - Automatic creator assignment
      - Input validation and sanitization
      - Unique course creation
      
      **Security Features:**
      - Requires valid JWT authentication
      - Automatic creator assignment from JWT token
      - Input validation and sanitization
      - Creator ownership tracking
      
      **Business Rules:**
      - Course title must be at least 3 characters
      - Description is optional but recommended
      - Creator is automatically set from authenticated user
      - Course creation timestamp is automatic
      
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
        type: CourseResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Course title must be at least 3 characters long',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async create(
        @Body() createCourseDto: CreateCourseDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<CourseResponseDto> {
        try {
            this.logger.log(
                `Creating course "${createCourseDto.title}" for user: ${scope.userId} in org: ${scope.orgId}, branch: ${scope.branchId}`,
            );

            const course = await this.courseService.create(
                createCourseDto,
                scope,
            );

            this.logger.log(
                `Course created successfully with ID: ${course.courseId}`,
            );

            return course;
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
      **Retrieves a paginated list of courses with filtering options**
      
      This endpoint provides comprehensive course discovery with:
      - Pagination support for large datasets
      - Multiple filtering options (title, creator, date range)
      - Sorting capabilities
      - Course statistics and metadata
      
      **Filtering Options:**
      - **Title**: Partial text search in course titles
      - **Creator**: Filter by specific user who created courses
      - **Date Range**: Filter by creation date (after/before)
      - **Sorting**: Sort by title, creation date, or update date
      
      **Response Includes:**
      - Course basic information
      - Creator details
      - Test count per course
      - Student enrollment count
      - Pagination metadata
      
      **Use Cases:**
      - Course catalog browsing
      - Administrative course overview
      - Search and discovery
      - Analytics and reporting
    `,
        operationId: 'listCourses',
    })
    @ApiQuery({
        name: 'title',
        required: false,
        description: 'Filter by course title (partial match)',
        example: 'Computer Science',
    })
    @ApiQuery({
        name: 'createdBy',
        required: false,
        description: 'Filter by creator user ID',
        example: '1',
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
        description: 'Page number (starts from 1)',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Number of courses per page (1-100)',
        example: 10,
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        description: 'Sort field',
        enum: ['title', 'createdAt', 'updatedAt'],
        example: 'createdAt',
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        description: 'Sort order',
        enum: ['ASC', 'DESC'],
        example: 'DESC',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Courses retrieved successfully',
        type: CourseListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async findAll(
        @Query() filters: CourseFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<CourseListResponseDto> {
        try {
            this.logger.log(
                `Listing courses with filters: ${JSON.stringify(filters)} for org: ${scope.orgId}, branch: ${scope.branchId}`,
            );

            const result = await this.courseService.findAll(filters, scope);

            this.logger.log(
                `Retrieved ${result.courses.length} courses out of ${result.total} total`,
            );

            return result;
        } catch (error) {
            this.logger.error('Error listing courses:', error);
            throw error;
        }
    }

    @Get('my-courses')
    @ApiOperation({
        summary: '👤 Get My Created Courses',
        description: `
      **Retrieves courses created by the authenticated user**
      
      This endpoint returns all courses that the current user has created with:
      - Personal course management
      - Creation history tracking
      - Course ownership validation
      - Pagination support
      
      **Features:**
      - Only shows courses created by current user
      - Includes all course statistics
      - Supports same filtering as general course list
      - Optimized for course management dashboard
      
      **Use Cases:**
      - Personal course dashboard
      - Course management interface
      - Creator analytics
      - Course editing access
    `,
        operationId: 'getMyCreatedCourses',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User courses retrieved successfully',
        type: CourseListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getMyCreatedCourses(
        @Query() filters: CourseFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<CourseListResponseDto> {
        try {
            this.logger.log(`Getting courses created by user: ${scope.userId}`);

            const result = await this.courseService.findByCreator(
                scope.userId,
                filters,
                scope,
            );

            this.logger.log(
                `Retrieved ${result.courses.length} courses created by user: ${scope.userId}`,
            );

            return result;
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
      **Retrieves detailed information about a specific course**
      
      This endpoint provides comprehensive course data including:
      - Complete course information
      - Creator details and contact
      - Course statistics and analytics
      - Test count and student enrollment
      
      **Detailed Information:**
      - Basic course metadata (title, description, dates)
      - Creator profile information
      - Course statistics (tests, students, activity)
      - Access permissions and ownership
      
      **Security:**
      - Public course information available to all authenticated users
      - Detailed statistics may require ownership permissions
      - Sensitive data is filtered based on access level
      
      **Use Cases:**
      - Course detail pages
      - Pre-enrollment course preview
      - Course analytics dashboard
      - Administrative course review
    `,
        operationId: 'getCourseDetails',
    })
    @ApiParam({
        name: 'id',
        description: 'Course unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course details retrieved successfully',
        type: CourseDetailDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 404 },
                message: {
                    type: 'string',
                    example: 'Course with ID 1 not found',
                },
                error: { type: 'string', example: 'Not Found' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<CourseDetailDto> {
        try {
            this.logger.log(
                `Getting course details for ID: ${id} with org/branch scope`,
            );

            const course = await this.courseService.findOne(id, scope);

            if (!course) {
                this.logger.error(`Course not found: ${id}`);
                throw new NotFoundException(`Course with ID ${id} not found`);
            }

            this.logger.log(`Course details retrieved for ID: ${id}`);

            return course;
        } catch (error) {
            this.logger.error(`Error getting course ${id}:`, error);
            throw error;
        }
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: '📊 Get Course Statistics',
        description: `
      **Retrieves comprehensive analytics and statistics for a course**
      
      This endpoint provides detailed course metrics including:
      - Test performance analytics
      - Student engagement metrics
      - Course completion statistics
      - Activity timeline data
      
      **Analytics Provided:**
      - Total and active test counts
      - Student enrollment and attempt statistics
      - Average scores and pass rates
      - Activity patterns and engagement
      
      **Access Control:**
      - Only course creators can access detailed statistics
      - Requires ownership validation
      - Sensitive data protection
      
      **Use Cases:**
      - Course performance dashboard
      - Educational analytics
      - Instructor insights
      - Course improvement planning
    `,
        operationId: 'getCourseStatistics',
    })
    @ApiParam({
        name: 'id',
        description: 'Course unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course statistics retrieved successfully',
        type: CourseStatsDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '🚫 Access denied - Not course owner',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getStats(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<CourseStatsDto> {
        try {
            this.logger.log(
                `Getting course statistics for ID: ${id} by user: ${req.user.id}`,
            );

            // Validate ownership before providing stats
            await this.courseService.validateOwnership(id, req.user.id);

            const stats = await this.courseService.getStats(id);

            this.logger.log(`Course statistics retrieved for ID: ${id}`);

            return stats;
        } catch (error) {
            this.logger.error(
                `Error getting course stats ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Course',
        description: `
      **Updates course information with ownership validation**
      
      This endpoint allows course creators to update their courses including:
      - Course title and description modifications
      - Metadata updates
      - Ownership verification
      - Change tracking
      
      **Updatable Fields:**
      - Course title (with validation)
      - Course description
      - Update timestamp (automatic)
      
      **Security Features:**
      - Only course creators can update courses
      - Ownership validation required
      - Input validation and sanitization
      - Change audit logging
      
      **Business Rules:**
      - Course title must remain unique per creator
      - Description updates are optional
      - Cannot change course creator
      - Update timestamp is automatic
      
      **Use Cases:**
      - Course content updates
      - Title and description corrections
      - Course information maintenance
      - Content management workflows
    `,
        operationId: 'updateCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiBody({
        type: UpdateCourseDto,
        description: 'Course update data',
        examples: {
            'title-update': {
                summary: '📝 Update Title Only',
                description: 'Update just the course title',
                value: {
                    title: 'Advanced Computer Science Concepts',
                },
            },
            'description-update': {
                summary: '📄 Update Description Only',
                description: 'Update just the course description',
                value: {
                    description:
                        'An advanced course covering complex computer science topics including advanced algorithms, system design, and software architecture patterns.',
                },
            },
            'full-update': {
                summary: '🔄 Complete Update',
                description: 'Update both title and description',
                value: {
                    title: 'Advanced Computer Science & Software Engineering',
                    description:
                        'A comprehensive advanced course covering computer science theory, practical software engineering, system design patterns, and industry best practices.',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course updated successfully',
        type: CourseResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '🚫 Access denied - Not course owner',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCourseDto: UpdateCourseDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<CourseResponseDto> {
        try {
            this.logger.log(`Updating course ${id} for user: ${req.user.id}`);

            const course = await this.courseService.update(
                id,
                updateCourseDto,
                req.user.id,
            );

            this.logger.log(`Course ${id} updated successfully`);

            return course;
        } catch (error) {
            this.logger.error(
                `Error updating course ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Course',
        description: `
      **Permanently deletes a course with comprehensive validation**
      
      This endpoint allows course creators to delete their courses with:
      - Ownership verification
      - Cascade relationship handling
      - Data integrity protection
      - Audit trail logging
      
      **Deletion Process:**
      - Validates user ownership
      - Checks for dependent data (tests, attempts)
      - Performs cascading deletions as needed
      - Logs deletion for audit purposes
      
      **Safety Features:**
      - Only course creators can delete courses
      - Prevents deletion of courses with active tests/attempts
      - Confirms deletion before execution
      - Maintains referential integrity
      
      **Important Notes:**
      - **This action is irreversible**
      - All course data will be permanently deleted
      - Associated tests and attempts may be removed
      - Consider archiving instead of deletion
      
      **Use Cases:**
      - Course cleanup and maintenance
      - Removing outdated content
      - Administrative course management
      - Course lifecycle management
    `,
        operationId: 'deleteCourse',
    })
    @ApiParam({
        name: 'id',
        description: 'Course unique identifier',
        example: 1,
        type: 'number',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Course deleted successfully',
                },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '🚫 Access denied - Not course owner',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot delete course with active tests',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Deleting course ${id} for user: ${req.user.id}`);

            await this.courseService.remove(id, req.user.id);

            this.logger.log(`Course ${id} deleted successfully`);

            return {
                success: true,
                message: 'Course deleted successfully',
                data: null,
            };
        } catch (error) {
            this.logger.error(
                `Error deleting course ${id} for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
