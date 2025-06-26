import { ApiProperty } from '@nestjs/swagger';

export class ResultsStatsReportDto {
    @ApiProperty({
        description: 'Total number of results',
        example: 156,
    })
    totalResults: number;

    @ApiProperty({
        description: 'Number of passed results',
        example: 98,
    })
    passedResults: number;

    @ApiProperty({
        description: 'Number of failed results',
        example: 58,
    })
    failedResults: number;

    @ApiProperty({
        description: 'Pass rate percentage',
        example: 62.82,
    })
    passRate: number;

    @ApiProperty({
        description: 'Average score across all results',
        example: 74.5,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Best score achieved',
        example: 95.0,
    })
    bestScore: number;

    @ApiProperty({
        description: 'Number of recent results (last 7 days)',
        example: 12,
    })
    recentResults: number;
}

export class ScoreHistoryReportDto {
    @ApiProperty({
        description: 'Date of the score',
        type: 'string',
        format: 'date',
        example: '2025-01-15',
    })
    date: string;

    @ApiProperty({
        description: 'Average score for that date',
        example: 78.5,
    })
    averageScore: number;
}

export class SubjectPerformanceReportDto {
    @ApiProperty({
        description: 'Subject or course name',
        example: 'Mathematics',
    })
    subject: string;

    @ApiProperty({
        description: 'Average score in this subject',
        example: 82.3,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Total attempts in this subject',
        example: 25,
    })
    totalAttempts: number;

    @ApiProperty({
        description: 'Pass rate for this subject',
        example: 76.0,
    })
    passRate: number;
}

export class ResultsPerformanceReportDto {
    @ApiProperty({
        description: 'Score history over time',
        type: [ScoreHistoryReportDto],
    })
    scoreHistory: ScoreHistoryReportDto[];

    @ApiProperty({
        description: 'Performance by subject/course',
        type: [SubjectPerformanceReportDto],
    })
    subjectPerformance: SubjectPerformanceReportDto[];

    @ApiProperty({
        description: 'Overall improvement from first to last result',
        example: 15.5,
    })
    improvement: number;

    @ApiProperty({
        description: 'Improvement as a percentage',
        example: 23.8,
    })
    improvementPercentage: number;
}

export class ResultsQualityReportDto {
    @ApiProperty({
        description: 'Score consistency measure (0-100)',
        example: 85.2,
    })
    scoreConsistency: number;

    @ApiProperty({
        description: 'Results reliability score (0-100)',
        example: 78.9,
    })
    reliability: number;

    @ApiProperty({
        description: 'Number of outlier scores detected',
        example: 3,
    })
    outlierCount: number;

    @ApiProperty({
        description: 'Performance variance from expected difficulty',
        example: 12.5,
    })
    performanceVariance: number;

    @ApiProperty({
        description: 'Standard deviation of scores',
        example: 14.2,
    })
    standardDeviation: number;
}

export class ResultsAnalyticsReportDto {
    @ApiProperty({
        description: 'Results statistics',
        type: ResultsStatsReportDto,
    })
    stats: ResultsStatsReportDto;

    @ApiProperty({
        description: 'Performance insights and trends',
        type: ResultsPerformanceReportDto,
    })
    performance: ResultsPerformanceReportDto;

    @ApiProperty({
        description: 'Quality and reliability metrics',
        type: ResultsQualityReportDto,
    })
    quality: ResultsQualityReportDto;

    @ApiProperty({
        description: 'Timestamp when the analytics were generated',
        type: 'string',
        format: 'date-time',
        example: '2025-01-15T10:30:00Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether the data was retrieved from cache',
        example: false,
    })
    cached: boolean;
}

export class ScoreDistributionReportDto {
    @ApiProperty({
        description: 'Number of A grades (90-100%)',
        example: 25,
    })
    aGrade: number;

    @ApiProperty({
        description: 'Number of B grades (80-89%)',
        example: 42,
    })
    bGrade: number;

    @ApiProperty({
        description: 'Number of C grades (70-79%)',
        example: 38,
    })
    cGrade: number;

    @ApiProperty({
        description: 'Number of D grades (60-69%)',
        example: 28,
    })
    dGrade: number;

    @ApiProperty({
        description: 'Number of F grades (0-59%)',
        example: 23,
    })
    fGrade: number;
}

export class TopPerformingCourseReportDto {
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
        description: 'Average score for this course',
        example: 87.5,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Total number of results for this course',
        example: 156,
    })
    totalResults: number;
}

export class GlobalResultsStatsReportDto {
    @ApiProperty({
        description: 'Total results across all courses',
        example: 2847,
    })
    totalResults: number;

    @ApiProperty({
        description: 'Total passed results',
        example: 1823,
    })
    passedResults: number;

    @ApiProperty({
        description: 'Total failed results',
        example: 1024,
    })
    failedResults: number;

    @ApiProperty({
        description: 'Global pass rate percentage',
        example: 64.0,
    })
    passRate: number;

    @ApiProperty({
        description: 'Overall average score across all results',
        example: 72.8,
    })
    overallAverageScore: number;

    @ApiProperty({
        description: 'Score distribution across grade levels',
        type: ScoreDistributionReportDto,
    })
    scoreDistribution: ScoreDistributionReportDto;

    @ApiProperty({
        description: 'Number of results in the last 30 days',
        example: 485,
    })
    recentResults: number;

    @ApiProperty({
        description: 'Top 5 performing courses by average score',
        type: [TopPerformingCourseReportDto],
    })
    topPerformingCourses: TopPerformingCourseReportDto[];

