import { LearnerRankingStats } from '../types/learner-ranking-stats.type';

/**
 * Canonical ranking order, shared by every leaderboard and performer list.
 *
 * Weighted ranking score first, then raw engagement (`testsCompleted`), then
 * knowledge (`averageScore`). Callers append a stable name tiebreak so equal
 * standings do not reshuffle between requests.
 */
export function compareLearnerRankingStats(
    left: LearnerRankingStats,
    right: LearnerRankingStats,
): number {
    return (
        right.rankingScore - left.rankingScore ||
        right.testsCompleted - left.testsCompleted ||
        right.averageScore - left.averageScore
    );
}
