import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiSecurity,
    ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import {
    OrgBranchScope,
    type OrgBranchScope as OrgBranchScopeType,
} from '../../auth/decorators/org-branch-scope.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { StandardApiResponse } from '../../user/dto/common-response.dto';
import {
    AdminAtRiskUserDto,
    AdminBranchComparisonDto,
    AdminChallengingQuestionDto,
    AdminEffectivenessTrendPointDto,
    AdminHighPotentialUserDto,
    AdminKeyAreaDto,
    AdminKnowledgeImprovementDto,
    AdminLeaderboardEntryDto,
    AdminOverviewReportDto,
    AdminPassRateDto,
    AdminPerformerDto,
    AdminReportFiltersDto,
    AdminSkillGapDto,
    AdminTestPassFailDto,
    AdminTrainingHoursUserDto,
} from '../dto/admin-insights.dto';
import { AdminInsightsReportsService } from '../services/admin-insights-reports.service';

/**
 * Role-gated admin reporting catalogue.
 * Accessible to owner, admin, and master_admin within their organization.
 */
@ApiTags('📊 Admin Reporting')
@Controller('reports/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MASTER_ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token',
    required: true,
})
export class AdminReportsController {
    private readonly logger = new Logger(AdminReportsController.name);

    constructor(
        private readonly adminInsightsReportsService: AdminInsightsReportsService,
    ) {}

