import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    Min,
} from 'class-validator';

/** Supported improvement / overview time windows. */
export type AdminReportTimeframe = 'week' | 'month';

/** Sort direction for ranked performer lists. */
export type AdminReportSortOrder = 'asc' | 'desc';

/** Shared query filters for admin insight endpoints. */
export class AdminReportFiltersDto {
    @ApiPropertyOptional({
        description: 'Optional branch UUID filter',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    branchId?: string;

    @ApiPropertyOptional({
        description: 'Time window for period comparisons',
        enum: ['week', 'month'],
        default: 'month',
    })
    @IsOptional()
    @IsIn(['week', 'month'])
    timeframe?: AdminReportTimeframe;

    @ApiPropertyOptional({
        description: 'ISO start date (inclusive)',
        example: '2026-07-01',
    })
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'ISO end date (exclusive)',
        example: '2026-08-01',
    })
    @IsOptional()
    @IsString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Month bucket for training hours (YYYY-MM)',
        example: '2026-07',
    })
    @IsOptional()
    @IsString()
    yearMonth?: string;

    @ApiPropertyOptional({
        description: 'Result limit for ranked lists',
        default: 10,
        minimum: 1,
        maximum: 50,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    limit?: number;

    @ApiPropertyOptional({
        description: 'Sort order for performer rankings',
        enum: ['asc', 'desc'],
        default: 'desc',
    })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    order?: AdminReportSortOrder;
}

export class AdminPerformerDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    resultsCount: number;
}

export class AdminTrainingHoursUserDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    totalMinutes: number;

    @ApiProperty()
    totalHours: number;

    @ApiProperty()
    sessionCount: number;
}

export class AdminTestPassFailDto {
    @ApiProperty()
    testId: number;

    @ApiProperty()
    testTitle: string;

    @ApiPropertyOptional({ nullable: true })
    courseId: number | null;

    @ApiPropertyOptional({ nullable: true })
    courseTitle: string | null;

    @ApiProperty()
    totalAttempts: number;

    @ApiProperty()
    passedCount: number;

    @ApiProperty()
    failedCount: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    averageScore: number;
}

export class AdminPassRateDto {
    @ApiProperty()
    entityType: 'test' | 'course';

    @ApiProperty()
    entityId: number;

    @ApiProperty()
    title: string;

    @ApiProperty()
    totalAttempts: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    averageScore: number;
}

export class AdminKnowledgeImprovementDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    previousAverage: number;

    @ApiProperty()
    currentAverage: number;

    @ApiProperty()
    improvementDelta: number;

    @ApiProperty()
    currentResultsCount: number;

    @ApiProperty()
    previousResultsCount: number;
}

export class AdminLeaderboardEntryDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    totalPoints: number;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    rank: number;

    @ApiPropertyOptional({ nullable: true })
    courseId: number | null;

    @ApiPropertyOptional({ nullable: true })
    courseTitle: string | null;
}

/**
 * One learner's standing in the organization-wide leaderboard.
 * Deliberately achievement-only: no average score or pass-rate is exposed at
 * row level so full rankings can be shared without embarrassing anyone.
 */
export class AdminRankingEntryDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchId: string | null;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty({ description: 'Dense rank across the organization' })
    rank: number;

    @ApiProperty({ description: 'Rank within the learner\u2019s own branch' })
    branchRank: number;

    @ApiProperty()
    totalPoints: number;

    @ApiProperty({ description: 'Tests with a recorded result' })
    testsCompleted: number;

    @ApiProperty()
    testsPassed: number;
}

/** Celebratory top 3 for a single branch. */
export class AdminBranchTopPerformersDto {
    @ApiProperty()
    branchId: string;

    @ApiProperty()
    branchName: string;

    @ApiProperty({ type: [AdminRankingEntryDto] })
    topPerformers: AdminRankingEntryDto[];
}

/** Highest single test score achieved in the reporting window. */
export class AdminTopScorerDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    testId: number;

    @ApiProperty()
    testTitle: string;

    @ApiPropertyOptional({ nullable: true })
    courseTitle: string | null;

    @ApiProperty({ description: 'Best percentage achieved on this test' })
    scorePercentage: number;

    @ApiProperty()
    achievedAt: Date;
}

/** Org-level completion totals used for the motivational summary. */
export class AdminTestCompletionSummaryDto {
    @ApiProperty()
    totalTestsCompleted: number;

    @ApiProperty()
    totalTestsPassed: number;

    @ApiProperty()
    participatingLearners: number;

    @ApiProperty()
    averageTestsPerLearner: number;
}

/** Bundle of leaderboard-only datasets used by motivational reports. */
export class AdminLeaderboardInsightsDto {
    @ApiProperty({ type: [AdminRankingEntryDto] })
    fullRankings: AdminRankingEntryDto[];

    @ApiProperty({ type: [AdminBranchTopPerformersDto] })
    branchTopPerformers: AdminBranchTopPerformersDto[];

