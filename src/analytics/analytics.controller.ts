import {
    Controller,
    DefaultValuePipe,
    Get,
    ParseIntPipe,
    Query,
    UseGuards,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiSecurity,
    ApiHeader,
    ApiQuery,
} from '@nestjs/swagger';

import { AnalyticsService } from './analytics.service';
import type { AnalyticsSortOrder } from './analytics.service';
import {
    BranchAnalyticsSummaryDto,
    BranchPerformerDto,
} from './dto/branch-analytics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import type { OrgBranchScope as OrgBranchScopeType } from '../auth/decorators/org-branch-scope.decorator';

/** Formats the current date as a YYYY-MM string in UTC. */
function currentYearMonth(): string {
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${now.getUTCFullYear()}-${month}`;
}

/** Owner / Master Admin branch analytics for mobile dashboards. */
@ApiTags('📊 Branch Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MASTER_ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token',
    required: true,
})
export class AnalyticsController {
    private readonly logger = new Logger(AnalyticsController.name);

    constructor(private readonly analyticsService: AnalyticsService) {}

    /** Per-branch knowledge score, pass rate and training hours for a month. */
    @Get('branches/summary')
    @ApiOperation({ summary: 'Get per-branch analytics summary for a month' })
    @ApiQuery({ name: 'yearMonth', required: false, example: '2026-06' })
    @ApiQuery({ name: 'branchId', required: false })
    async getBranchSummary(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('yearMonth') yearMonth?: string,
        @Query('branchId') branchId?: string,
    ): Promise<BranchAnalyticsSummaryDto[]> {
        const month = yearMonth ?? currentYearMonth();
        this.logger.log(
            `Branch analytics summary for org ${scope.orgId}, month ${month}`,
        );
        return this.analyticsService.getBranchSummary(
            scope,
            month,
            branchId || undefined,
        );
    }

    /** Top or bottom performers by average score for a month. */
    @Get('branches/performers')
    @ApiOperation({
        summary: 'Get top or worst performers for a month (optionally per branch)',
    })
    @ApiQuery({ name: 'yearMonth', required: false, example: '2026-06' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
    @ApiQuery({ name: 'limit', required: false, example: 5 })
    async getBranchPerformers(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('yearMonth') yearMonth?: string,
        @Query('branchId') branchId?: string,
        @Query('order') order?: string,
        @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit?: number,
    ): Promise<BranchPerformerDto[]> {
        const month = yearMonth ?? currentYearMonth();
        const sortOrder: AnalyticsSortOrder = order === 'asc' ? 'asc' : 'desc';
        return this.analyticsService.getBranchPerformers(scope, {
            yearMonth: month,
            branchId: branchId || undefined,
            order: sortOrder,
            limit,
        });
    }
}
