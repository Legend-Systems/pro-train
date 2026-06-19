import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum RewardsRankingScope {
    ALLTIME = 'alltime',
    MONTHLY = 'monthly',
}

/** Query params for GET /rewards/rankings */
export class RewardsRankingsQueryDto {
    @ApiPropertyOptional({ enum: RewardsRankingScope, default: RewardsRankingScope.ALLTIME })
    @IsOptional()
    @IsEnum(RewardsRankingScope)
    scope?: RewardsRankingScope = RewardsRankingScope.ALLTIME;

    @ApiPropertyOptional({ description: 'UTC month YYYY-MM for monthly scope' })
    @IsOptional()
    @IsString()
    month?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;
}

/** Single row in XP rankings response. */
export class RewardsRankingEntryDto {
    @ApiProperty()
    rank: number;

    @ApiProperty()
    userId: string;

    @ApiProperty()
    totalXP: number;

    @ApiProperty()
    level: number;

    @ApiProperty()
    rankTier: string;

    @ApiPropertyOptional()
    firstName?: string;

    @ApiPropertyOptional()
    lastName?: string;
}

export class RewardsRankingsResponseDto {
    @ApiProperty({ type: [RewardsRankingEntryDto] })
    rankings: RewardsRankingEntryDto[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    scope: RewardsRankingScope;

    @ApiPropertyOptional()
    month?: string;
}
