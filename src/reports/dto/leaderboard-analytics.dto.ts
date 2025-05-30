import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardStatsReportDto {
    @ApiProperty({
        description: 'Total number of leaderboard rankings',
        example: 15,
    })
    totalRankings: number;

    @ApiProperty({
        description: 'Average rank across all courses',
        example: 12.5,
    })
    averageRank: number;

    @ApiProperty({
        description: 'Best rank achieved',
        example: 3,
    })
    bestRank: number;

    @ApiProperty({
        description: 'Total points accumulated',
        example: 2850,
    })
    totalPoints: number;

    @ApiProperty({
        description: 'Recent activity count (last 30 days)',
        example: 8,
    })
    recentActivity: number;
}

export class PerformanceTrendLeaderboardDto {
    @ApiProperty({
        description: 'Date of the performance data',
        type: 'string',
        format: 'date',
        example: '2024-01-15',
    })
    date: string;

    @ApiProperty({
        description: 'Average points for that date',
        example: 185.5,
    })
    averagePoints: number;

    @ApiProperty({
        description: 'Average rank for that date',
        example: 8.3,
    })
    averageRank: number;
}

export class CoursePerformanceLeaderboardDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Course name',
        example: 'Advanced Mathematics',
    })
    courseName: string;

    @ApiProperty({
        description: 'Current rank in this course',
        example: 5,
    })
    rank: number;

    @ApiProperty({
        description: 'Points in this course',
        example: 425,
    })
    points: number;
}

export class LeaderboardPerformanceReportDto {
    @ApiProperty({
        description: 'Performance trends over time',
        type: [PerformanceTrendLeaderboardDto],
    })
    performanceTrends: PerformanceTrendLeaderboardDto[];

    @ApiProperty({
        description: 'Performance by course',
        type: [CoursePerformanceLeaderboardDto],
    })
    coursePerformance: CoursePerformanceLeaderboardDto[];
}

export class LeaderboardAnalyticsReportDto {
    @ApiProperty({
        description: 'Leaderboard statistics',
        type: LeaderboardStatsReportDto,
    })
    stats: LeaderboardStatsReportDto;

    @ApiProperty({
        description: 'Performance insights and trends',
        type: LeaderboardPerformanceReportDto,
    })
    performance: LeaderboardPerformanceReportDto;

    @ApiProperty({
        description: 'Timestamp when the analytics were generated',
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether the data was retrieved from cache',
        example: false,
    })
    cached: boolean;
}

export class TopPerformerReportDto {
    @ApiProperty({
        description: 'User ID',
        example: 'user123',
    })
    userId: string;

    @ApiProperty({
        description: 'User name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Total points',
        example: 1850,
    })
    points: number;

    @ApiProperty({
        description: 'Current rank',
        example: 1,
    })
    rank: number;

    @ApiProperty({
        description: 'Course ID (if course-specific)',
        example: 1,
        required: false,
    })
    courseId?: number;
}

export class GlobalPerformerReportDto {
    @ApiProperty({
        description: 'User ID',
        example: 'user123',
    })
    userId: string;

    @ApiProperty({
        description: 'User name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Total points across all courses',
        example: 5240,
    })
    totalPoints: number;

    @ApiProperty({
        description: 'Number of courses participated in',
        example: 8,
    })
    coursesParticipated: number;
}

export class ActiveCourseLeaderboardDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Advanced Mathematics',
    })
    title: string;

    @ApiProperty({
        description: 'Number of participants',
        example: 156,
    })
    participants: number;

    @ApiProperty({
        description: 'Average points in this course',
        example: 285.5,
    })
    averagePoints: number;

    @ApiProperty({
        description: 'Top score in this course',
        example: 950,
    })
    topScore: number;
}

export class GlobalLeaderboardStatsReportDto {
    @ApiProperty({
        description: 'Total participants across all leaderboards',
        example: 2847,
    })
    totalParticipants: number;

    @ApiProperty({
        description: 'Average points across all participants',
        example: 312.8,
    })
    averagePoints: number;

    @ApiProperty({
        description: 'Top 10 global performers',
        type: [GlobalPerformerReportDto],
    })
    topGlobalPerformers: GlobalPerformerReportDto[];

    @ApiProperty({
        description: 'Most active courses by participant count',
        type: [ActiveCourseLeaderboardDto],
    })
    mostActiveCourses: ActiveCourseLeaderboardDto[];

    @ApiProperty({
        description: 'Recent activity count (last 7 days)',
        example: 485,
    })
    recentActivity: number;

    @ApiProperty({
        description: 'Timestamp when the statistics were generated',
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether the data was retrieved from cache',
        example: false,
    })
    cached: boolean;
}

export class RankMovementReportDto {
    @ApiProperty({
        description: 'User ID',
        example: 'user123',
    })
    userId: string;

    @ApiProperty({
        description: 'User name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'Current rank',
        example: 8,
    })
    currentRank: number;

    @ApiProperty({
        description: 'Previous rank',
        example: 12,
    })
    previousRank: number;

    @ApiProperty({
        description: 'Rank change (positive = improvement)',
        example: 4,
    })
    rankChange: number;

    @ApiProperty({
        description: 'Current points',
        example: 1250,
    })
    currentPoints: number;

    @ApiProperty({
        description: 'Points change',
        example: 75,
    })
    pointsChange: number;
}

export class CompetitiveMetricsReportDto {
    @ApiProperty({
        description: 'Total number of participants',
        example: 156,
    })
    totalParticipants: number;

    @ApiProperty({
        description: 'Competition intensity score (0-100)',
        example: 78.5,
    })
    competitionIntensity: number;

    @ApiProperty({
        description: 'Average points among all participants',
        example: 425.8,
    })
    averagePoints: number;

    @ApiProperty({
        description: 'Points threshold for top 10% performers',
        example: 850.0,
    })
    topPerformerThreshold: number;

    @ApiProperty({
        description: 'Gap between top 10% and bottom 10%',
        example: 650.5,
    })
    participationGap: number;

    @ApiProperty({
        description: 'Standard deviation of points',
        example: 125.3,
    })
    standardDeviation: number;
}
