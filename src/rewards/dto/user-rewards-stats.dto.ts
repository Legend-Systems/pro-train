import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { XpBreakdown } from '../utils/xp-breakdown.util';
import type { XpRank } from '../constants/xp.constants';
import type { MonthlyChallengeRecord } from '../entities/user-rewards.entity';

/** Response shape returned by awardXP() and GET /rewards/user-stats. */
export class UserRewardsStatsDto {
    @ApiProperty({ description: 'UserRewards record ID', example: 1 })
    id: number;

    @ApiProperty({ description: 'Learner user UUID' })
    userId: string;

    @ApiProperty({ description: 'Organization ID' })
    orgId: string;

    @ApiPropertyOptional({ description: 'Branch ID when scoped' })
    branchId?: string;

    @ApiProperty({ description: 'Display XP (mirrors totalXP)', example: 150 })
    currentXP: number;

    @ApiProperty({ description: 'Lifetime XP total', example: 150 })
    totalXP: number;

    @ApiProperty({ description: 'Current level (1–10)', example: 1 })
    level: number;

    @ApiProperty({ description: 'Rank tier', example: 'ROOKIE' })
    rank: XpRank;

    @ApiProperty({ description: 'Lifetime XP by category' })
    xpBreakdown: XpBreakdown;

    @ApiProperty({ description: 'Active UTC challenge month', example: '2026-06' })
    challengeMonth: string;

    @ApiProperty({ description: 'XP earned this challenge month', example: 50 })
    challengeMonthXP: number;

    @ApiProperty({ description: 'Monthly XP breakdown' })
    challengeMonthXpBreakdown: XpBreakdown;

    @ApiPropertyOptional({ description: 'Whether this award was skipped as a duplicate' })
    skippedDuplicate?: boolean;

    @ApiPropertyOptional({ description: 'Whether level increased on this award' })
    leveledUp?: boolean;

    @ApiPropertyOptional({ description: 'Previous level when leveledUp is true' })
    previousLevel?: number;

    @ApiPropertyOptional({ description: 'Closed monthly challenge history' })
    monthlyChallengeHistory?: MonthlyChallengeRecord[];

    @ApiPropertyOptional({ description: 'Last XP award timestamp' })
    lastActionAt?: Date;
}
