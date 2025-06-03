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
import { TestAttemptFilterDto } from './dto/test-attempt-filter.dto';
import { TestAttemptStatsDto } from './dto/test-attempt-stats.dto';
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
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid request or business rule violation',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '❌ Active attempt already exists',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
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

    @Get('my-attempts')
    @ApiOperation({
        summary: '📚 Get My Test Attempts',
        description: 'Retrieve all test attempts for the authenticated user',
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
        @OrgBranchScope() scope: OrgBranchScope,
        @Req() req: AuthenticatedRequest,
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.submitAttempt(id, scope, req.user.id);
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
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.updateProgress(
            id,
            updateTestAttemptDto,
            scope,
            req.user.id,
        );
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
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.calculateScore(id, scope);
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
    ): Promise<TestAttemptResponseDto> {
        return this.testAttemptsService.cancelAttempt(id, scope, req.user.id);
    }
}
