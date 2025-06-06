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
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiBody,
    ApiHeader,
    ApiSecurity,
} from '@nestjs/swagger';
import { TestAttemptsService } from './test_attempts.service';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';
import { SubmitTestAttemptDto } from './dto/submit-test-attempt.dto';
import { TestAttemptResponseDto } from './dto/test-attempt-response.dto';
import { TestAttemptFilterDto } from './dto/test-attempt-filter.dto';
import { TestAttemptStatsDto } from './dto/test-attempt-stats.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { StandardApiResponse } from '../user/dto/common-response.dto';

@ApiTags('📊 Test Attempts')
@Controller('test-attempts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class TestAttemptsController {
    private readonly logger = new Logger(TestAttemptsController.name);

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
        operationId: 'startTestAttempt',
    })
    @ApiBody({
        type: CreateTestAttemptDto,
        description: 'Test attempt creation details',
        examples: {
            'basic-attempt': {
                summary: '📝 Basic Test Attempt',
                description: 'Start a standard test attempt',
                value: {
                    testId: 1,
                },
            },
            'quiz-attempt': {
                summary: '🧩 Quiz Attempt',
                description: 'Start a quiz attempt',
                value: {
                    testId: 5,
                },
            },
            'exam-attempt': {
                summary: '🎓 Exam Attempt',
                description: 'Start a formal exam attempt',
                value: {
                    testId: 10,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Test attempt started successfully',
        type: TestAttemptResponseDto,
        schema: {
            example: {
                success: true,
                message: 'Test attempt started successfully',
                data: {
                    attemptId: 1,
                    testId: 1,
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    attemptNumber: 1,
                    status: 'in_progress',
                    startTime: '2025-01-15T10:30:00.000Z',
                    expiresAt: '2025-01-15T12:30:00.000Z',
                    progressPercentage: 0,
                    createdAt: '2025-01-15T10:30:00.000Z',
                    updatedAt: '2025-01-15T10:30:00.000Z',
                    test: {
                        testId: 1,
                        title: 'JavaScript Fundamentals Quiz',
                        testType: 'quiz',
                        durationMinutes: 120,
                    },
                    totalQuestions: 25,
                    answersCount: 0,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid request or business rule violation',
        schema: {
            example: {
                success: false,
                message: 'Maximum attempts exceeded for this test',
                error: 'BAD_REQUEST',
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '❌ Active attempt already exists',
        schema: {
            example: {
                success: false,
                message: 'An active attempt already exists for this test',
                error: 'CONFLICT',
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
        schema: {
            example: {
                success: false,
                message: 'Test not found or access denied',
                error: 'NOT_FOUND',
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - Insufficient permissions',
    })
    async startAttempt(
        @Body() createTestAttemptDto: CreateTestAttemptDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<TestAttemptResponseDto>> {
        try {
            this.logger.log(
                `Starting test attempt for test ${createTestAttemptDto.testId} by user: ${req.user.id}`,
            );

            const result = await this.testAttemptsService.startAttempt(
                createTestAttemptDto,
                scope,
                req.user.id,
            );

            this.logger.log(
                `Test attempt started successfully with ID: ${result.attemptId}`,
            );

            return {
                success: true,
                message: 'Test attempt started successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error starting test attempt for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get('my-attempts')
    @ApiOperation({
        summary: '📚 Get My Test Attempts',
        description: `
        **Retrieve all test attempts for the authenticated user**
        
        This endpoint provides a comprehensive view of all test attempts made by the current user:
        - Paginated results with configurable page size
        - Optional filtering by specific test ID
        - Includes attempt status, scores, and timing information
        - Shows relationship to tests and courses
        
        **Use Cases:**
        - Student dashboard showing attempt history
        - Progress tracking across multiple tests
        - Performance analysis over time
        - Retake eligibility checking
        `,
        operationId: 'getMyTestAttempts',
    })
    @ApiQuery({
        name: 'testId',
        description: 'Filter attempts by specific test ID',
        required: false,
        type: Number,
        example: 1,
    })
    @ApiQuery({
        name: 'page',
        description: 'Page number for pagination (1-based)',
        required: false,
        type: Number,
        example: 1,
    })
    @ApiQuery({
        name: 'pageSize',
        description: 'Number of attempts per page (max 50)',
        required: false,
        type: Number,
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User attempts retrieved successfully',
        schema: {
            example: {
                success: true,
                message: 'Test attempts retrieved successfully',
                data: {
                    attempts: [
                        {
                            attemptId: 1,
                            testId: 1,
                            attemptNumber: 1,
                            status: 'submitted',
                            startTime: '2025-01-15T10:30:00.000Z',
                            submitTime: '2025-01-15T12:15:00.000Z',
                            progressPercentage: 100,
                            test: {
                                testId: 1,
                                title: 'JavaScript Fundamentals Quiz',
                                testType: 'quiz',
                                durationMinutes: 120,
                            },
                            answersCount: 25,
                            totalQuestions: 25,
                        },
                    ],
                    pagination: {
                        page: 1,
                        pageSize: 10,
                        total: 15,
                        totalPages: 2,
                    },
                },
                meta: {
                    timestamp: '2025-01-15T10:30:00.000Z',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid query parameters',
    })
    async getMyAttempts(
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
        @Query('testId') testId?: number,
        @Query('page') page: number = 1,
        @Query('pageSize') pageSize: number = 10,
    ): Promise<StandardApiResponse<any>> {
        try {
            this.logger.log(
                `Retrieving test attempts for user: ${req.user.id}, page: ${page}, pageSize: ${pageSize}`,
            );

            const result = await this.testAttemptsService.getUserAttempts(
                req.user.id,
                scope,
                testId,
                page,
                pageSize,
            );

            return {
                success: true,
                message: 'Test attempts retrieved successfully',
                data: result,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving test attempts for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get('stats')
    @ApiOperation({
        summary: '📈 Get Test Attempt Statistics',
        description: 'Get comprehensive statistics for test attempts',
    })
    @ApiQuery({
        name: 'testId',
        description: 'Filter stats by specific test ID',
        required: false,
        example: 1,
    })
    @ApiQuery({
        name: 'userId',
        description: 'Filter stats by specific user ID',
        required: false,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Statistics retrieved successfully',
        type: TestAttemptStatsDto,
    })
    async getStats(
        @OrgBranchScope() scope: OrgBranchScope,
        @Query('testId') testId?: number,
        @Query('userId') userId?: string,
    ): Promise<TestAttemptStatsDto> {
        return this.testAttemptsService.getStats(scope, testId, userId);
    }

    @Get('test/:testId')
    @ApiOperation({
        summary: '📋 Get Test Attempts for Test',
        description: 'Get all attempts for a specific test (instructor view)',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to get attempts for',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test attempts retrieved successfully',
    })
    async getTestAttempts(
        @Param('testId', ParseIntPipe) testId: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Query() filters?: TestAttemptFilterDto,
    ) {
        return this.testAttemptsService.findAttemptsByTest(
            testId,
            scope,
            filters,
        );
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Test Attempt Details',
        description:
            'Retrieve detailed information about a specific test attempt',
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
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.findOne(id, scope, req.user.id);
    }

    @Post(':id/submit')
    @ApiOperation({
        summary: '📋 Submit Test Attempt',
        description: 'Submit a completed test attempt',
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
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot submit non-active attempt',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
    })
    async submitAttempt(
        @Param('id', ParseIntPipe) id: number,
        @Body() submitData: SubmitTestAttemptDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<TestAttemptResponseDto>> {
        try {
            this.logger.log(
                `Submitting test attempt ${id} by user: ${req.user.id}`,
            );

            const result = await this.testAttemptsService.submitAttempt(
                id,
                submitData,
                scope,
                req.user.id,
            );

            this.logger.log(`Test attempt ${id} submitted successfully`);

            return {
                success: true,
                message: 'Test attempt submitted successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error submitting test attempt ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Patch(':id/progress')
    @ApiOperation({
        summary: '📈 Update Test Progress',
        description: 'Update progress for an in-progress test attempt',
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateTestAttemptDto,
        description: 'Progress update data',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Progress updated successfully',
        type: TestAttemptResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid progress data or attempt not in progress',
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
    ): Promise<StandardApiResponse<TestAttemptResponseDto>> {
        try {
            this.logger.log(
                `Updating progress for test attempt ${id} by user: ${req.user.id}`,
            );

            const result = await this.testAttemptsService.updateProgress(
                id,
                updateTestAttemptDto,
                scope,
                req.user.id,
            );

            this.logger.log(`Progress updated for test attempt ${id}`);

            return {
                success: true,
                message: 'Progress updated successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error updating progress for test attempt ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Post(':id/calculate-score')
    @ApiOperation({
        summary: '🧮 Calculate Test Score',
        description: 'Calculate and update score for a submitted test attempt',
    })
    @ApiParam({
        name: 'id',
        description: 'Test attempt ID to calculate score for',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Score calculated successfully',
        type: TestAttemptResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot calculate score for non-submitted attempt',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
    })
    async calculateScore(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardApiResponse<TestAttemptResponseDto>> {
        try {
            this.logger.log(`Calculating score for test attempt ${id}`);

            const result = await this.testAttemptsService.calculateScore(
                id,
                scope,
            );

            this.logger.log(`Score calculated for test attempt ${id}`);

            return {
                success: true,
                message: 'Score calculated successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error calculating score for test attempt ${id}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id/cancel')
    @ApiOperation({
        summary: '❌ Cancel Test Attempt',
        description: 'Cancel an in-progress test attempt',
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
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot cancel non-active attempt',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test attempt not found',
    })
    async cancelAttempt(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<TestAttemptResponseDto>> {
        try {
            this.logger.log(
                `Cancelling test attempt ${id} by user: ${req.user.id}`,
            );

            const result = await this.testAttemptsService.cancelAttempt(
                id,
                scope,
                req.user.id,
            );

            this.logger.log(`Test attempt ${id} cancelled successfully`);

            return {
                success: true,
                message: 'Test attempt cancelled successfully',
                data: result,
            };
        } catch (error) {
            this.logger.error(
                `Error cancelling test attempt ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get('test/:testId/active')
    @ApiOperation({
        summary: '🎯 Get Active Attempt for Test',
        description: `
        **Get the active attempt for a specific test and user**
        
        This endpoint returns the active (in-progress) attempt for a test if one exists.
        If no active attempt exists, returns null. This is useful for:
        - Checking if a user can start a new attempt
        - Resuming an existing attempt
        - Getting current progress and timing information
        
        **Features:**
        - Returns active attempt with timing data
        - Automatic expiration checking
        - Progress and question count information
        - Resume capability validation
        
        **Use Cases:**
        - Pre-flight check before starting test
        - Resume interrupted test sessions
        - Progress monitoring and analytics
        `,
        operationId: 'getActiveAttempt',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to check for active attempts',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Active attempt retrieved (or null if none exists)',
        type: TestAttemptResponseDto,
        examples: {
            'active-attempt': {
                summary: '🟢 Active Attempt Found',
                value: {
                    success: true,
                    message: 'Active attempt retrieved successfully',
                    data: {
                        attemptId: 123,
                        testId: 1,
                        userId: '123e4567-e89b-12d3-a456-426614174000',
                        attemptNumber: 1,
                        status: 'in_progress',
                        startTime: '2025-01-15T10:30:00.000Z',
                        expiresAt: '2025-01-15T12:30:00.000Z',
                        progressPercentage: 45.5,
                        timeRemaining: 3600,
                        timeElapsed: 3600,
                        questionsAnswered: 12,
                        totalQuestions: 25,
                        createdAt: '2025-01-15T10:30:00.000Z',
                        updatedAt: '2025-01-15T11:15:00.000Z',
                    },
                },
            },
            'no-active-attempt': {
                summary: '⚪ No Active Attempt',
                value: {
                    success: true,
                    message: 'No active attempt found',
                    data: null,
                },
            },
        },
    })
    async getActiveAttempt(
        @Param('testId', ParseIntPipe) testId: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<TestAttemptResponseDto | null>> {
        try {
            this.logger.log(
                `Getting active attempt for test ${testId} by user: ${req.user.id}`,
            );

            const activeAttempt =
                await this.testAttemptsService.getActiveAttempt(
                    testId,
                    scope,
                    req.user.id,
                );

            return {
                success: true,
                message: activeAttempt
                    ? 'Active attempt retrieved successfully'
                    : 'No active attempt found',
                data: activeAttempt,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting active attempt for test ${testId} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id/progress')
    @ApiOperation({
        summary: '📊 Get Attempt Progress',
        description: `
        **Get detailed progress information for a test attempt**
        
        This endpoint provides comprehensive progress and timing data for an active attempt:
        - Real-time timing calculations (elapsed and remaining)
        - Question progress (answered vs total)
        - Expiration checking and status updates
        - Session state information
        
        **Features:**
        - Automatic time calculations
        - Expiration handling
        - Progress percentages
        - Question completion tracking
        
        **Use Cases:**
        - Real-time progress updates during test
        - Timer displays and warnings
        - Progress bars and completion indicators
        - Session management and recovery
        `,
        operationId: 'getAttemptProgress',
    })
    @ApiParam({
        name: 'id',
        description: 'Attempt ID to get progress for',
        example: 123,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Attempt progress retrieved successfully',
        schema: {
            example: {
                success: true,
                message: 'Attempt progress retrieved successfully',
                data: {
                    attemptId: 123,
                    testId: 1,
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    status: 'in_progress',
                    startTime: '2025-01-15T10:30:00.000Z',
                    expiresAt: '2025-01-15T12:30:00.000Z',
                    progressPercentage: 48.0,
                    timeRemaining: 3420,
                    timeElapsed: 3780,
                    questionsAnswered: 12,
                    totalQuestions: 25,
                    test: {
                        testId: 1,
                        title: 'JavaScript Fundamentals Quiz',
                        testType: 'quiz',
                        durationMinutes: 120,
                    },
                },
            },
        },
    })
    async getAttemptProgress(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<any>> {
        try {
            this.logger.log(
                `Getting progress for attempt ${id} by user: ${req.user.id}`,
            );

            const progressData =
                await this.testAttemptsService.getAttemptWithProgress(
                    id,
                    scope,
                    req.user.id,
                );

            return {
                success: true,
                message: 'Attempt progress retrieved successfully',
                data: progressData,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting progress for attempt ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
