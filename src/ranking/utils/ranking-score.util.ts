import { RANKING_WEIGHTS } from '../constants/ranking-weights.constant';

/** Decimal places kept on the ranking score so ties stay meaningful. */
const SCORE_PRECISION = 100;

/** Participation expressed on the same 0–100 scale as the average score. */
const PARTICIPATION_SCALE = 100;

interface RankingScoreInput {
    /** Mean percentage across completed eligible tests (0–100). */
    readonly averageScore: number;
    /** Share of expected eligible tests completed (0–1). */
    readonly participationRate: number;
}

/**
 * Blends knowledge (average score) with engagement (participation rate).
 *
 * A learner who aces their only test scores 0.6 × 100 = 60, while a learner
 * averaging 96% across seven of eight tests scores 0.6 × 96 + 0.4 × 87.5 ≈ 93,
 * so broad participation can no longer be out-ranked by cherry-picking.
 */
export function calculateRankingScore({
    averageScore,
    participationRate,
}: RankingScoreInput): number {
    const weighted =
        averageScore * RANKING_WEIGHTS.averageScore +
        participationRate * PARTICIPATION_SCALE * RANKING_WEIGHTS.participation;

    return Math.round(weighted * SCORE_PRECISION) / SCORE_PRECISION;
}
