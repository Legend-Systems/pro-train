import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    BadRequestException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiNotFoundResponse,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiSecurity,
    ApiOkResponse,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardOverviewService } from './leaderboard-overview.service';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import {
    LeaderboardOverviewPeriod,
    LeaderboardOverviewQueryDto,
    LeaderboardOverviewResponseDto,
} from './dto/leaderboard-overview.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    OrgBranchScope,
    type OrgBranchScope as OrgBranchScopeType,
} from '../auth/decorators/org-branch-scope.decorator';

@ApiTags('🏆 Leaderboards & Competition Rankings')
@Controller('leaderboards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class LeaderboardController {
    private readonly logger = new Logger(LeaderboardController.name);

    constructor(
        private readonly leaderboardService: LeaderboardService,
        private readonly leaderboardOverviewService: LeaderboardOverviewService,
    ) {}

    @Get()
    @ApiOperation({
        summary: 'Org course-points leaderboard with filters and insights',
        description:
            'Returns paginated course-score rankings for the organization. ' +
            'Supports all-time (leaderboards table) or monthly (results by createdAt), ' +
            'optional course/branch/search filters, summary cards, and improvers.',
        operationId: 'getOrgLeaderboard',
    })
    @ApiOkResponse({ type: LeaderboardOverviewResponseDto })
    @ApiUnauthorizedResponse({
        description: 'Unauthorized - Invalid or missing JWT token',
    })
    async getOrgLeaderboard(
        @Query() query: LeaderboardOverviewQueryDto,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<LeaderboardOverviewResponseDto> {
        this.logger.log(
            `Org leaderboard period=${query.period} month=${query.month} course=${query.courseId} user=${scope.userId}`,
        );
        return this.leaderboardOverviewService.getOverview(scope, query);
    }

    @Get('course/:courseId')
    @ApiOperation({
        summary: 'Get course leaderboard with filters and insights',
        operationId: 'getCourseLeaderboard',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier',
        example: 1,
    })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({
        name: 'period',
        required: false,
        enum: LeaderboardOverviewPeriod,
    })
    @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
    @ApiOkResponse({ type: LeaderboardOverviewResponseDto })
    @ApiUnauthorizedResponse({
        description: 'Unauthorized - Invalid or missing JWT token',
    })
    @ApiBadRequestResponse({
        description: 'Invalid course ID or pagination parameters',
    })
    @ApiNotFoundResponse({
        description: 'Course not found or no leaderboard data available',
    })
    async getCourseLeaderboard(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query() query: LeaderboardOverviewQueryDto,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<LeaderboardOverviewResponseDto> {
        this.logger.log(
            `Course leaderboard course=${courseId} period=${query.period} user=${scope.userId}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        return this.leaderboardOverviewService.getOverview(scope, {
            ...query,
            courseId,
        });
    }

    @Get('my-rank/:courseId')
    @ApiOperation({
        summary: 'Get my course rank',
        operationId: 'getMyRankInCourse',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User rank retrieved successfully',
        type: LeaderboardResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: 'Unauthorized - Invalid or missing JWT token',
    })
    @ApiBadRequestResponse({ description: 'Invalid course ID' })
    @ApiNotFoundResponse({
        description: 'User not found in course leaderboard',
    })
    async getUserRank(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<LeaderboardResponseDto | null> {
        this.logger.log(
            `Getting user rank for course: ${courseId}, user: ${scope.userId}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        return this.leaderboardService.getUserRank(courseId, scope.userId);
    }

    @Post('refresh/:courseId')
    @ApiOperation({
        summary: 'Refresh course leaderboard rankings',
        operationId: 'refreshCourseLeaderboard',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Leaderboard refreshed successfully',
    })
    @ApiUnauthorizedResponse({
        description: 'Unauthorized - Invalid or missing JWT token',
    })
    @ApiForbiddenResponse({
        description: 'Insufficient permissions to refresh leaderboard',
    })
    @ApiBadRequestResponse({ description: 'Invalid course ID' })
    async refreshLeaderboard(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<{ message: string }> {
        this.logger.log(
            `Refreshing leaderboard for course: ${courseId} by user: ${scope.userId}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        await this.leaderboardService.updateLeaderboard(courseId);
        return { message: 'Leaderboard refreshed successfully' };
    }
}