    @ApiProperty({ type: [AdminTopScorerDto] })
    topScorers: AdminTopScorerDto[];

    @ApiProperty({ type: AdminTestCompletionSummaryDto })
    testCompletion: AdminTestCompletionSummaryDto;
}

export class AdminBranchComparisonDto {
    @ApiProperty()
    branchId: string;

    @ApiProperty()
    branchName: string;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    resultsCount: number;

    @ApiProperty()
    totalHours: number;

    @ApiProperty()
    activeLearners: number;
}

export class AdminAtRiskUserDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    improvementDelta: number;

    @ApiProperty()
    resultsCount: number;

    @ApiProperty()
    riskReasons: string[];
}

export class AdminHighPotentialUserDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    improvementDelta: number;

    @ApiProperty()
    resultsCount: number;
}

export class AdminChallengingQuestionDto {
    @ApiProperty()
    questionId: number;

    @ApiProperty()
    questionText: string;

    @ApiProperty()
    testId: number;

    @ApiProperty()
    testTitle: string;

    @ApiProperty()
    totalAnswers: number;

    @ApiProperty()
    incorrectCount: number;

    @ApiProperty()
    incorrectRate: number;

    @ApiPropertyOptional({ nullable: true })
    mostCommonWrongOptionId: number | null;

    @ApiPropertyOptional({ nullable: true })
    mostCommonWrongOptionText: string | null;
}

export class AdminSkillGapDto {
    @ApiProperty()
    courseId: number;

    @ApiProperty()
    courseTitle: string;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    resultsCount: number;

    @ApiProperty()
    gapSeverity: 'low' | 'medium' | 'high';
}

export class AdminKeyAreaDto {
    @ApiProperty()
    areaType: 'course' | 'test' | 'question';

    @ApiProperty()
    entityId: number;

    @ApiProperty()
    title: string;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    failureRate: number;

    @ApiProperty({ type: [String] })
    signals: string[];

    @ApiProperty()
    priorityScore: number;
}

export class AdminEffectivenessTrendPointDto {
    @ApiProperty()
    period: string;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    resultsCount: number;

    @ApiProperty()
    activeLearners: number;
}

export class AdminOverviewKpisDto {
    @ApiProperty()
    averageKnowledgeScore: number;

    @ApiProperty()
    overallPassRate: number;

    @ApiProperty()
    totalResults: number;

    @ApiProperty()
    activeLearners: number;

    @ApiProperty()
    totalTrainingHours: number;

    @ApiProperty()
    atRiskUserCount: number;

    @ApiProperty()
    highPotentialUserCount: number;

    @ApiProperty()
    keyAreaCount: number;
}

/** Hub payload: overview KPIs plus the most actionable report slices. */
export class AdminOverviewReportDto {
    @ApiProperty({ type: AdminOverviewKpisDto })
    kpis: AdminOverviewKpisDto;

    @ApiProperty({ type: [AdminPerformerDto] })
    topPerformers: AdminPerformerDto[];

    @ApiProperty({ type: [AdminPerformerDto] })
    worstPerformers: AdminPerformerDto[];

    @ApiProperty({ type: [AdminTestPassFailDto] })
    mostFailedTests: AdminTestPassFailDto[];

    @ApiProperty({ type: [AdminTestPassFailDto] })
    mostPassedTests: AdminTestPassFailDto[];

    @ApiProperty({ type: [AdminBranchComparisonDto] })
    branchComparison: AdminBranchComparisonDto[];

    @ApiProperty({ type: [AdminAtRiskUserDto] })
    atRiskUsers: AdminAtRiskUserDto[];

    @ApiProperty({ type: [AdminHighPotentialUserDto] })
    highPotentialUsers: AdminHighPotentialUserDto[];

    @ApiProperty({ type: [AdminKeyAreaDto] })
    keyAreas: AdminKeyAreaDto[];

    @ApiProperty({ type: [AdminEffectivenessTrendPointDto] })
    effectivenessTrends: AdminEffectivenessTrendPointDto[];

    /**
     * Leaderboard datasets are resolved lazily — only reports that select a
     * leaderboard section pay the cost of the extra queries.
     */
    @ApiPropertyOptional({ type: [AdminRankingEntryDto] })
    fullRankings?: AdminRankingEntryDto[];

    @ApiPropertyOptional({ type: [AdminBranchTopPerformersDto] })
    branchTopPerformers?: AdminBranchTopPerformersDto[];

    @ApiPropertyOptional({ type: [AdminTopScorerDto] })
    topScorers?: AdminTopScorerDto[];

    @ApiPropertyOptional({ type: AdminTestCompletionSummaryDto })
    testCompletion?: AdminTestCompletionSummaryDto;

    @ApiProperty()
    generatedAt: Date;

    @ApiProperty()
    timeframe: AdminReportTimeframe;
}