    @Get('overview')
    @ApiOperation({
        summary: 'Admin reporting hub overview',
        description:
            'Executive KPIs plus top performers, failed tests, at-risk users, key areas, and trends.',
    })
    @ApiOkResponse({ type: AdminOverviewReportDto })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    @ApiQuery({ name: 'yearMonth', required: false, example: '2026-07' })
    async getOverview(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminOverviewReportDto>> {
        this.logger.log(`Admin overview for org ${scope.orgId}`);
        const data = await this.adminInsightsReportsService.getOverview(
            scope,
            filters,
        );
        return this.ok('Admin overview retrieved successfully', data);
    }

    @Get('performers')
    @ApiOperation({
        summary: 'Top or worst performers',
        description:
            'Rank learners by average knowledge score. Use order=desc for top, order=asc for worst.',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'] })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getPerformers(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminPerformerDto[]>> {
        const data = await this.adminInsightsReportsService.getPerformers(
            scope,
            filters,
        );
        return this.ok('Performers retrieved successfully', data);
    }

    @Get('training-hours')
    @ApiOperation({ summary: 'Current training hours per user' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'yearMonth', required: false, example: '2026-07' })
    @ApiQuery({ name: 'limit', required: false, example: 50 })
    async getTrainingHours(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminTrainingHoursUserDto[]>> {
        const data = await this.adminInsightsReportsService.getTrainingHours(
            scope,
            filters,
        );
        return this.ok('Training hours retrieved successfully', data);
    }

    @Get('tests/pass-fail-ranking')
    @ApiOperation({
        summary: 'Top failed and passed tests',
        description: 'Returns top N most commonly failed and passed tests.',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 5 })
    async getPassFailRanking(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<
        StandardApiResponse<{
            mostFailed: AdminTestPassFailDto[];
            mostPassed: AdminTestPassFailDto[];
        }>
    > {
        const data = await this.adminInsightsReportsService.getPassFailRanking(
            scope,
            filters,
        );
        return this.ok('Pass/fail ranking retrieved successfully', data);
    }

    @Get('pass-rates')
    @ApiOperation({ summary: 'Average pass rate per test and course' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    async getPassRates(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminPassRateDto[]>> {
        const data = await this.adminInsightsReportsService.getPassRates(
            scope,
            filters,
        );
        return this.ok('Pass rates retrieved successfully', data);
    }

    @Get('knowledge-improvement')
    @ApiOperation({
        summary: 'Highest and lowest knowledge score improvement',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 5 })
    async getKnowledgeImprovement(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<
        StandardApiResponse<{
            highest: AdminKnowledgeImprovementDto[];
            lowest: AdminKnowledgeImprovementDto[];
        }>
    > {
        const data =
            await this.adminInsightsReportsService.getKnowledgeImprovement(
                scope,
                filters,
            );
        return this.ok('Knowledge improvement retrieved successfully', data);
    }

    @Get('leaderboards')
    @ApiOperation({ summary: 'Overall and branch leaderboard views' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getLeaderboards(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<
        StandardApiResponse<{
            overall: AdminLeaderboardEntryDto[];
            byBranch: AdminLeaderboardEntryDto[];
        }>
    > {
        const data = await this.adminInsightsReportsService.getLeaderboards(
            scope,
            filters,
        );
        return this.ok('Leaderboards retrieved successfully', data);
    }

    @Get('branch-comparison')
    @ApiOperation({ summary: 'Branch performance comparison' })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'yearMonth', required: false })
    async getBranchComparison(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminBranchComparisonDto[]>> {
        const data = await this.adminInsightsReportsService.getBranchComparison(
            scope,
            filters,
        );
        return this.ok('Branch comparison retrieved successfully', data);
    }

    @Get('at-risk-users')
    @ApiOperation({
        summary: 'Users at risk (low engagement + low improvement)',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getAtRiskUsers(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminAtRiskUserDto[]>> {
        const data = await this.adminInsightsReportsService.getAtRiskUsers(
            scope,
            filters,
        );
        return this.ok('At-risk users retrieved successfully', data);
    }

    @Get('high-potential-users')
    @ApiOperation({
        summary: 'High-potential users (strong improvement + high scores)',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getHighPotentialUsers(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminHighPotentialUserDto[]>> {
        const data =
            await this.adminInsightsReportsService.getHighPotentialUsers(
                scope,
                filters,
            );
        return this.ok('High-potential users retrieved successfully', data);
    }

    @Get('challenging-questions')
    @ApiOperation({
        summary: 'Most challenging questions and common wrong answers',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 5 })
    async getChallengingQuestions(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminChallengingQuestionDto[]>> {
        const data =
            await this.adminInsightsReportsService.getChallengingQuestions(
                scope,
                filters,
            );
        return this.ok('Challenging questions retrieved successfully', data);
    }

    @Get('skill-gaps')
    @ApiOperation({ summary: 'Skill gap analysis per course' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getSkillGaps(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminSkillGapDto[]>> {
        const data = await this.adminInsightsReportsService.getSkillGaps(
            scope,
            filters,
        );
        return this.ok('Skill gaps retrieved successfully', data);
    }

    @Get('key-areas')
    @ApiOperation({
        summary: 'Key areas needing more training',
        description:
            'Auto-detects courses, tests, and questions with low scores, high failure, or common wrong answers.',
    })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getKeyAreas(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminKeyAreaDto[]>> {
        const data = await this.adminInsightsReportsService.getKeyAreas(
            scope,
            filters,
        );
        return this.ok('Key areas retrieved successfully', data);
    }

    @Get('effectiveness-trends')
    @ApiOperation({ summary: 'Training effectiveness trends over time' })
    @ApiQuery({ name: 'branchId', required: false })
    @ApiQuery({ name: 'timeframe', required: false, enum: ['week', 'month'] })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    async getEffectivenessTrends(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query() filters: AdminReportFiltersDto,
    ): Promise<StandardApiResponse<AdminEffectivenessTrendPointDto[]>> {
        const data =
            await this.adminInsightsReportsService.getEffectivenessTrends(
                scope,
                filters,
            );
        return this.ok('Effectiveness trends retrieved successfully', data);
    }

    private ok<T>(message: string, data: T): StandardApiResponse<T> {
        return {
            success: true,
            message,
            data,
            meta: {
                timestamp: new Date().toISOString(),
            },
        };
    }
}
