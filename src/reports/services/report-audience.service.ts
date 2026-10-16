import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import { User } from '../../user/entities/user.entity';
import {
    REPORT_EXCLUDED_ROLES,
    REPORT_LISTED_EMAILS,
} from '../constants/report-user-exclusions.constant';
import { excludeReportUserIds } from '../utils/exclude-report-user-ids.util';
import { shouldExcludeUserFromReport } from '../utils/should-exclude-user-from-report.util';

/** How long a resolved exclusion list can be reused for one organization. */
const EXCLUSION_CACHE_TTL_MS = 60_000;

interface ExclusionCacheEntry {
    readonly expiresAt: number;
    readonly userIds: readonly string[];
}

interface ExclusionCandidateRow {
    readonly id: string;
    readonly email: string | null;
    readonly role: string | null;
    readonly orgId: string | null;
}

/**
 * Resolves the users who must be omitted from a report, then applies that
 * set to query builders. Missing markdown addresses are skipped because
 * they have no row to select.
 */
@Injectable()
export class ReportAudienceService {
    private readonly cache = new Map<string, ExclusionCacheEntry>();

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    /**
     * User ids to remove from a report.
     * Pass the report organization so cross-organization accounts can stay
     * in their own organization. Pass null for an unscoped report.
     */
    async getExcludedUserIds(
        reportOrgId: string | null,
    ): Promise<readonly string[]> {
        const cacheKey = reportOrgId ?? '';
        const cached = this.cache.get(cacheKey);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.userIds;
        }

        const userIds = await this.loadExcludedUserIds(reportOrgId);
        this.cache.set(cacheKey, {
            expiresAt: now + EXCLUSION_CACHE_TTL_MS,
            userIds,
        });
        return userIds;
    }

    /**
     * Adds `userId NOT IN (...)` for the excluded audience.
     * Returns the same query so callers can keep chaining.
     */
    async omitFromQuery<Entity extends ObjectLiteral>(
        query: SelectQueryBuilder<Entity>,
        userIdExpression: string,
        reportOrgId: string | null,
    ): Promise<SelectQueryBuilder<Entity>> {
        const excludedUserIds = await this.getExcludedUserIds(reportOrgId);
        return excludeReportUserIds(query, userIdExpression, excludedUserIds);
    }

    private async loadExcludedUserIds(
        reportOrgId: string | null,
    ): Promise<readonly string[]> {
        const rows = await this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .where('user.role IN (:...reportExcludedRoles)', {
                reportExcludedRoles: [...REPORT_EXCLUDED_ROLES],
            })
            .orWhere('LOWER(user.email) IN (:...reportListedEmails)', {
                reportListedEmails: [...REPORT_LISTED_EMAILS],
            })
            .select('user.id', 'id')
            .addSelect('user.email', 'email')
            .addSelect('user.role', 'role')
            .addSelect('org.id', 'orgId')
            .getRawMany<ExclusionCandidateRow>();

        return rows
            .filter(row =>
                shouldExcludeUserFromReport({
                    email: row.email,
                    role: row.role,
                    userOrgId: row.orgId,
                    reportOrgId,
                }),
            )
            .map(row => row.id);
    }
}
