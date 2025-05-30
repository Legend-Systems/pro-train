import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, IsDate } from 'class-validator';

export class UserStatsDto {
    @ApiProperty({
        description: 'Total number of tests attempted by the user',
        example: 25,
    })
    @IsNumber()
    totalTestsAttempted: number;

    @ApiProperty({
        description: 'Number of tests completed successfully',
        example: 18,
    })
    @IsNumber()
    testsCompleted: number;

    @ApiProperty({
        description: 'Average score across all completed tests',
        example: 82.5,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'User success rate as percentage',
        example: 72.0,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    successRate: number;

    @ApiProperty({
        description: 'Total study time in hours',
        example: 45.5,
    })
    @IsNumber()
    totalStudyTimeHours: number;

    @ApiProperty({
        description: 'Average session duration in minutes',
        example: 35.2,
    })
    @IsNumber()
    averageSessionDurationMinutes: number;

    @ApiProperty({
        description: 'Number of different courses engaged with',
        example: 5,
    })
    @IsNumber()
    coursesEngaged: number;

    @ApiProperty({
        description: 'Current streak of successful tests',
        example: 3,
    })
    @IsNumber()
    currentStreak: number;
}

export class UserEngagementDto {
    @ApiProperty({
        description: 'User ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    @IsString()
    userName: string;

    @ApiProperty({
        description: 'Total login sessions in the last 30 days',
        example: 18,
    })
    @IsNumber()
    loginSessions: number;

    @ApiProperty({
        description: 'Days active in the last 30 days',
        example: 12,
    })
    @IsNumber()
    activeDays: number;

    @ApiProperty({
        description: 'User engagement score (0-100)',
        example: 78.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    engagementScore: number;

    @ApiProperty({
        description: 'Last activity timestamp',
        example: '2024-01-15T14:30:00.000Z',
    })
    @IsDate()
    lastActivity: Date;

    @ApiProperty({
        description: 'Preferred study time (hour of day)',
        example: 14,
        minimum: 0,
        maximum: 23,
    })
    @IsNumber()
    @IsOptional()
    preferredStudyHour?: number;

    @ApiProperty({
        description: 'Most active day of week (0=Sunday, 6=Saturday)',
        example: 2,
        minimum: 0,
        maximum: 6,
    })
    @IsNumber()
    @IsOptional()
    mostActiveDayOfWeek?: number;
}

export class UserPerformanceDto {
    @ApiProperty({
        description: 'User performance trend (improving/declining/stable)',
        example: 'improving',
        enum: ['improving', 'declining', 'stable'],
    })
    @IsString()
    performanceTrend: string;

    @ApiProperty({
        description: 'Improvement rate percentage over time',
        example: 15.5,
    })
    @IsNumber()
    improvementRate: number;

    @ApiProperty({
        description: 'Strongest subject area',
        example: 'Mathematics',
    })
    @IsString()
    @IsOptional()
    strongestSubject?: string;

    @ApiProperty({
        description: 'Subject area that needs improvement',
        example: 'Physics',
    })
    @IsString()
    @IsOptional()
    weakestSubject?: string;

    @ApiProperty({
        description: 'Average attempts needed before success',
        example: 1.8,
    })
    @IsNumber()
    averageAttemptsToSuccess: number;

    @ApiProperty({
        description: 'First attempt success rate percentage',
        example: 65.5,
    })
    @IsNumber()
    firstAttemptSuccessRate: number;

    @ApiProperty({
        description: 'Time efficiency score (0-100)',
        example: 82.0,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    timeEfficiencyScore: number;
}

export class UserAnalyticsResponseDto {
    @ApiProperty({
        description: 'User basic statistics',
        type: UserStatsDto,
    })
    stats: UserStatsDto;

    @ApiProperty({
        description: 'User engagement metrics',
        type: UserEngagementDto,
    })
    engagement: UserEngagementDto;

    @ApiProperty({
        description: 'User performance insights',
        type: UserPerformanceDto,
    })
    performance: UserPerformanceDto;

    @ApiProperty({
        description: 'Timestamp when the report was generated',
        example: '2024-01-15T10:30:45.123Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether this data is from cache',
        example: true,
    })
    cached: boolean;
}

export class GlobalUserStatsDto {
    @ApiProperty({
        description: 'Total number of registered users',
        example: 1250,
    })
    @IsNumber()
    totalUsers: number;

    @ApiProperty({
        description: 'Active users in the last 24 hours',
        example: 85,
    })
    @IsNumber()
    dailyActiveUsers: number;

    @ApiProperty({
        description: 'Active users in the last 7 days',
        example: 320,
    })
    @IsNumber()
    weeklyActiveUsers: number;

    @ApiProperty({
        description: 'Active users in the last 30 days',
        example: 750,
    })
    @IsNumber()
    monthlyActiveUsers: number;

    @ApiProperty({
        description: 'New user registrations in the last 7 days',
        example: 45,
    })
    @IsNumber()
    newUsersThisWeek: number;

    @ApiProperty({
        description: 'Average session duration across all users (minutes)',
        example: 42.3,
    })
    @IsNumber()
    averageSessionDuration: number;

    @ApiProperty({
        description: 'User retention rate percentage',
        example: 68.5,
    })
    @IsNumber()
    retentionRate: number;
}
