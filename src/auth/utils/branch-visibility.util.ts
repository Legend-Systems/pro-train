import { SelectQueryBuilder } from 'typeorm';

/**
 * Method 1 — organization-wide content via NULL branchId.
 *
 * Courses, tests, and questions with branchId = NULL are shared across every
 * branch within the same organization. Branch-scoped users must see content
 * tagged to their branch OR org-wide (NULL) rows.
 */

/**
 * Restricts a TypeORM query so branch-scoped callers see their branch plus
 * org-wide (NULL branchId) entities.
 *
 * @param query - Active query builder.
 * @param alias - Entity alias used in the query (e.g. `course`, `test`).
 * @param userBranchId - Branch id from the caller JWT; skipped when absent.
 * @param paramPrefix - Prefix for generated parameter names to avoid collisions.
 */
export function applyBranchVisibilityToQuery<T extends object>(
    query: SelectQueryBuilder<T>,
    alias: string,
    userBranchId?: string,
    paramPrefix = 'branchVis',
): void {
    if (!userBranchId) {
        return;
    }

    const branchParam = `${paramPrefix}UserBranchId`;
    query.andWhere(
        `(${alias}.branchId = :${branchParam} OR ${alias}.branchId IS NULL)`,
        { [branchParam]: userBranchId },
    );
}

/**
 * Returns whether a branch-scoped user may read content owned by entityBranchId.
 * NULL entity branch means org-wide and is always allowed within the org.
 */
export function canAccessBranchScopedContent(
    entityBranchId: string | null | undefined,
    userBranchId?: string,
): boolean {
    if (!userBranchId) {
        return true;
    }

    if (entityBranchId == null) {
        return true;
    }

    return entityBranchId === userBranchId;
}
