/**
 * Minimal learner identity needed to rank someone.
 *
 * Callers keep their own richer row (avatar, email, branch name) and join it
 * back by `userId`, so the ranking engine stays independent of presentation.
 */
export interface LearnerRankingProfile {
    readonly userId: string;
    /** Branch assignment — decides which branch-scoped tests are expected. */
    readonly branchId: string | null;
}
