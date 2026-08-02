import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

/** Time window for org/course leaderboard rankings. */
export enum LeaderboardOverviewPeriod {
    ALL_TIME = 'all-time',
    MONTH = 'month',
}

/** Query params for GET /leaderboards and enriched course rankings. */
export class LeaderboardOverviewQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 50, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 50;

    @ApiPropertyOptional({
        description: 'Optional course filter (omit for all courses)',
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    courseId?: number;

    @ApiPropertyOptional({ description: 'Filter by branch UUID' })
    @IsOptional()
    @IsString()
    branchId?: string;

    @ApiPropertyOptional({
        enum: LeaderboardOverviewPeriod,
        default: LeaderboardOverviewPeriod.MONTH,
    })
    @IsOptional()
    @IsEnum(LeaderboardOverviewPeriod)
    period?: LeaderboardOverviewPeriod = LeaderboardOverviewPeriod.MONTH;

    @ApiPropertyOptional({
        description: 'UTC month YYYY-MM when period=month',
        example: '2026-07',
    })
    @IsOptional()
    @IsString()
    month?: string;

    @ApiPropertyOptional({
        description: 'Search by first or last name',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Only include users with activity in the last 30 days',
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    activeOnly?: boolean;
}

/** Single ranking row in the overview response. */
export class LeaderboardOverviewEntryDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    rank: number;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional()
    email?: string;

    @ApiPropertyOptional()
    profilePicture?: string | null;

    @ApiPropertyOptional()
    branchName?: string | null;

    @ApiProperty()
    totalPoints: number;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    testsCompleted: number;

    @ApiProperty()
    letterGrade: string;

    @ApiProperty({
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    })
    achievementLevel: string;

    @ApiPropertyOptional()
    previousPoints?: number | null;

    @ApiPropertyOptional()
    pointsDelta?: number | null;

    @ApiPropertyOptional()
    previousRank?: number | null;

    @ApiPropertyOptional()
    rankChange?: number | null;

    @ApiPropertyOptional()
    percentileRank?: number;

    @ApiPropertyOptional()
    consistencyRating?: number;

    @ApiPropertyOptional({ type: [String] })
    badges?: string[];

    @ApiPropertyOptional()
    courseId?: number | null;

    @ApiPropertyOptional()
    courseTitle?: string | null;
}

/** Aggregate insight cards for the leaderboard period. */
export class LeaderboardSummaryDto {
    @ApiProperty()
    totalParticipants: number;

    @ApiProperty()
    averagePoints: number;

    @ApiProperty()
    highestScore: number;

    @ApiPropertyOptional()
    averageScore?: number;

    @ApiPropertyOptional()
    yourRank?: number | null;

    @ApiPropertyOptional()
    yourPoints?: number | null;

    @ApiPropertyOptional()
    yourPointsDelta?: number | null;
}

/** Top improver / needs-support row. */
export class LeaderboardImproverDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional()
    branchName?: string | null;

    @ApiProperty()
    currentRank: number;

    @ApiPropertyOptional()
    previousRank?: number | null;

    @ApiProperty()
    currentPoints: number;

    @ApiPropertyOptional()
    previousPoints?: number | null;

    @ApiProperty()
    pointsDelta: number;
}

/** Full enriched leaderboard payload for web + mobile. */
export class LeaderboardOverviewResponseDto {
    @ApiProperty({ type: [LeaderboardOverviewEntryDto] })
    entries: LeaderboardOverviewEntryDto[];

    /** Alias for legacy web clients that expect `leaderboard`. */
    @ApiProperty({ type: [LeaderboardOverviewEntryDto] })
    leaderboard: LeaderboardOverviewEntryDto[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty({ enum: LeaderboardOverviewPeriod })
    period: LeaderboardOverviewPeriod;

    @ApiPropertyOptional()
    month?: string;

    @ApiPropertyOptional()
    courseId?: number;

    @ApiProperty({ type: LeaderboardSummaryDto })
    summary: LeaderboardSummaryDto;

    @ApiProperty({ type: [LeaderboardImproverDto] })
    topImprovers: LeaderboardImproverDto[];

    @ApiProperty({ type: [LeaderboardImproverDto] })
    needsSupport: LeaderboardImproverDto[];
}
