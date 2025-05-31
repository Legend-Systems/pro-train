import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
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
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { TestService } from './test.service';
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
import { StandardApiResponse } from '../user/dto/common-response.dto';

@ApiTags('📝 Test Management')
@Controller('tests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class TestController {
    private readonly logger = new Logger(TestController.name);

    constructor(private readonly testService: TestService) {}

    @Post()
    @ApiOperation({
        summary: '📝 Create New Test',
        description: `
      **Creates a new test within a course with comprehensive configuration options**
      
      This endpoint allows course instructors to create tests including:
      - Test metadata (title, description, type)
      - Timing configuration (duration, attempts)
      - Test behavior settings
      
      **Authorization Requirements:**
      - Must be the owner of the course
      - Valid JWT authentication required
      
      **Business Rules:**
      - Course must exist and be accessible to the user
      - Test type determines available features and behavior
      - Duration is optional (null for untimed tests)
      - Maximum attempts defaults to 1 if not specified
      
      **Use Cases:**
      - Creating course examinations
      - Setting up practice quizzes
      - Preparing training assessments
    `,
        operationId: 'createTest',
    })
    @ApiBody({
        type: CreateTestDto,
        description: 'Test creation data with course assignment',
        examples: {
            'final-exam': {
                summary: '🎓 Final Exam Creation',
                description: 'Create a comprehensive final examination',
                value: {
                    courseId: 1,
                    title: 'Final Exam - Computer Science Fundamentals',
                    description:
                        'Comprehensive final examination covering all course material. Time limit: 3 hours.',
                    testType: 'exam',
                    durationMinutes: 180,
                    maxAttempts: 1,
                },
            },
            'practice-quiz': {
                summary: '📋 Practice Quiz Creation',
                description: 'Create a practice quiz for students',
                value: {
                    courseId: 1,
                    title: 'Chapter 3 Practice Quiz',
                    description:
                        'Practice quiz covering data structures and algorithms.',
                    testType: 'quiz',
                    durationMinutes: 45,
                    maxAttempts: 3,
                },
            },
            'untimed-training': {
                summary: '🏃 Training Module Creation',
                description: 'Create an untimed training assessment',
                value: {
                    courseId: 1,
                    title: 'Python Basics Training',
                    description:
                        'Self-paced training module for Python fundamentals.',
                    testType: 'training',
                    maxAttempts: 5,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Test created successfully',
        type: TestResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to the specified course',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
    })
    async create(
        @Body() createTestDto: CreateTestDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestResponseDto>> {
        try {
            this.logger.log(
                `Creating test for course ${createTestDto.courseId} by user: ${scope.userId}`,
            );

            const test = await this.testService.create(createTestDto, scope);

            this.logger.log(
                `Test created successfully with ID: ${test.testId}`,
            );

            return {
                success: true,
                message: 'Test created successfully',
                data: test,
            };
        } catch (error) {
            this.logger.error(
                `Error creating test for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get()
    @ApiOperation({
        summary: '📋 List Tests with Advanced Filtering',
        description: `
      **Retrieves a paginated list of tests with comprehensive filtering options**
      
      This endpoint provides powerful search and filtering capabilities:
      - Course-based filtering
      - Test type and status filtering
      - Date range filtering
      - Duration and attempt constraints
      - Flexible sorting and pagination
      
      **Access Control:**
      - Returns tests from courses the user has access to
      - Instructors see all tests in their courses
      - Students see only active tests (when implemented)
      
      **Performance Features:**
      - Efficient pagination
      - Database query optimization
      - Retry logic for connection resilience
      
      **Use Cases:**
      - Course management dashboards
      - Test discovery for students
      - Administrative oversight
      - Academic analytics
    `,
        operationId: 'listTests',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        type: Number,
        description: 'Filter tests by course ID',
        example: 1,
    })
    @ApiQuery({
        name: 'title',
        required: false,
        type: String,
        description: 'Search tests by title (partial match)',
        example: 'midterm',
    })
    @ApiQuery({
        name: 'testType',
        required: false,
        enum: ['exam', 'quiz', 'training'],
        description: 'Filter by test type',
        example: 'exam',
    })
    @ApiQuery({
        name: 'isActive',
        required: false,
        type: Boolean,
        description: 'Filter by active status',
        example: true,
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number for pagination',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        type: Number,
        description: 'Number of tests per page (max 100)',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Tests retrieved successfully',
        type: TestListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid query parameters',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async findAll(
        @Query() filters: TestFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestListResponseDto>> {
        try {
            this.logger.log(`Listing tests for user: ${scope.userId}`);

            const result = await this.testService.findAll(filters, scope);

            this.logger.log(
                `Retrieved ${result.tests.length} tests (${result.total} total)`,
            );

            return {
                success: true,
                message: 'Tests retrieved successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error listing tests for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('course/:courseId')
    @ApiOperation({
        summary: '🎓 Get Tests for Specific Course',
        description: `
      **Retrieves all tests belonging to a specific course**
      
      This endpoint provides course-specific test listings:
      - All tests within the specified course
      - Includes test metadata and statistics
      - Ordered by creation date (newest first)
      
      **Authorization:**
      - Course access validation
      - Ownership verification for full details
      
      **Response Includes:**
      - Basic test information
      - Question counts and attempt statistics
      - Course context information
      
      **Use Cases:**
      - Course dashboard displays
      - Test management interfaces
      - Student test selection
      - Academic progress tracking
    `,
        operationId: 'getTestsByCourse',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course tests retrieved successfully',
        type: TestListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found',
    })
    async findByCourse(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestListResponseDto>> {
        try {
            this.logger.log(
                `Getting tests for course ${courseId} by user: ${scope.userId}`,
            );

            const result = await this.testService.findByCourse(courseId, scope);

            this.logger.log(
                `Retrieved ${result.tests.length} tests for course ${courseId}`,
            );

            return {
                success: true,
                message: 'Course tests retrieved successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error getting tests for course ${courseId} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Detailed Test Information',
        description: `
      **Retrieves comprehensive information about a specific test**
      
      This endpoint provides complete test details including:
      - Test configuration and metadata
      - Course context and relationship
      - Question summary (when available)
      - Performance statistics and analytics
      
      **Access Control:**
      - Course ownership validation
      - Read access for authorized users
      - Detailed statistics for instructors
      
      **Response Includes:**
      - Complete test configuration
      - Related course information
      - Question count and structure
      - Attempt and performance statistics
      
      **Use Cases:**
      - Test detail views
      - Test editing interfaces
      - Performance analysis
      - Academic reporting
    `,
        operationId: 'getTestById',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test details retrieved successfully',
        type: TestDetailDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestDetailDto>> {
        try {
            this.logger.log(`Getting test ${id} for user: ${scope.userId}`);

            const test = await this.testService.findOne(id, scope.userId);

            if (!test) {
                throw new NotFoundException(`Test with ID ${id} not found`);
            }

            this.logger.log(`Test ${id} retrieved successfully`);

            return {
                success: true,
                message: 'Test details retrieved successfully',
                data: test,
            };
        } catch (error) {
            this.logger.error(
                `Error getting test ${id} for user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Test Configuration',
        description: `
      **Updates test configuration and settings with validation**
      
      This endpoint allows comprehensive test updates including:
      - Test metadata (title, description)
      - Timing configuration (duration, attempts)
      - Test type and behavior settings
      
      **Authorization Requirements:**
      - Must be the owner of the parent course
      - Valid JWT authentication required
      
      **Business Rules:**
      - Cannot change course assignment (tests cannot be moved)
      - Updates affect future attempts only
      - Active tests can be updated with caution
      
      **Validation:**
      - Input data validation
      - Course ownership verification
      - Business rule enforcement
      
      **Use Cases:**
      - Test configuration adjustments
      - Timing modifications
      - Description updates
      - Access control changes
    `,
        operationId: 'updateTest',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateTestDto,
        description: 'Test update data (excludes course assignment)',
        examples: {
            'extend-duration': {
                summary: '⏰ Extend Test Duration',
                description: 'Increase test duration for accessibility',
                value: {
                    durationMinutes: 240,
                    description:
                        'Extended duration final exam - 4 hours allowed for accessibility accommodations.',
                },
            },
            'allow-retakes': {
                summary: '🔄 Allow Additional Attempts',
                description: 'Increase maximum attempts for practice',
                value: {
                    maxAttempts: 3,
                    description:
                        'Practice quiz with multiple attempts allowed for learning.',
                },
            },
            'update-title': {
                summary: '📝 Update Test Information',
                description: 'Update test title and description',
                value: {
                    title: 'Midterm Exam - Advanced Topics (Updated)',
                    description:
                        'Updated midterm exam covering advanced course topics including new material from weeks 8-10.',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test updated successfully',
        type: TestResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to update this test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTestDto: UpdateTestDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestResponseDto>> {
        try {
            this.logger.log(`Updating test ${id} by user: ${scope.userId}`);

            const test = await this.testService.update(
                id,
                updateTestDto,
                scope.userId,
            );

            this.logger.log(`Test ${id} updated successfully`);

            return {
                success: true,
                message: 'Test updated successfully',
                data: test,
            };
        } catch (error) {
            this.logger.error(
                `Error updating test ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Patch(':id/activate')
    @ApiOperation({
        summary: '✅ Activate Test',
        description: `
      **Activates a test making it available for student attempts**
      
      This endpoint enables test access for students:
      - Sets test status to active
      - Makes test visible to students
      - Enables attempt submissions
      
      **Authorization:**
      - Requires course ownership
      - Instructor privileges required
      
      **Business Impact:**
      - Students can start new attempts
      - Test appears in available tests
      - Scheduling and access rules apply
      
      **Use Cases:**
      - Test publication
      - Scheduled test activation
      - Emergency test enabling
    `,
        operationId: 'activateTest',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier to activate',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test activated successfully',
        type: TestResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to activate this test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async activate(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestResponseDto>> {
        try {
            this.logger.log(`Activating test ${id} by user: ${scope.userId}`);

            const test = await this.testService.activate(id, scope.userId);

            this.logger.log(`Test ${id} activated successfully`);

            return {
                success: true,
                message: 'Test activated successfully',
                data: test,
            };
        } catch (error) {
            this.logger.error(
                `Error activating test ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Patch(':id/deactivate')
    @ApiOperation({
        summary: '⏸️ Deactivate Test',
        description: `
      **Deactivates a test preventing new student attempts**
      
      This endpoint disables test access for students:
      - Sets test status to inactive
      - Prevents new attempt starts
      - Hides test from student view
      
      **Authorization:**
      - Requires course ownership
      - Instructor privileges required
      
      **Business Impact:**
      - No new attempts can be started
      - Existing attempts continue normally
      - Test becomes invisible to students
      
      **Use Cases:**
      - Test closure after deadline
      - Emergency test suspension
      - Scheduled test deactivation
    `,
        operationId: 'deactivateTest',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier to deactivate',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test deactivated successfully',
        type: TestResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to deactivate this test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async deactivate(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestResponseDto>> {
        try {
            this.logger.log(`Deactivating test ${id} by user: ${scope.userId}`);

            const test = await this.testService.deactivate(id, scope.userId);

            this.logger.log(`Test ${id} deactivated successfully`);

            return {
                success: true,
                message: 'Test deactivated successfully',
                data: test,
            };
        } catch (error) {
            this.logger.error(
                `Error deactivating test ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: '📊 Get Test Statistics and Analytics',
        description: `
      **Retrieves comprehensive test performance statistics and analytics**
      
      This endpoint provides detailed analytics including:
      - Overall test performance metrics
      - Score distribution and trends
      - Attempt and completion statistics
      - Student participation analytics
      
      **Authorization:**
      - Requires course ownership
      - Instructor analytics access
      
      **Analytics Include:**
      - Performance summaries
      - Score distributions
      - Completion rates
      - Time-based trends
      
      **Use Cases:**
      - Academic performance analysis
      - Test quality assessment
      - Student progress tracking
      - Course improvement insights
    `,
        operationId: 'getTestStats',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier for statistics',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test statistics retrieved successfully',
        type: TestStatsDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to view test statistics',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async getStats(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestStatsDto>> {
        try {
            this.logger.log(
                `Getting stats for test ${id} by user: ${scope.userId}`,
            );

            const stats = await this.testService.getStats(id, scope.userId);

            this.logger.log(`Stats retrieved for test ${id}`);

            return {
                success: true,
                message: 'Test statistics retrieved successfully',
                data: stats,
            };
        } catch (error) {
            this.logger.error(
                `Error getting stats for test ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id/config')
    @ApiOperation({
        summary: '⚙️ Get Test Configuration',
        description: `
      **Retrieves detailed test configuration and settings**
      
      This endpoint provides complete test configuration:
      - Timing and access settings
      - Content configuration
      - Behavioral parameters
      - Administrative settings
      
      **Authorization:**
      - Requires course ownership
      - Configuration access for instructors
      
      **Configuration Includes:**
      - Test identification
      - Timing parameters
      - Access controls
      - Content settings
      
      **Use Cases:**
      - Test administration interfaces
      - Configuration verification
      - Settings comparison
      - Audit and compliance
    `,
        operationId: 'getTestConfig',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier for configuration',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test configuration retrieved successfully',
        type: TestConfigDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to view test configuration',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async getConfig(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestConfigDto>> {
        try {
            this.logger.log(
                `Getting config for test ${id} by user: ${scope.userId}`,
            );

            const config = await this.testService.getConfig(id, scope.userId);

            this.logger.log(`Config retrieved for test ${id}`);

            return {
                success: true,
                message: 'Test configuration retrieved successfully',
                data: config,
            };
        } catch (error) {
            this.logger.error(
                `Error getting config for test ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Test',
        description: `
      **Permanently deletes a test and all associated data**
      
      ⚠️ **WARNING: This action is irreversible!**
      
      This endpoint removes:
      - Test configuration and metadata
      - Associated questions and options (cascade)
      - Student attempts and responses (cascade)
      - Results and analytics data (cascade)
      
      **Authorization Requirements:**
      - Must be the owner of the parent course
      - Administrative privileges required
      
      **Business Rules:**
      - Validates no active attempts exist
      - Checks for dependent data
      - Performs cascade deletion
      
      **Safety Measures:**
      - Course ownership verification
      - Dependency validation
      - Audit logging
      
      **Use Cases:**
      - Test cleanup and maintenance
      - Course restructuring
      - Administrative corrections
      - Data privacy compliance
    `,
        operationId: 'deleteTest',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Test identifier to delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Test deleted successfully',
                },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to delete this test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Conflict - Test has active attempts or dependencies',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<null>> {
        try {
            this.logger.log(`Deleting test ${id} by user: ${scope.userId}`);

            await this.testService.remove(id, scope.userId);

            this.logger.log(`Test ${id} deleted successfully`);

            return {
                success: true,
                message: 'Test deleted successfully',
                data: null,
            };
        } catch (error) {
            this.logger.error(
                `Error deleting test ${id} by user ${scope.userId}:`,
                error,
            );
            throw error;
        }
    }
}
