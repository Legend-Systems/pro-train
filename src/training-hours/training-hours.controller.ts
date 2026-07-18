import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    Logger,
    ParseIntPipe,
    DefaultValuePipe,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiSecurity,
    ApiHeader,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { TrainingHoursService } from './training-hours.service';
import {
    AdminOrgTrainingHoursSummaryDto,
    AdminTrainingHoursTrendDto,
    AdminUserTrainingHoursRankingDto,
    MonthlyTrainingHoursDto,
    UserTrainingHoursSummaryDto,
} from './dto/training-hours.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgRoleGuard } from '../auth/guards/org-role.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import type { OrgBranchScope as OrgBranchScopeType } from '../auth/decorators/org-branch-scope.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { formatYearMonthUtc } from './utils/training-hours.util';

/** REST API for training hours tracking and analytics. */
@ApiTags('⏱️ Training Hours')
@Controller('training-hours')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token',
    required: true,
})
export class TrainingHoursController {
    private readonly logger = new Logger(TrainingHoursController.name);

    constructor(
        private readonly trainingHoursService: TrainingHoursService,
    ) {}

    /** Current user's training hours summary. */
    @Get('me/summary')
    @ApiOperation({ summary: 'Get current user training hours summary' })
    async getMySummary(
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<UserTrainingHoursSummaryDto> {
        if (!scope.orgId || !scope.userId) {
            this.logger.warn('Training hours summary requested without org/user scope');
            throw new BadRequestException('Organization context required');
        }

        const summary = await this.trainingHoursService.getUserSummary(
            scope.userId,
            scope.orgId,
            scope.branchId,
        );
        this.logger.log(
            `Training hours summary loaded for user ${scope.userId}: ${summary.totalHours}h total`,
        );
        return summary;
    }

    /** Current user's monthly training hours breakdown. */
    @Get('me/monthly')
    @ApiOperation({ summary: 'Get current user monthly training hours' })
    @ApiQuery({ name: 'from', required: false, example: '2025-01' })
    @ApiQuery({ name: 'to', required: false, example: '2026-06' })
    async getMyMonthly(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ): Promise<MonthlyTrainingHoursDto[]> {
        if (!scope.orgId || !scope.userId) {
            throw new BadRequestException('Organization context required');
        }

        const now = new Date();
        const toYearMonth = to ?? formatYearMonthUtc(now);
        const fromDate = new Date(now);
        fromDate.setUTCMonth(fromDate.getUTCMonth() - 11);
        const fromYearMonth = from ?? formatYearMonthUtc(fromDate);

        return this.trainingHoursService.getMonthlyBreakdown(
            scope.userId,
            scope.orgId,
            fromYearMonth,
            toYearMonth,
            scope.branchId,
        );
    }

    /** Admin: training hours summary for any org user. */
    @Get('users/:userId/summary')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({ summary: 'Get training hours summary for a user (admin)' })
    @ApiParam({ name: 'userId', type: String })
    async getUserSummary(
        @Param('userId') userId: string,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<UserTrainingHoursSummaryDto> {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }
        return this.trainingHoursService.getUserSummary(
            userId,
            scope.orgId,
            scope.branchId,
        );
    }

    /** Admin: monthly breakdown for any org user. */
    @Get('users/:userId/monthly')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({ summary: 'Get monthly training hours for a user (admin)' })
    @ApiParam({ name: 'userId', type: String })
    @ApiQuery({ name: 'from', required: false })
    @ApiQuery({ name: 'to', required: false })
    async getUserMonthly(
        @Param('userId') userId: string,
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('from') from?: string,
        @Query('to') to?: string,
    ): Promise<MonthlyTrainingHoursDto[]> {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }

        const now = new Date();
        const toYearMonth = to ?? formatYearMonthUtc(now);
        const fromDate = new Date(now);
        fromDate.setUTCMonth(fromDate.getUTCMonth() - 11);
        const fromYearMonth = from ?? formatYearMonthUtc(fromDate);

        return this.trainingHoursService.getMonthlyBreakdown(
            userId,
            scope.orgId,
            fromYearMonth,
            toYearMonth,
            scope.branchId,
        );
    }

    /** Admin: org-wide summary for a month. */
    @Get('admin/org-summary')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({ summary: 'Get org training hours summary for a month' })
    @ApiQuery({ name: 'yearMonth', required: false, example: '2026-06' })
    @ApiQuery({ name: 'branchId', required: false })
    async getOrgSummary(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('yearMonth') yearMonth?: string,
        @Query('branchId') branchId?: string,
    ): Promise<AdminOrgTrainingHoursSummaryDto> {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }

        const month = yearMonth ?? formatYearMonthUtc(new Date());
        const effectiveBranchId = branchId ?? scope.branchId;
        const summary = await this.trainingHoursService.getOrgMonthlySummary(
            scope.orgId,
            month,
            effectiveBranchId,
        );
        this.logger.log(
            `Org training hours summary for ${month}: ${summary.totalHours}h`,
        );
        return summary;
    }

    /** Admin: monthly trends for charts. */
    @Get('admin/monthly-trends')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({ summary: 'Get org monthly training hours trends' })
    @ApiQuery({ name: 'months', required: false, example: 12 })
    @ApiQuery({ name: 'branchId', required: false })
    async getMonthlyTrends(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number,
        @Query('branchId') branchId?: string,
    ): Promise<AdminTrainingHoursTrendDto[]> {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }
        const effectiveBranchId = branchId ?? scope.branchId;
        return this.trainingHoursService.getOrgMonthlyTrends(
            scope.orgId,
            months,
            effectiveBranchId,
        );
    }

    /** Admin: top learners by hours for a month. */
    @Get('admin/user-rankings')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({ summary: 'Get learners ranked by training hours' })
    @ApiQuery({ name: 'yearMonth', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
    @ApiQuery({ name: 'branchId', required: false })
    async getUserRankings(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('yearMonth') yearMonth?: string,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit?: number,
        @Query('order') order?: string,
        @Query('branchId') branchId?: string,
    ): Promise<AdminUserTrainingHoursRankingDto[]> {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }

        const month = yearMonth ?? formatYearMonthUtc(new Date());
        const sortOrder: 'asc' | 'desc' = order === 'asc' ? 'asc' : 'desc';
        const effectiveBranchId = branchId ?? scope.branchId;
        return this.trainingHoursService.getOrgUserRankings(
            scope.orgId,
            month,
            limit ?? 10,
            effectiveBranchId,
            sortOrder,
        );
    }
}
