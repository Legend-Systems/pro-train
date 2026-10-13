/**
 * Participation-aware ranking metrics for a single learner over a set of
 * eligible tests. Every leaderboard, top-performer widget, and report derives
 * its ordering from these numbers.
 */
export interface LearnerRankingStats {
    readonly userId: string;
    /** Eligible tests expected of this learner (branch-scoped denominator). */
    readonly totalEligibleTests: number;
    /** Eligible tests with a graded result on the learner's latest attempt. */
    readonly testsCompleted: number;
    /** Completed eligible tests the learner passed. */
    readonly testsPassed: number;
    /** Mean latest-attempt percentage across completed eligible tests (0–100). */
    readonly averageScore: number;
    /** `testsCompleted / totalEligibleTests`, 0–1. */
    readonly participationRate: number;
    /** Weighted score that drives the ordering (0–100). */
    readonly rankingScore: number;
    /** Sum of raw scores on the counted results. */
    readonly totalPoints: number;
    readonly completedTestIds: readonly number[];
    readonly missedTestIds: readonly number[];
}
