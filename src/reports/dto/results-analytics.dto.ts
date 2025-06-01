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
