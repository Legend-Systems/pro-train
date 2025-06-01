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
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

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
            startTime: '2025-01-01T09:00:00.000Z',
            submitTime: null,
            expiresAt: '2025-01-01T11:00:00.000Z',
            progressPercentage: 0,
            createdAt: '2025-01-01T09:00:00.000Z',
            updatedAt: '2025-01-01T09:00:00.000Z',
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
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.startAttempt(
            createTestAttemptDto,
            scope,
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
            startTime: '2025-01-01T09:00:00.000Z',
            submitTime: '2025-01-01T10:30:00.000Z',
            expiresAt: '2025-01-01T11:00:00.000Z',
            progressPercentage: 100,
            createdAt: '2025-01-01T09:00:00.000Z',
            updatedAt: '2025-01-01T10:30:00.000Z',
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
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.submitAttempt(id, scope, req.user.id);
    }

    @Patch(':id/progress')
    @ApiOperation({
        summary: '📈 Update Test Progress',
        description: `
        **Update progress for an in-progress test attempt**
        
        This endpoint allows updating the progress percentage and other
        modifiable fields while a test is in progress. Useful for:
        - Tracking completion percentage as questions are answered
        - Updating time spent on the test
        - Recording intermediate saves
        
        **Business Rules:**
        - Only IN_PROGRESS attempts can be updated
        - Progress percentage must be between 0-100
        - Cannot update submitted or expired attempts
        - Automatic progress calculation based on answered questions
        
        **Security:**
        - JWT authentication required
        - Users can only update their own attempts
        - Progress validation performed
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateTestAttemptDto,
        description: 'Progress update data',
        examples: {
            progressUpdate: {
                summary: 'Update progress percentage',
                description: 'Update how much of the test is completed',
                value: {
                    progressPercentage: 45,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Progress updated successfully',
        type: TestAttemptResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid progress data or attempt not in progress',
        example: {
            statusCode: 400,
            message: 'Cannot update progress for submitted attempt',
            error: 'Bad Request',
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
    })
    async updateProgress(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTestAttemptDto: UpdateTestAttemptDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.updateProgress(
            id,
            updateTestAttemptDto,
            scope,
            req.user.id,
        );
    }

    @Get('my-attempts')
    @ApiOperation({
        summary: '📚 Get My Test Attempts',
        description: `
        **Retrieve all test attempts for the authenticated user**
        
        This endpoint returns a paginated list of test attempts created by
        the current user. Supports filtering by test ID and pagination.
        
        **Features:**
        - Pagination support with configurable page size
        - Optional filtering by specific test
        - Sorted by creation date (newest first)
        - Includes attempt status and progress information
        
        **Use Cases:**
        - Student dashboard showing recent attempts
        - Test history and progress tracking
        - Resuming incomplete attempts
        - Performance analytics
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
        description: 'Page number for pagination (1-based)',
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
        description: '✅ User attempts retrieved successfully',
        example: {
            attempts: [
                {
                    attemptId: 1,
                    testId: 1,
                    attemptNumber: 1,
                    status: 'submitted',
                    startTime: '2025-01-01T09:00:00.000Z',
                    submitTime: '2025-01-01T10:30:00.000Z',
                    progressPercentage: 100,
                },
                {
                    attemptId: 2,
                    testId: 2,
                    attemptNumber: 1,
                    status: 'in_progress',
                    startTime: '2025-01-02T14:00:00.000Z',
                    submitTime: null,
                    progressPercentage: 75,
                },
            ],
            total: 2,
            page: 1,
            pageSize: 10,
        },
    })
    async getMyAttempts(
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
        @Query('testId') testId?: number,
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 10,
    ) {
        return this.testAttemptsService.getUserAttempts(
            req.user.id,
            scope,
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
        
        This endpoint returns comprehensive details about a test attempt
        including progress, timing, and associated test information.
        
        **Included Information:**
        - Attempt status and progress
        - Start/submit timestamps
        - Test details and configuration
        - Expiration information
        - Answer summary (if applicable)
        
        **Security:**
        - Users can only view their own attempts
        - Ownership validation performed
        - Sensitive data filtered based on attempt status
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
        description: '❌ Test attempt not found or access denied',
        example: {
            statusCode: 404,
            message: 'Test attempt not found',
            error: 'Not Found',
        },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.findOne(id, scope, req.user.id);
    }

    @Delete(':id/cancel')
    @ApiOperation({
        summary: '❌ Cancel Test Attempt',
        description: `
        **Cancel an in-progress test attempt**
        
        This endpoint allows students to cancel an active test attempt.
        The attempt status will be changed to CANCELLED and cannot be resumed.
        
        **Business Rules:**
        - Only IN_PROGRESS attempts can be cancelled
        - Cancelled attempts count towards the maximum attempt limit
        - Cancellation is permanent and irreversible
        - No results are generated for cancelled attempts
        
        **Use Cases:**
        - Student decides not to complete the test
        - Technical issues preventing test completion
        - Accidental test start
        
        **Security:**
        - JWT authentication required
        - Users can only cancel their own attempts
        - Ownership validation performed
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
            startTime: '2025-01-01T09:00:00.000Z',
            submitTime: null,
            progressPercentage: 45,
            createdAt: '2025-01-01T09:00:00.000Z',
            updatedAt: '2025-01-01T09:15:00.000Z',
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot cancel non-active attempt',
        example: {
            statusCode: 400,
            message: 'Cannot cancel attempt that is not in progress',
            error: 'Bad Request',
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
    })
    async cancelAttempt(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.cancelAttempt(id, scope, req.user.id);
    }
}
