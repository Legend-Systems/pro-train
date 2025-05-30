import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Req,
    Query,
    HttpStatus,
    ParseIntPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiBody,
} from '@nestjs/swagger';
import { TestAttemptsService } from './test_attempts.service';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';
import { TestAttemptResponseDto } from './dto/test-attempt-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('📊 Test Attempts')
@Controller('test-attempts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TestAttemptsController {
    constructor(private readonly testAttemptsService: TestAttemptsService) {}

    @Post('start')
    @ApiOperation({
        summary: '🚀 Start Test Attempt',
        description: `
        **Start a new test attempt for a student**
        
        This endpoint allows students to begin taking a test. The system will:
        - Validate test availability and user access
        - Check maximum attempt limits
        - Ensure no active attempts exist for this test
        - Calculate expiration time based on test duration
        - Create a new attempt record with IN_PROGRESS status
        
        **Business Rules:**
        - Users cannot exceed the maximum attempts set for the test
        - Only one active attempt per test per user is allowed
        - Test must be active to start new attempts
        - Expiration time is calculated automatically if test has duration limit
        
        **Security:**
        - JWT authentication required
        - Users can only start attempts for themselves
        - Access control validation performed
        `,
    })
    @ApiBody({
        type: CreateTestAttemptDto,
        description: 'Test attempt details',
        examples: {
            basicAttempt: {
                summary: 'Basic test attempt',
                description: 'Start an attempt for a quiz',
                value: {
                    testId: 1,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Test attempt started successfully',
        type: TestAttemptResponseDto,
        example: {
            attemptId: 1,
            testId: 1,
            userId: '123e4567-e89b-12d3-a456-426614174000',
            attemptNumber: 1,
            status: 'in_progress',
            startTime: '2024-01-01T09:00:00.000Z',
            submitTime: null,
            expiresAt: '2024-01-01T11:00:00.000Z',
            progressPercentage: 0,
            createdAt: '2024-01-01T09:00:00.000Z',
            updatedAt: '2024-01-01T09:00:00.000Z',
            test: {
                testId: 1,
                title: 'JavaScript Fundamentals Quiz',
                testType: 'quiz',
                durationMinutes: 120,
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid request or business rule violation',
        example: {
            statusCode: 400,
            message: 'Maximum attempts (3) exceeded for this test',
            error: 'Bad Request',
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '❌ Active attempt already exists',
        example: {
            statusCode: 409,
            message: 'You already have an active attempt for this test',
            error: 'Conflict',
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
        example: {
            statusCode: 404,
            message: 'Test not found',
            error: 'Not Found',
        },
    })
    async startAttempt(
        @Body() createTestAttemptDto: CreateTestAttemptDto,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.startAttempt(
            createTestAttemptDto,
            req.user.id,
        );
    }

    @Post(':id/submit')
    @ApiOperation({
        summary: '📋 Submit Test Attempt',
        description: `
        **Submit a completed test attempt**
        
        This endpoint allows students to submit their test when finished. The system will:
        - Validate attempt ownership and status
        - Update attempt status to SUBMITTED
        - Record submission timestamp
        - Set progress to 100%
        - Trigger result calculation (if auto-grading enabled)
        
        **Business Rules:**
        - Only IN_PROGRESS attempts can be submitted
        - Once submitted, attempts cannot be modified
        - Submission is final and irreversible
        - Auto-grading will be triggered for objective questions
        
        **Security:**
        - JWT authentication required
        - Users can only submit their own attempts
        - Ownership validation performed
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to submit',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test attempt submitted successfully',
        type: TestAttemptResponseDto,
        example: {
            attemptId: 1,
            testId: 1,
            userId: '123e4567-e89b-12d3-a456-426614174000',
            attemptNumber: 1,
            status: 'submitted',
            startTime: '2024-01-01T09:00:00.000Z',
            submitTime: '2024-01-01T10:30:00.000Z',
            expiresAt: '2024-01-01T11:00:00.000Z',
            progressPercentage: 100,
            createdAt: '2024-01-01T09:00:00.000Z',
            updatedAt: '2024-01-01T10:30:00.000Z',
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot submit non-active attempt',
        example: {
            statusCode: 400,
            message: 'Cannot submit attempt that is not in progress',
            error: 'Bad Request',
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
        example: {
            statusCode: 404,
            message: 'Test attempt not found',
            error: 'Not Found',
        },
    })
    async submitAttempt(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.submitAttempt(id, req.user.id);
    }

    @Patch(':id/progress')
    @ApiOperation({
        summary: '📈 Update Test Progress',
        description: `
        **Update the progress of an active test attempt**
        
        This endpoint allows updating the progress percentage and status of an active test attempt.
        Used for tracking completion as students work through questions.
        
        **Features:**
        - Update progress percentage (0-100)
        - Change attempt status
        - Automatic expiry checking
        - Progress validation
        
        **Business Rules:**
        - Only IN_PROGRESS attempts can be updated
        - Progress must be between 0-100
        - Expired attempts are automatically marked as EXPIRED
        - Submitting via status change sets progress to 100%
        
        **Security:**
        - JWT authentication required
        - Users can only update their own attempts
        - Status transitions are validated
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateTestAttemptDto,
        description: 'Progress update details',
        examples: {
            progressUpdate: {
                summary: 'Update progress percentage',
                description: 'Update how much of the test is completed',
                value: {
                    progressPercentage: 75.5,
                },
            },
            statusChange: {
                summary: 'Change attempt status',
                description: 'Submit the test via status change',
                value: {
                    status: 'submitted',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test progress updated successfully',
        type: TestAttemptResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid progress update',
        example: {
            statusCode: 400,
            message: 'Test attempt has expired',
            error: 'Bad Request',
        },
    })
    async updateProgress(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTestAttemptDto: UpdateTestAttemptDto,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.updateProgress(
            id,
            updateTestAttemptDto,
            req.user.id,
        );
    }

    @Get('my-attempts')
    @ApiOperation({
        summary: '📚 Get My Test Attempts',
        description: `
        **Retrieve all test attempts for the authenticated user**
        
        This endpoint returns a paginated list of all test attempts made by the current user.
        Includes filtering options and detailed attempt information.
        
        **Features:**
        - Paginated results with customizable page size
        - Optional filtering by specific test
        - Includes test and user information
        - Ordered by creation date (newest first)
        - Comprehensive attempt details and statistics
        
        **Use Cases:**
        - Student dashboard showing attempt history
        - Progress tracking across multiple tests
        - Performance analysis and improvement insights
        - Retry planning and attempt management
        
        **Security:**
        - JWT authentication required
        - Users can only see their own attempts
        - No cross-user data exposure
        `,
    })
    @ApiQuery({
        name: 'testId',
        description: 'Filter attempts by specific test ID',
        required: false,
        example: 1,
    })
    @ApiQuery({
        name: 'page',
        description: 'Page number for pagination',
        required: false,
        example: 1,
    })
    @ApiQuery({
        name: 'pageSize',
        description: 'Number of attempts per page',
        required: false,
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User test attempts retrieved successfully',
        example: {
            attempts: [
                {
                    attemptId: 1,
                    testId: 1,
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    attemptNumber: 1,
                    status: 'submitted',
                    startTime: '2024-01-01T09:00:00.000Z',
                    submitTime: '2024-01-01T10:30:00.000Z',
                    expiresAt: '2024-01-01T11:00:00.000Z',
                    progressPercentage: 100,
                    createdAt: '2024-01-01T09:00:00.000Z',
                    updatedAt: '2024-01-01T10:30:00.000Z',
                    test: {
                        testId: 1,
                        title: 'JavaScript Fundamentals Quiz',
                        testType: 'quiz',
                        durationMinutes: 120,
                    },
                },
            ],
            total: 1,
            page: 1,
            pageSize: 10,
        },
    })
    async getMyAttempts(
        @Req() req: AuthenticatedRequest,
        @Query('testId') testId?: number,
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 10,
    ) {
        return this.testAttemptsService.getUserAttempts(
            req.user.id,
            testId,
            page,
            pageSize,
        );
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Test Attempt Details',
        description: `
        **Retrieve detailed information about a specific test attempt**
        
        This endpoint returns comprehensive details for a single test attempt,
        including test information, user details, progress, and current status.
        
        **Features:**
        - Complete attempt information
        - Related test details
        - User information
        - Progress and timing data
        - Status and metadata
        
        **Use Cases:**
        - Resuming an in-progress attempt
        - Reviewing completed attempts
        - Detailed progress tracking
        - Performance analysis
        
        **Security:**
        - JWT authentication required
        - Users can only access their own attempts
        - Ownership validation performed
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to retrieve',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test attempt details retrieved successfully',
        type: TestAttemptResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
        example: {
            statusCode: 404,
            message: 'Test attempt not found',
            error: 'Not Found',
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '❌ Access denied to this attempt',
        example: {
            statusCode: 403,
            message: 'You do not have access to this test attempt',
            error: 'Forbidden',
        },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.findOne(id, req.user.id);
    }

    @Delete(':id/cancel')
    @ApiOperation({
        summary: '❌ Cancel Test Attempt',
        description: `
        **Cancel an active test attempt**
        
        This endpoint allows students to cancel an in-progress test attempt.
        Useful for cases where the student needs to stop and restart later.
        
        **Features:**
        - Cancel only IN_PROGRESS attempts
        - Permanent status change to CANCELLED
        - Preserves attempt record for history
        - Allows starting a new attempt (within limits)
        
        **Business Rules:**
        - Only active attempts can be cancelled
        - Cancelled attempts cannot be resumed
        - Cancellation counts towards attempt limit
        - New attempt can be started if within max attempts
        
        **Security:**
        - JWT authentication required
        - Users can only cancel their own attempts
        - Status validation performed
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to cancel',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test attempt cancelled successfully',
        type: TestAttemptResponseDto,
        example: {
            attemptId: 1,
            testId: 1,
            userId: '123e4567-e89b-12d3-a456-426614174000',
            attemptNumber: 1,
            status: 'cancelled',
            startTime: '2024-01-01T09:00:00.000Z',
            submitTime: null,
            expiresAt: '2024-01-01T11:00:00.000Z',
            progressPercentage: 45.5,
            createdAt: '2024-01-01T09:00:00.000Z',
            updatedAt: '2024-01-01T09:30:00.000Z',
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot cancel non-active attempt',
        example: {
            statusCode: 400,
            message: 'Can only cancel attempts that are in progress',
            error: 'Bad Request',
        },
    })
    async cancelAttempt(
        @Param('id', ParseIntPipe) id: number,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.cancelAttempt(id, req.user.id);
    }
}
