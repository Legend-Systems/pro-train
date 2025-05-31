import { Injectable } from '@nestjs/common';
import {
    FindManyOptions,
    FindOneOptions,
    Repository,
    ObjectLiteral,
    DeepPartial,
} from 'typeorm';

export interface ScopeOptions {
    orgId?: string;
    branchId?: string;
    includeGlobal?: boolean; // Include records without org/branch restrictions
}

@Injectable()
export class OrgBranchScopingService {
    /**
     * Apply org and branch scoping to a find query
     */
    applyScopeToFindOptions<T extends ObjectLiteral>(
        options: FindManyOptions<T> = {},
        scope: ScopeOptions,
    ): FindManyOptions<T> {
        const whereClause = this.buildScopeWhereClause(scope);

        if (Object.keys(whereClause).length === 0) {
            return options;
        }

        return {
            ...options,
            where: options.where
                ? Array.isArray(options.where)
                    ? options.where.map(w => ({ ...w, ...whereClause }))
                    : { ...options.where, ...whereClause }
                : whereClause,
        };
    }

    /**
     * Apply org and branch scoping to a find one query
     */
    applyScopeToFindOneOptions<T extends ObjectLiteral>(
        options: FindOneOptions<T> = {},
        scope: ScopeOptions,
    ): FindOneOptions<T> {
        const whereClause = this.buildScopeWhereClause(scope);

        if (Object.keys(whereClause).length === 0) {
            return options;
        }

        return {
            ...options,
            where: options.where
                ? Array.isArray(options.where)
                    ? options.where.map(w => ({ ...w, ...whereClause }))
                    : { ...options.where, ...whereClause }
                : whereClause,
        };
    }

    /**
     * Apply org and branch scoping to a query builder
     */
    applyScopeToQueryBuilder(
        queryBuilder: any,
        scope: ScopeOptions,
        entityAlias: string = 'entity',
    ): any {
        if (scope.orgId) {
            if (scope.includeGlobal) {
                queryBuilder.andWhere(
                    `(${entityAlias}.orgId IS NULL OR ${entityAlias}.orgId = :orgId)`,
                    { orgId: scope.orgId },
                );
            } else {
                queryBuilder.andWhere(`${entityAlias}.orgId = :orgId`, {
                    orgId: scope.orgId,
                });
            }
        }

        if (scope.branchId) {
            if (scope.includeGlobal) {
                queryBuilder.andWhere(
                    `(${entityAlias}.branchId IS NULL OR ${entityAlias}.branchId = :branchId)`,
                    { branchId: scope.branchId },
                );
            } else {
                queryBuilder.andWhere(`${entityAlias}.branchId = :branchId`, {
                    branchId: scope.branchId,
                });
            }
        }

        return queryBuilder;
    }

    /**
     * Create a scoped repository with pre-applied org/branch filtering
     */
    createScopedRepository<T extends ObjectLiteral>(
        repository: Repository<T>,
        scope: ScopeOptions,
    ): ScopedRepository<T> {
        return new ScopedRepository(repository, scope, this);
    }

    /**
     * Build where clause for org/branch scoping
     */
    private buildScopeWhereClause(scope: ScopeOptions): Record<string, any> {
        const whereClause: Record<string, any> = {};

        if (scope.orgId) {
            if (scope.includeGlobal) {
                // This would need to be handled in query builder for complex OR conditions
                // For simple find operations, we'll apply strict scoping
                whereClause.orgId = { id: scope.orgId };
            } else {
                whereClause.orgId = { id: scope.orgId };
            }
        }

        if (scope.branchId) {
            if (scope.includeGlobal) {
                // This would need to be handled in query builder for complex OR conditions
                whereClause.branchId = { id: scope.branchId };
            } else {
                whereClause.branchId = { id: scope.branchId };
            }
        }

        return whereClause;
    }
}

/**
 * Scoped repository wrapper that automatically applies org/branch filtering
 */
export class ScopedRepository<T extends ObjectLiteral> {
    constructor(
        private readonly repository: Repository<T>,
        private readonly scope: ScopeOptions,
        private readonly scopingService: OrgBranchScopingService,
    ) {}

    async find(options?: FindManyOptions<T>): Promise<T[]> {
        const scopedOptions = this.scopingService.applyScopeToFindOptions(
            options,
            this.scope,
        );
        return this.repository.find(scopedOptions);
    }

    async findOne(options?: FindOneOptions<T>): Promise<T | null> {
        const scopedOptions = this.scopingService.applyScopeToFindOneOptions(
            options,
            this.scope,
        );
        return this.repository.findOne(scopedOptions);
    }

    async findById(id: string): Promise<T | null> {
        return this.findOne({ where: { id } as any });
    }

    async count(options?: FindManyOptions<T>): Promise<number> {
        const scopedOptions = this.scopingService.applyScopeToFindOptions(
            options,
            this.scope,
        );
        return this.repository.count(scopedOptions);
    }

    createQueryBuilder(alias?: string): any {
        const queryBuilder = this.repository.createQueryBuilder(alias);
        return this.scopingService.applyScopeToQueryBuilder(
            queryBuilder,
            this.scope,
            alias,
        );
    }

    // Passthrough methods that don't need scoping
    async save(entity: any): Promise<T> {
        return this.repository.save(entity);
    }

    async remove(entity: T): Promise<T> {
        return this.repository.remove(entity);
    }

    async delete(criteria: any): Promise<any> {
        return this.repository.delete(criteria);
    }

    async update(criteria: any, partialEntity: any): Promise<any> {
        return this.repository.update(criteria, partialEntity);
    }

    create(entityLike: DeepPartial<T>): T {
        return this.repository.create(entityLike);
    }
}