    @ApiProperty({
        description: 'Timestamp when the statistics were generated',
        type: 'string',
        format: 'date-time',
        example: '2025-01-15T10:30:00Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether the data was retrieved from cache',
        example: false,
    })
    cached: boolean;
}

export class PerformanceTrendReportDto {
    @ApiProperty({
        description: 'Date of the performance data',
        type: 'string',
        format: 'date',
        example: '2025-01-15',
    })
    date: string;

    @ApiProperty({
        description: 'Average score for that date',
        example: 75.4,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Total number of results for that date',
        example: 23,
    })
    totalResults: number;

    @ApiProperty({
        description: 'Number of passed results for that date',
        example: 15,
    })
    passedResults: number;

    @ApiProperty({
        description: 'Pass rate for that date',
        example: 65.2,
    })
    passRate: number;
}

// New Enhanced Multi-Dimensional Trend DTOs
export class EnhancedPerformanceTrendReportDto {
    @ApiProperty({
        description: 'Time period (date for daily, YYYY-MM for monthly)',
        type: 'string',
        example: '2025-01',
    })
    period: string;

    @ApiProperty({
        description: 'Aggregation type (daily, weekly, monthly)',
        example: 'monthly',
        enum: ['daily', 'weekly', 'monthly'],
    })
    aggregationType: string;

    @ApiProperty({
        description: 'Branch ID (if branch-specific)',
        example: 'branch-uuid-123',
        required: false,
    })
    branchId?: string;

    @ApiProperty({
        description: 'Branch name (if branch-specific)',
        example: 'Downtown Branch',
        required: false,
    })
    branchName?: string;

    @ApiProperty({
        description: 'User ID (if user-specific)',
        example: 'user-uuid-456',
        required: false,
    })
    userId?: string;

    @ApiProperty({
        description: 'Test ID (if test-specific)',
        example: 123,
        required: false,
    })
    testId?: number;

    @ApiProperty({
        description: 'Test title (if test-specific)',
        example: 'JavaScript Fundamentals Quiz',
        required: false,
    })
    testTitle?: string;

    @ApiProperty({
        description: 'Course ID (if course-specific)',
        example: 456,
        required: false,
    })
    courseId?: number;

    @ApiProperty({
        description: 'Course title (if course-specific)',
        example: 'Web Development Bootcamp',
        required: false,
    })
    courseTitle?: string;

    @ApiProperty({
        description: 'Average score for the period',
        example: 78.5,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Median score for the period',
        example: 80.0,
    })
    medianScore: number;

    @ApiProperty({
        description: 'Total number of results for the period',
        example: 145,
    })
    totalResults: number;

    @ApiProperty({
        description: 'Number of passed results for the period',
        example: 112,
    })
    passedResults: number;

    @ApiProperty({
        description: 'Number of failed results for the period',
        example: 33,
    })
    failedResults: number;

    @ApiProperty({
        description: 'Pass rate percentage for the period',
        example: 77.2,
    })
    passRate: number;

    @ApiProperty({
        description: 'Average completion time in minutes',
        example: 45.3,
    })
    averageCompletionTime: number;

    @ApiProperty({
        description: 'Total unique users who took tests in this period',
        example: 89,
    })
    uniqueUsers: number;

    @ApiProperty({
        description: 'Total test attempts in this period',
        example: 178,
    })
    totalAttempts: number;

    @ApiProperty({
        description: 'Score improvement from previous period',
        example: 2.5,
    })
    scoreImprovement: number;

    @ApiProperty({
        description: 'Pass rate improvement from previous period',
        example: 1.8,
    })
    passRateImprovement: number;
}

export class TrendFilterDto {
    @ApiProperty({
        description: 'Start date for trend analysis',
        type: 'string',
        format: 'date',
        example: '2024-01-01',
        required: false,
    })
    startDate?: string;

    @ApiProperty({
        description: 'End date for trend analysis',
        type: 'string',
        format: 'date',
        example: '2025-01-31',
        required: false,
    })
    endDate?: string;

    @ApiProperty({
        description: 'Aggregation type',
        example: 'monthly',
        enum: ['daily', 'weekly', 'monthly'],
        required: false,
    })
    groupBy?: 'daily' | 'weekly' | 'monthly';

    @ApiProperty({
        description: 'Branch ID for branch-specific trends',
        example: 'branch-uuid-123',
        required: false,
    })
    branchId?: string;

    @ApiProperty({
        description: 'User ID for user-specific trends',
        example: 'user-uuid-456',
        required: false,
    })
    userId?: string;

    @ApiProperty({
        description: 'Test ID for test-specific trends',
        example: 123,
        required: false,
    })
    testId?: number;

    @ApiProperty({
        description: 'Course ID for course-specific trends',
        example: 456,
        required: false,
    })
    courseId?: number;

    @ApiProperty({
        description: 'Include improvement calculations',
        example: true,
        required: false,
    })
    includeImprovement?: boolean;

    @ApiProperty({
        description: 'Include completion time metrics',
        example: true,
        required: false,
    })
    includeTimingMetrics?: boolean;
}

export class BranchPerformanceComparisonDto {
    @ApiProperty({
        description: 'Branch performance trends comparison',
        type: [EnhancedPerformanceTrendReportDto],
    })
    branchTrends: EnhancedPerformanceTrendReportDto[];

    @ApiProperty({
        description: 'Best performing branch',
        example: 'Downtown Branch',
    })
    topBranch: string;

    @ApiProperty({
        description: 'Branch rankings by average score',
        type: 'object',
        additionalProperties: { type: 'number' },
        example: {
            'Downtown Branch': 1,
            'Uptown Branch': 2,
            'Suburban Branch': 3,
        },
    })
    branchRankings: { [branchName: string]: number };
}
