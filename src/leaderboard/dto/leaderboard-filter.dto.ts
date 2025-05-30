import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsOptional,
    IsNumber,
    IsString,
    IsDate,
    IsEnum,
    Min,
    Max,
} from 'class-validator';

export enum LeaderboardPeriod {
    WEEK = 'week',
    MONTH = 'month',
    ALL_TIME = 'all-time',
}

export enum LeaderboardSortBy {
    RANK = 'rank',
    SCORE = 'totalScore',
    TESTS_COMPLETED = 'testsCompleted',
    AVERAGE_SCORE = 'averageScore',
    LAST_UPDATED = 'lastUpdated',
}

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

export class LeaderboardFilterDto {
    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 20,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Time period for leaderboard',
        enum: LeaderboardPeriod,
        example: LeaderboardPeriod.ALL_TIME,
    })
    @IsOptional()
    @IsEnum(LeaderboardPeriod)
    period?: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME;

    @ApiPropertyOptional({
        description: 'Sort by field',
        enum: LeaderboardSortBy,
        example: LeaderboardSortBy.RANK,
    })
    @IsOptional()
    @IsEnum(LeaderboardSortBy)
    sortBy?: LeaderboardSortBy = LeaderboardSortBy.RANK;

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: SortOrder,
        example: SortOrder.ASC,
    })
    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder?: SortOrder = SortOrder.ASC;

    @ApiPropertyOptional({
        description: 'Filter by minimum score',
        example: 50,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    minScore?: number;

    @ApiPropertyOptional({
        description: 'Filter by maximum score',
        example: 100,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    maxScore?: number;

    @ApiPropertyOptional({
        description: 'Filter by minimum rank',
        example: 1,
        minimum: 1,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    minRank?: number;

    @ApiPropertyOptional({
        description: 'Filter by maximum rank',
        example: 50,
        minimum: 1,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    maxRank?: number;

    @ApiPropertyOptional({
        description: 'Filter by minimum number of tests completed',
        example: 3,
        minimum: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Type(() => Number)
    minTestsCompleted?: number;

    @ApiPropertyOptional({
        description: 'Search by user name (first or last name)',
        example: 'John',
    })
    @IsOptional()
    @IsString()
    searchName?: string;

    @ApiPropertyOptional({
        description: 'Search by user email',
        example: 'john@example.com',
    })
    @IsOptional()
    @IsString()
    searchEmail?: string;

    @ApiPropertyOptional({
        description: 'Filter by achievement level',
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        example: 'intermediate',
    })
    @IsOptional()
    @IsString()
    achievementLevel?: string;

    @ApiPropertyOptional({
        description: 'Filter by activity after date',
        example: '2024-01-01T00:00:00.000Z',
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    activeAfter?: Date;

    @ApiPropertyOptional({
        description: 'Filter by activity before date',
        example: '2024-01-31T23:59:59.999Z',
    })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    activeBefore?: Date;

    @ApiPropertyOptional({
        description: 'Show only users with rank changes',
        example: true,
    })
    @IsOptional()
    showRankChangesOnly?: boolean;

    @ApiPropertyOptional({
        description: 'Show only active users (recent activity)',
        example: true,
    })
    @IsOptional()
    activeUsersOnly?: boolean;
}
