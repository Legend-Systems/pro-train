import { EligibleTest } from '../types/eligible-test.type';

/**
 * Branch-scoped tests only count towards learners in that branch, so the
 * participation denominator stays fair across offices. A test (or its course)
 * with no branch is organization-wide and expected of everyone.
 */
export function isTestExpectedForLearner(
    test: EligibleTest,
    learnerBranchId: string | null,
): boolean {
    const requiredBranchId = test.testBranchId ?? test.courseBranchId;
    if (!requiredBranchId) {
        return true;
    }

    return learnerBranchId === requiredBranchId;
}
