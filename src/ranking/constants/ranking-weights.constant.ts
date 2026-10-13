/**
 * Weighting used by every leaderboard / top-performer ranking in the platform.
 *
 * Ranking a learner purely on the average of the tests they happened to sit
 * rewarded avoidance: one perfect score beat seven strong scores. The ranking
 * score therefore blends how well a learner scored with how much of the
 * expected training they actually completed:
 *
 *   rankingScore = (averageScore × 0.6) + (participationRate × 100 × 0.4)
 *
 * Both terms are expressed on a 0–100 scale so the result is also 0–100.
 */
export const RANKING_WEIGHTS = {
    /** Weight applied to the average percentage across completed tests. */
    averageScore: 0.6,
    /** Weight applied to the share of expected tests actually completed. */
    participation: 0.4,
} as const;
