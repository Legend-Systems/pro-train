/**
 * A test that may contribute to rankings.
 *
 * Eligibility is deliberately strict: the test must be active and its exam
 * window must have fully elapsed. Tests that are still open (or have not
 * opened) are excluded so learners are never ranked on training they have not
 * yet had a fair chance to complete.
 */
export interface EligibleTest {
    readonly testId: number;
    readonly testTitle: string;
    readonly courseId: number | null;
    readonly courseTitle: string | null;
    /** Branch the test is restricted to, if any. */
    readonly testBranchId: string | null;
    /** Branch the parent course is restricted to, if any. */
    readonly courseBranchId: string | null;
    readonly examStartDate: Date;
    readonly examEndDate: Date;
}
