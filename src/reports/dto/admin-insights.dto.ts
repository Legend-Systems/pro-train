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
        description:
            'Calendar month (YYYY-MM) for month-scoped slices such as training hours and tests not completed',
        example: '2026-08',
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

    @ApiPropertyOptional({
        nullable: true,
        description:
            'Short branch code. Preferred for narrow layouts such as the PDF rankings table, where full branch names overflow the column.',
        example: 'BitTzaneen',
    })
    branchAlias: string | null;

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

    @ApiPropertyOptional({
        nullable: true,
        description: 'Short branch code used as the heading in exports',
        example: 'BitTzaneen',
    })
    branchAlias: string | null;

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

    @ApiPropertyOptional({
        nullable: true,
        description: 'Short branch code used in exports',
        example: 'BitTzaneen',
    })
    branchAlias: string | null;

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

/** A test the learner still needs to finish in the selected month. */
export class AdminMissedTestDto {
    @ApiProperty()
    testId: number;

    @ApiProperty()
    testTitle: string;

    @ApiPropertyOptional({ nullable: true })
    courseTitle: string | null;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Exam window start, when the test is scheduled',
    })
    examStartDate: Date | null;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Exam window end, when the test is scheduled',
    })
    examEndDate: Date | null;
}

/**
 * One learner in the tests-not-completed report, with the tests they still
 * owe for the selected month.
 */
export class AdminTestsNotCompletedUserDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    missedTestCount: number;

    @ApiProperty({ type: [AdminMissedTestDto] })
    missedTests: AdminMissedTestDto[];
}

/**
 * Month-scoped “who still needs to complete tests” payload.
 *
 * Two groups are kept separate so admins can tell “never started” apart from
 * “started but abandoned” (`in_progress` / `expired`).
 */
export class AdminTestsNotCompletedReportDto {
    @ApiProperty({ example: '2026-08', description: 'Calendar month (YYYY-MM)' })
    yearMonth: string;

    @ApiProperty({ example: 'August 2026' })
    monthLabel: string;

    @ApiProperty({ type: [AdminTestsNotCompletedUserDto] })
    usersWithNoAttempts: AdminTestsNotCompletedUserDto[];

    @ApiProperty({ type: [AdminTestsNotCompletedUserDto] })
    usersWithIncompleteAttempts: AdminTestsNotCompletedUserDto[];
}

/**
 * Score movement across a learner's results for one test.
 * `insufficient_data` means fewer than two graded results.
 */
export type AdminImprovementTrend =
    | 'improving'
    | 'declining'
    | 'stable'
    | 'insufficient_data';

/** One graded result for a learner on a single test. */
export class AdminAttemptResultItemDto {
    @ApiProperty()
    resultId: number;

    @ApiProperty()
    attemptId: number;

    @ApiProperty({ description: '1-based attempt number for this user+test' })
    attemptNumber: number;

    @ApiProperty({ description: 'Raw points scored' })
    score: number;

    @ApiProperty()
    maxScore: number;

    @ApiProperty({ description: 'Score as a percentage of max (0–100)' })
    percentage: number;

    @ApiProperty({ description: 'True when percentage meets the org pass mark' })
    passed: boolean;

    @ApiProperty({ description: 'When the result was calculated (submit time)' })
    submittedAt: Date;
}

/**
 * An attempt that was started but never produced a result in this window
 * (`in_progress` or `expired`). Cancelled and voided attempts are omitted.
 */
export class AdminIncompleteAttemptItemDto {
    @ApiProperty()
    attemptId: number;

    @ApiProperty()
    attemptNumber: number;

    @ApiProperty({ enum: ['in_progress', 'expired'] })
    status: 'in_progress' | 'expired';

    @ApiProperty()
    startTime: Date;

    @ApiPropertyOptional({ nullable: true })
    submitTime: Date | null;

    @ApiProperty()
    progressPercentage: number;
}

/**
 * One test inside a learner's breakdown: counts, extra insight metrics,
 * then the individual result and incomplete-attempt rows.
 */
