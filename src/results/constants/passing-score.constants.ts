/**
 * Global test pass mark for ProTrain.
 *
 * Changed from 60% to 80% so learners must score at least 80% for a result
 * to be marked as passed (course completion, XP PASS_TEST, emails, etc.).
 * All pass/fail checks should use these constants — never hard-code the threshold.
 */
export const PASSING_SCORE_PERCENTAGE = 80 as const;

/**
 * Returns true when the percentage meets or exceeds the global pass mark.
 */
export function isPassingPercentage(percentage: number): boolean {
    return percentage >= PASSING_SCORE_PERCENTAGE;
}
