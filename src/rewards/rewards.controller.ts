import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    NotFoundException,
    Logger,
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
import { RewardsService } from './rewards.service';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UserRewardsStatsDto } from './dto/user-rewards-stats.dto';
import {
    RewardsRankingsQueryDto,
    RewardsRankingsResponseDto,
} from './dto/rewards-rankings.dto';
import {
    RewardsTransactionsQueryDto,
    RewardsTransactionsResponseDto,
} from './dto/rewards-transactions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgRoleGuard } from '../auth/guards/org-role.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import type { OrgBranchScope as OrgBranchScopeType } from '../auth/decorators/org-branch-scope.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

/**
 * REST API for XP rewards — Phases 2–5 endpoints.
 */
@ApiTags('⭐ XP Rewards')
@Controller('rewards')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token',
    required: true,
})
export class RewardsController {
    private readonly logger = new Logger(RewardsController.name);

    constructor(private readonly rewardsService: RewardsService) {}

    /**
     * Manual/admin XP award — restricted to admin roles.
     * Delegates to RewardsService.awardXP() (single transaction entry point).
     */
    @Post('award-xp')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({ summary: 'Manually award XP to a user (admin only)' })
    async awardXp(
        @Body() dto: CreateRewardDto,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<UserRewardsStatsDto> {
        if (!scope.orgId) {
            throw new NotFoundException('Organization context required');
        }

        const result = await this.rewardsService.awardXP(
            dto,
            scope.orgId,
            scope.branchId,
        );

        if ('skipped' in result && result.skipped) {
            this.logger.warn(
                `Manual XP award skipped (${result.reason}) for user ${dto.userId}`,
            );
            throw new NotFoundException(
                `Could not award XP: ${result.reason}`,
            );
        }

        return result as UserRewardsStatsDto;
    }

    /** Returns lifetime + monthly XP stats for a user within org scope. */
    @Get('user-stats/:userId')
    @ApiOperation({ summary: 'Get XP stats for a user' })
    @ApiParam({ name: 'userId', description: 'Target user UUID' })
    async getUserStats(
        @Param('userId') userId: string,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<UserRewardsStatsDto> {
        const stats = await this.rewardsService.getUserStats(userId, scope);

        if (!stats) {
            throw new NotFoundException(
                `No rewards record found for user ${userId}`,
            );
        }

        return stats;
    }

    /** Phase 5 — org/branch XP leaderboard (all-time or monthly challenge). */
    @Get('rankings')
    @ApiOperation({ summary: 'Get XP rankings for org/branch' })
    @ApiQuery({ name: 'scope', required: false, enum: ['alltime', 'monthly'] })
    @ApiQuery({ name: 'month', required: false, description: 'YYYY-MM for monthly' })
    async getRankings(
        @Query() query: RewardsRankingsQueryDto,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<RewardsRankingsResponseDto> {
        return this.rewardsService.getRankings(
            scope,
            query.scope,
            query.month,
            query.page,
            query.limit,
        );
    }

    /** Phase 5 — paginated XP transaction history for audit. */
    @Get('transactions/:userId')
    @ApiOperation({ summary: 'Get paginated XP transaction history' })
    @ApiParam({ name: 'userId', description: 'Target user UUID' })
    async getTransactions(
        @Param('userId') userId: string,
        @Query() query: RewardsTransactionsQueryDto,
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<RewardsTransactionsResponseDto> {
        return this.rewardsService.getTransactions(
            userId,
            scope,
            query.page,
            query.limit,
        );
    }
}