export class AdminLearnerTestBreakdownDto {
    @ApiProperty()
    testId: number;

    @ApiProperty()
    testTitle: string;

    @ApiPropertyOptional({ nullable: true })
    courseTitle: string | null;

    @ApiProperty({ description: 'Non-cancelled, non-voided attempts in the window' })
    totalAttempts: number;

    @ApiProperty({ description: 'Graded results in the window' })
    totalResults: number;

    @ApiProperty()
    passedCount: number;

    @ApiProperty()
    failedCount: number;

    @ApiProperty({ description: 'Mean percentage across all results (pass + fail)' })
    averageScore: number;

    @ApiPropertyOptional({ nullable: true })
    bestScore: number | null;

    @ApiPropertyOptional({ nullable: true })
    worstScore: number | null;

    @ApiPropertyOptional({ nullable: true })
    firstScore: number | null;

    @ApiPropertyOptional({ nullable: true })
    lastScore: number | null;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Last score minus first score, in percentage points',
    })
    scoreDelta: number | null;

    @ApiPropertyOptional({
        nullable: true,
        description:
            'Number of graded results until the first pass (inclusive). Null if never passed.',
    })
    attemptsToPass: number | null;

    @ApiProperty({ enum: ['improving', 'declining', 'stable', 'insufficient_data'] })
    improvementTrend: AdminImprovementTrend;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Hours between the first and last result (or incomplete start)',
    })
    hoursBetweenFirstAndLast: number | null;

    @ApiProperty({ type: [AdminAttemptResultItemDto] })
    results: AdminAttemptResultItemDto[];

    @ApiProperty({ type: [AdminIncompleteAttemptItemDto] })
    incompleteAttempts: AdminIncompleteAttemptItemDto[];
}

/**
 * One learner in the attempts/results breakdown.
 * Only learners with at least one attempt or result in the window appear.
 */
export class AdminLearnerAttemptsBreakdownDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty({ description: 'Distinct tests with an attempt or result' })
    testsParticipated: number;

    @ApiProperty()
    totalAttempts: number;

    @ApiProperty()
    totalResults: number;

    @ApiProperty()
    passedCount: number;

    @ApiProperty()
    failedCount: number;

    @ApiProperty({ description: 'Share of this learner\'s results that passed' })
    overallPassRate: number;

    @ApiProperty({ description: 'Mean percentage across all of this learner\'s results' })
    overallAverageScore: number;

    @ApiProperty({ type: [AdminLearnerTestBreakdownDto] })
    tests: AdminLearnerTestBreakdownDto[];
}

/**
 * Per-learner, per-test attempts and results for the reporting window.
 *
 * This is the diagnostic counterpart to high-score leaderboards: every graded
 * result is listed so a later pass cannot hide earlier failures.
 */
export class AdminAttemptsResultsBreakdownReportDto {
    @ApiProperty({ enum: ['week', 'month'] })
    timeframe: AdminReportTimeframe;

    @ApiProperty({ description: 'Learners included after empty-row filtering' })
    learnerCount: number;

    @ApiProperty({ type: [AdminLearnerAttemptsBreakdownDto] })
    learners: AdminLearnerAttemptsBreakdownDto[];
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

    /**
     * Present when the tests-not-completed section is selected.
     * Always month-scoped via `filters.yearMonth` (defaults to the current UTC month).
     */
    @ApiPropertyOptional({ type: AdminTestsNotCompletedReportDto })
    testsNotCompleted?: AdminTestsNotCompletedReportDto;

    /**
     * Present when the test-attempts-results-breakdown section is selected.
     * Grouped by learner then by test; only learners with at least one
     * non-voided attempt or result in the reporting window are included.
     */
    @ApiPropertyOptional({ type: AdminAttemptsResultsBreakdownReportDto })
    attemptsResultsBreakdown?: AdminAttemptsResultsBreakdownReportDto;

    @ApiProperty()
    generatedAt: Date;

    @ApiProperty()
    timeframe: AdminReportTimeframe;
}
