import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/**
 * Drops rows whose user id is in the excluded set.
 * An empty set leaves the query unchanged so MySQL never sees `NOT IN ()`.
 */
export function excludeReportUserIds<Entity extends ObjectLiteral>(
    query: SelectQueryBuilder<Entity>,
    userIdExpression: string,
    excludedUserIds: readonly string[],
): SelectQueryBuilder<Entity> {
    if (excludedUserIds.length === 0) {
        return query;
    }

    const parameterName = `excludedReportUserIds_${userIdExpression.replace(
        /[^A-Za-z0-9]/g,
        '_',
    )}`;

    query.andWhere(`${userIdExpression} NOT IN (:...${parameterName})`, {
        [parameterName]: [...excludedUserIds],
    });

    return query;
}
