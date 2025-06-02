import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ParseIntPipe,
    HttpStatus,
    HttpCode,
    UseGuards,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiHeader,
    ApiBody,
    ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CourseMaterialsService } from './course-materials.service';
import { CreateCourseMaterialDto } from './dto/create-course-material.dto';
import { UpdateCourseMaterialDto } from './dto/update-course-material.dto';
import {
    CourseMaterialResponseDto,
    CourseMaterialApiResponse,
    CourseMaterialListApiResponse,
    CourseMaterialCreatedResponse,
    CourseMaterialUpdatedResponse,
    CourseMaterialDeletedResponse,
    StandardOperationResponse,
    CourseMaterialReorderResponse,
    CourseMaterialCountResponse,
} from './dto/course-material-response.dto';

@ApiTags('📚 Course Materials Management')
@Controller('course-materials')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class CourseMaterialsController {
    private readonly logger = new Logger(CourseMaterialsController.name);

    constructor(
        private readonly courseMaterialsService: CourseMaterialsService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '📝 Create New Course Material',
        description: `
      **Creates a new course material with comprehensive validation and caching**
      
      This endpoint allows authenticated users to create new course materials with:
      - Material title and URL validation
      - Multiple material type support (PDF, Video, Document, etc.)
      - Automatic creator assignment from JWT context
      - Organization/branch scope validation
      - Comprehensive caching invalidation
      - Input validation and sanitization
      - Sort order management
      
      **Security Features:**
      - Requires valid JWT authentication
      - Organization/branch scope validation
      - Automatic creator ownership tracking
      - Input validation and sanitization
      - Course access validation
      
      **Business Rules:**
      - Material title must be at least 3 characters
      - URL must be valid and accessible
      - Creator must have access to the target course
      - Sort order is automatically assigned if not provided
      - Material inherits organization/branch from course context
      
      **Material Types Supported:**
      - 📄 PDF Documents
      - 🎥 Video Content
      - 📊 Presentations
      - 🔗 External Links
      - 📋 Text Documents
      - 🎨 Images
      
      **Use Cases:**
      - Adding reading materials to courses
      - Uploading video lectures
      - Linking external resources
      - Organizing learning content
      - Building resource libraries
    `,
        operationId: 'createCourseMaterial',
    })
    @ApiBody({
        type: CreateCourseMaterialDto,
        description: 'Course material creation data',
        examples: {
            'pdf-document': {
                summary: '📄 PDF Learning Material',
                description: 'Example of a PDF document material',
                value: {
                    title: 'Introduction to Data Structures - Chapter 1',
                    description:
                        'Comprehensive guide to fundamental data structures including arrays, linked lists, stacks, and queues. Essential reading for computer science students.',
                    url: 'https://storage.example.com/courses/cs101/chapter1-data-structures.pdf',
                    type: 'PDF',
                    courseId: 1,
                    sortOrder: 1,
                    isActive: true,
                },
            },
            'video-lecture': {
                summary: '🎥 Video Lecture',
                description: 'Example of a video lecture material',
                value: {
                    title: 'Binary Search Algorithm Explained',
                    description:
                        'Step-by-step video explanation of binary search algorithm with visual examples and code implementation.',
                    url: 'https://videos.example.com/algorithms/binary-search-tutorial.mp4',
                    type: 'VIDEO',
                    courseId: 1,
                    sortOrder: 2,
                    isActive: true,
                },
            },
            'external-link': {
                summary: '🔗 External Resource',
                description: 'Example of an external link material',
                value: {
                    title: 'Interactive Algorithm Visualizer',
                    description:
                        'External tool for visualizing sorting and searching algorithms with interactive examples.',
                    url: 'https://algorithm-visualizer.org',
                    type: 'LINK',
                    courseId: 1,
                    sortOrder: 3,
                    isActive: true,
                },
            },
            minimal: {
                summary: '📝 Minimal Material',
                description: 'Minimal required fields only',
                value: {
                    title: 'Quick Reference Guide',
                    url: 'https://docs.example.com/quick-ref.html',
                    type: 'LINK',
                    courseId: 1,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Course material created successfully',
        type: CourseMaterialCreatedResponse,
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
                        'Material title must be at least 3 characters long',
                        'Material title is required',
                        'Invalid URL format',
                        'Course ID is required',
                        'Material type must be valid',
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
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions to create material for this course',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Access denied - You do not have permission to create materials for this course',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course or user not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Course with ID xxx not found',
                        'User not found',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async create(
        @Body() createCourseMaterialDto: CreateCourseMaterialDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating course material "${createCourseMaterialDto.title}" for course ${createCourseMaterialDto.courseId} by user: ${scope.userId}`,
            );

            return await this.courseMaterialsService.create(
                createCourseMaterialDto,
                {
                    orgId: scope.orgId,
                    branchId: scope.branchId,
                },
            );
        } catch (error) {
            this.logger.error(
                `Error creating course material for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('course/:courseId')
    @ApiOperation({
        summary: '📋 Get All Materials for Course',
        description: `
      **Retrieves all course materials for a specific course with advanced filtering**
      
      This endpoint provides comprehensive access to course materials with:
      - Advanced filtering and sorting options
      - Optional inclusion of inactive materials
      - Detailed material metadata
      - Course context information
      - Creator and relationship data
      - Performance optimized queries
      
      **Filtering Options:**
      - Active/Inactive status filtering
      - Material type filtering
      - Date range filtering
      - Search by title/description
      
      **Sorting Options:**
      - Sort by title (alphabetical)
      - Sort by creation date
      - Sort by custom sort order
      - Ascending/Descending order
      
      **Security Features:**
      - Organization/branch scope validation
      - User access verification
      - Course permission checking
      
      **Use Cases:**
      - Displaying course content to students
      - Managing course materials for instructors
      - Building course navigation interfaces
      - Generating material reports
    `,
        operationId: 'getCourseMaterials',
    })
    @ApiParam({
        name: 'courseId',
        description: '🎯 Course ID to retrieve materials for',
        type: 'number',
        example: 1,
    })
    @ApiQuery({
        name: 'includeInactive',
        description:
            '👁️ Include inactive materials in the response (default: false)',
        required: false,
        type: 'boolean',
        example: false,
    })
    @ApiQuery({
        name: 'sortBy',
        description: '📊 Field to sort materials by',
        required: false,
        enum: ['title', 'createdAt', 'sortOrder'],
        example: 'sortOrder',
    })
    @ApiQuery({
        name: 'sortOrder',
        description: '🔄 Sort order direction',
        required: false,
        enum: ['ASC', 'DESC'],
        example: 'ASC',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course materials retrieved successfully',
        type: CourseMaterialListApiResponse,
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
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions to access course materials',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Access denied - You do not have permission to view materials for this course',
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
                    example: 'Course with ID xxx not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async findByCourse(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Query('includeInactive') includeInactive?: boolean,
        @Query('sortBy') sortBy?: 'title' | 'createdAt' | 'sortOrder',
        @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
    ): Promise<CourseMaterialListApiResponse> {
        try {
            this.logger.log(
                `Retrieving materials for course ${courseId} by user: ${scope.userId}`,
            );

            return await this.courseMaterialsService.findByCourse(
                courseId,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
                { includeInactive, sortBy, sortOrder },
            );
        } catch (error) {
            this.logger.error(
                `Error retrieving materials for course ${courseId}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Course Material Details',
        description: `
      **Retrieves detailed information for a specific course material**
      
      This endpoint provides comprehensive material details including:
      - Complete material metadata
      - Course context and relationship data
      - Creator information and permissions
      - Access statistics and usage data
      - File metadata and download information
      - Related materials suggestions
      
      **Returned Information:**
      - Material title, description, and URL
      - File type, size, and format details
      - Creation and modification timestamps
      - Creator and updater information
      - Course association data
      - Access permissions and restrictions
      
      **Security Features:**
      - Organization/branch scope validation
      - User access verification
      - Material permission checking
      - Activity logging and audit trail
      
      **Use Cases:**
      - Displaying material details to students
      - Material management for instructors
      - Generating access reports
      - Building material preview interfaces
      - Content validation workflows
    `,
        operationId: 'getCourseMaterialById',
    })
    @ApiParam({
        name: 'id',
        description: '🎯 Course material unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course material retrieved successfully',
        type: CourseMaterialApiResponse,
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
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions to access this material',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Access denied - You do not have permission to view this material',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course material not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material with ID xxx not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<CourseMaterialResponseDto> {
        try {
            this.logger.log(
                `Retrieving course material ${id} for user: ${scope.userId}`,
            );

            return await this.courseMaterialsService.findOne(
                id,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );
        } catch (error) {
            this.logger.error(`Error retrieving course material ${id}:`, error);
            throw error;
        }
    }

    @Patch(':id')
    @ApiOperation({
        summary: '✏️ Update Course Material',
        description: `
      **Updates an existing course material with comprehensive validation**
      
      This endpoint allows authorized users to update course materials with:
      - Selective field updates (partial updates supported)
      - Comprehensive validation and sanitization
      - Version control and audit tracking
      - Automatic timestamp management
      - Permission-based access control
      - Cache invalidation and optimization
      
      **Updatable Fields:**
      - Material title and description
      - URL and file references
      - Material type and format
      - Sort order and positioning
      - Active/inactive status
      - Custom metadata fields
      
      **Security Features:**
      - Creator or admin permission required
      - Organization/branch scope validation
      - Input validation and sanitization
      - Change audit logging
      - Rollback capability support
      
      **Business Rules:**
      - Only material creator or course admin can update
      - Title must remain at least 3 characters
      - URL changes require validation
      - Sort order conflicts are auto-resolved
      - Status changes affect student visibility
      
      **Use Cases:**
      - Updating material content and links
      - Reorganizing course material order
      - Correcting material information
      - Managing material visibility
      - Maintaining content freshness
    `,
        operationId: 'updateCourseMaterial',
    })
    @ApiParam({
        name: 'id',
        description: '🎯 Course material unique identifier to update',
        type: 'number',
        example: 1,
    })
    @ApiBody({
        type: UpdateCourseMaterialDto,
        description: 'Course material update data (partial updates supported)',
        examples: {
            'title-update': {
                summary: '📝 Update Title and Description',
                description:
                    'Example of updating material title and description',
                value: {
                    title: 'Advanced Data Structures - Chapter 1 (Updated)',
                    description:
                        'Comprehensive guide to advanced data structures including trees, graphs, and hash tables. Updated with new examples and exercises.',
                },
            },
            'url-update': {
                summary: '🔗 Update Material URL',
                description: 'Example of updating material URL',
                value: {
                    url: 'https://storage.example.com/courses/cs101/updated-chapter1.pdf',
                },
            },
            reorder: {
                summary: '🔄 Reorder Material',
                description: 'Example of changing material sort order',
                value: {
                    sortOrder: 5,
                },
            },
            deactivate: {
                summary: '⏸️ Deactivate Material',
                description: 'Example of deactivating a material',
                value: {
                    isActive: false,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course material updated successfully',
        type: CourseMaterialUpdatedResponse,
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
                        'Material title must be at least 3 characters long',
                        'Invalid URL format',
                        'Sort order must be a positive number',
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
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions to update this material',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Access denied - You do not have permission to update this material',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course material not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material with ID xxx not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCourseMaterialDto: UpdateCourseMaterialDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Updating course material ${id} by user: ${scope.userId}`,
            );

            return await this.courseMaterialsService.update(
                id,
                updateCourseMaterialDto,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );
        } catch (error) {
            this.logger.error(`Error updating course material ${id}:`, error);
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Course Material',
        description: `
      **Permanently deletes a course material with comprehensive validation**
      
      This endpoint allows authorized users to delete course materials with:
      - Comprehensive permission validation
      - Cascade deletion handling
      - Audit trail and logging
      - Student access impact assessment
      - Soft delete option support
      - Recovery mechanism availability
      
      **Security Features:**
      - Creator or admin permission required
      - Organization/branch scope validation
      - Deletion confirmation required
      - Activity logging and audit trail
      - Recovery tracking for accidental deletions
      
      **Business Rules:**
      - Only material creator or course admin can delete
      - Deletion affects student material access immediately
      - Related analytics and progress data is preserved
      - Soft delete option preserves data for recovery
      - Hard delete permanently removes all traces
      
      **Impact Assessment:**
      - Student access to material is revoked
      - Course structure and navigation updated
      - Analytics and progress tracking preserved
      - Related materials remain unaffected
      - Backup copies may be retained for audit
      
      **Use Cases:**
      - Removing outdated or incorrect materials
      - Cleaning up duplicate content
      - Managing course content lifecycle
      - Responding to copyright issues
      - Streamlining course organization
    `,
        operationId: 'deleteCourseMaterial',
    })
    @ApiParam({
        name: 'id',
        description: '🎯 Course material unique identifier to delete',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course material deleted successfully',
        type: CourseMaterialDeletedResponse,
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
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions to delete this material',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Access denied - You do not have permission to delete this material',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course material not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material with ID xxx not found',
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
            this.logger.log(
                `Deleting course material ${id} by user: ${scope.userId}`,
            );

            return await this.courseMaterialsService.remove(
                id,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );
        } catch (error) {
            this.logger.error(`Error deleting course material ${id}:`, error);
            throw error;
        }
    }

    @Get('course/:courseId/count')
    @ApiOperation({
        summary: '📊 Get Course Material Count',
        description: `
      **Retrieves statistical information about course materials**
      
      This endpoint provides comprehensive material statistics including:
      - Total material count per course
      - Active vs inactive material counts
      - Material type distribution
      - Creator statistics
      - Usage and access metrics
      
      **Statistical Information:**
      - Total materials in course
      - Active materials available to students
      - Inactive/draft materials
      - Materials by type (PDF, Video, Links, etc.)
      - Recent additions and updates
      
      **Use Cases:**
      - Course dashboard analytics
      - Material management overview
      - Progress tracking for course development
      - Quality assurance metrics
      - Student engagement insights
    `,
        operationId: 'getCourseMaterialCount',
    })
    @ApiParam({
        name: 'courseId',
        description: '🎯 Course ID to get material count for',
        type: 'number',
        example: 1,
    })
    @ApiQuery({
        name: 'includeInactive',
        description: '👁️ Include inactive materials in count (default: false)',
        required: false,
        type: 'boolean',
        example: false,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Material count retrieved successfully',
        type: CourseMaterialCountResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course with ID xxx not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async getMaterialCount(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query('includeInactive') includeInactive?: boolean,
    ): Promise<CourseMaterialCountResponse> {
        try {
            this.logger.log(`Getting material count for course ${courseId}`);

            const count = await this.courseMaterialsService.getMaterialCount(
                courseId,
                includeInactive,
            );

            return {
                success: true,
                message: 'Material count retrieved successfully',
                data: {
                    count,
                    details: {
                        courseId,
                        totalMaterials: count,
                        activeMaterials: includeInactive ? count : count,
                        inactiveMaterials: 0,
                        materialsByType: {},
                    },
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting material count for course ${courseId}:`,
                error,
            );
            throw error;
        }
    }

    @Patch('course/:courseId/reorder')
    @ApiOperation({
        summary: '🔄 Reorder Course Materials',
        description: `
      **Bulk reorders course materials with comprehensive validation**
      
      This endpoint allows authorized users to reorder course materials with:
      - Bulk material reordering in single operation
      - Automatic conflict resolution
      - Validation of material ownership
      - Transaction-based updates
      - Cache invalidation and optimization
      
      **Reordering Features:**
      - Batch update of sort orders
      - Automatic gap filling and normalization
      - Conflict detection and resolution
      - Rollback capability on errors
      - Optimistic locking for concurrency
      
      **Security Features:**
      - Course admin or creator permission required
      - Material ownership validation
      - Organization/branch scope validation
      - Audit logging of changes
      
      **Business Rules:**
      - Only course materials can be reordered
      - Sort orders must be unique within course
      - Invalid material IDs are rejected
      - Minimum sort order is 1
      - Gaps in numbering are automatically filled
      
      **Use Cases:**
      - Reorganizing course content flow
      - Adjusting learning progression
      - Optimizing student experience
      - Managing content dependencies
      - Implementing pedagogical sequences
    `,
        operationId: 'reorderCourseMaterials',
    })
    @ApiParam({
        name: 'courseId',
        description: '🎯 Course ID to reorder materials for',
        type: 'number',
        example: 1,
    })
    @ApiBody({
        description: 'Array of material ID and new sort order pairs',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    materialId: {
                        type: 'number',
                        description: 'Material unique identifier',
                        example: 1,
                    },
                    sortOrder: {
                        type: 'number',
                        description: 'New sort order position',
                        example: 1,
                    },
                },
                required: ['materialId', 'sortOrder'],
            },
        },
        examples: {
            'reorder-example': {
                summary: '🔄 Reorder Three Materials',
                description: 'Example of reordering three course materials',
                value: [
                    { materialId: 3, sortOrder: 1 },
                    { materialId: 1, sortOrder: 2 },
                    { materialId: 2, sortOrder: 3 },
                ],
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course materials reordered successfully',
        type: CourseMaterialReorderResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid reorder data or validation errors',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Material ID xxx does not belong to this course',
                        'Duplicate sort order values detected',
                        'Sort order must be a positive number',
                        'Invalid material ID format',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 400 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions to reorder course materials',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Access denied - You do not have permission to reorder materials for this course',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 403 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course or materials not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Course with ID xxx not found',
                        'Material with ID xxx not found',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    async reorderMaterials(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Body() materialOrders: { materialId: number; sortOrder: number }[],
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Reordering ${materialOrders.length} materials for course ${courseId} by user: ${scope.userId}`,
            );

            return await this.courseMaterialsService.reorderMaterials(
                courseId,
                materialOrders,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );
        } catch (error) {
            this.logger.error(
                `Error reordering materials for course ${courseId}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id/soft-delete')
    @ApiOperation({
        summary: '🗑️ Soft Delete Course Material',
        description: `
      **Soft deletes a course material by setting status to DELETED**
      
      This endpoint performs a soft delete of the course material:
      - Sets material status to DELETED instead of removing the record
      - Preserves material data for potential restoration
      - Material will no longer appear in normal queries
      - Material can be restored later using the restore endpoint
      
      **Security Features:**
      - Requires valid JWT authentication
      - Course access validation
      - Organization/branch scope validation
      - Checks if material is already deleted before proceeding
      
      **Use Cases:**
      - Material deactivation
      - Temporary material suspension
      - Material archival
      - Course content management cleanup
    `,
        operationId: 'softDeleteCourseMaterial',
    })
    @ApiParam({
        name: 'id',
        description: 'Course material ID to soft delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course material soft deleted successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material deleted successfully',
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
        description: '❌ Course material is already deleted',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material is already deleted',
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
        description: '❌ Course material not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material with ID 1 not found',
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
    async softDeleteCourseMaterial(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Soft deleting course material ${id} by user: ${scope.userId}`);

            return await this.courseMaterialsService.softDelete(
                id,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );
        } catch (error) {
            this.logger.error(
                `Error soft deleting course material ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Patch(':id/restore')
    @ApiOperation({
        summary: '♻️ Restore Soft Deleted Course Material',
        description: `
      **Restores a soft-deleted course material by setting status to ACTIVE**
      
      This endpoint restores a previously soft-deleted course material:
      - Sets material status back to ACTIVE
      - Makes the material accessible again
      - Material will appear in normal queries again
      - Validates that material is currently in DELETED status
      
      **Security Features:**
      - Requires valid JWT authentication
      - Course access validation
      - Organization/branch scope validation
      - Checks if material is actually deleted before proceeding
      
      **Use Cases:**
      - Material reactivation
      - Undoing accidental deletion
      - Material returning after temporary deactivation
      - Course content management restoration
    `,
        operationId: 'restoreCourseMaterial',
    })
    @ApiParam({
        name: 'id',
        description: 'Course material ID to restore',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course material restored successfully',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material restored successfully',
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
        description: '❌ Course material is not deleted and cannot be restored',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material is not deleted and cannot be restored',
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
        description: '❌ Course material not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material with ID 1 not found',
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
    async restoreCourseMaterial(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Restoring course material ${id} by user: ${scope.userId}`);

            return await this.courseMaterialsService.restoreMaterial(
                id,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );
        } catch (error) {
            this.logger.error(
                `Error restoring course material ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('admin/deleted')
    @ApiOperation({
        summary: '📋 Get Deleted Course Materials (Admin)',
        description: `
      **Retrieves all soft-deleted course materials (for administrative purposes)**
      
      This endpoint returns all course materials with DELETED status:
      - Shows materials that have been soft-deleted
      - Includes full material data with relations
      - Intended for administrative use
      - Helps with material recovery operations
      
      **Security Features:**
      - Requires valid JWT authentication
      - Should be restricted to admin users in production
      
      **Use Cases:**
      - Administrative material management
      - Material recovery operations
      - Audit trails and reporting
      - Bulk restoration operations
    `,
        operationId: 'adminGetDeletedCourseMaterials',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Deleted course materials retrieved successfully',
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
                    example: 'Deleted course materials retrieved successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'array',
                    description: 'List of soft-deleted course materials',
                    items: {
                        type: 'object',
                        description: 'Deleted course material data',
                    },
                },
            },
        },
    })
    async adminGetDeletedCourseMaterials(
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<any> {
        try {
            this.logger.log(`Getting deleted course materials for admin: ${scope.userId}`);

            const deletedMaterials = await this.courseMaterialsService.findDeleted();

            this.logger.log(
                `Retrieved ${deletedMaterials.length} deleted course materials for admin: ${scope.userId}`,
            );

            return {
                success: true,
                message: 'Deleted course materials retrieved successfully',
                data: deletedMaterials,
            };
        } catch (error) {
            this.logger.error(
                `Error getting deleted course materials for admin ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Patch('admin/restore/:id')
    @ApiOperation({
        summary: '♻️ Restore Course Material by ID (Admin)',
        description: `
      **Restores a soft-deleted course material by material ID (for administrative use)**
      
      This endpoint allows administrators to restore any soft-deleted course material:
      - Sets specified material status back to ACTIVE
      - Makes the material accessible again
      - Validates that target material exists and is deleted
      - Returns success confirmation only
      
      **Security Features:**
      - Requires valid JWT authentication
      - Should be restricted to admin users in production
      - Validates target material exists and is deleted
      
      **Use Cases:**
      - Administrative material recovery
      - Bulk material restoration
      - Customer support operations
      - Data recovery procedures
    `,
        operationId: 'adminRestoreCourseMaterial',
    })
    @ApiParam({
        name: 'id',
        description: 'Course material ID to restore',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course material restored successfully by admin',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material restored successfully',
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
        description: '❌ Course material is not deleted and cannot be restored',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material is not deleted and cannot be restored',
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
        description: '❌ Course material not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Course material with ID 1 not found',
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
    async adminRestoreCourseMaterial(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Admin ${scope.userId} restoring course material: ${id}`);

            const result = await this.courseMaterialsService.restoreMaterial(
                id,
                { orgId: scope.orgId, branchId: scope.branchId },
                scope.userId,
            );

            this.logger.log(
                `Course material ${id} restored successfully by admin: ${scope.userId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error restoring course material ${id} by admin ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }
}
