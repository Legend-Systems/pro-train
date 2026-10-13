import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Result } from '../results/entities/result.entity';
import { TrainingSession } from '../training-hours/entities/training-session.entity';
import { Branch } from '../branch/entities/branch.entity';
import {
    LEARNER_USER_ROLES,
    User,
    UserStatus,
} from '../user/entities/user.entity';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { EligibleTestService } from '../ranking/services/eligible-test.service';
import { LearnerRankingService } from '../ranking/services/learner-ranking.service';
import type { LearnerRankingStats } from '../ranking/types/learner-ranking-stats.type';
import { compareLearnerRankingStats } from '../ranking/utils/ranking-comparator.util';
import {
    BranchAnalyticsSummaryDto,
    BranchPerformerDto,
} from './dto/branch-analytics.dto';

/** Sort direction for ranked analytics queries. */
export type AnalyticsSortOrder = 'asc' | 'desc';

/** Minutes contained in one hour, used for hour display conversion. */
const MINUTES_PER_HOUR = 60;

/** UTC month boundaries derived from a YYYY-MM string. */
interface MonthWindow {
    monthStart: Date;
    monthEnd: Date;
    monthStartDate: string;
    monthEndDate: string;
}

/** Bounds on how many performers one ranked analytics call may return. */
const MIN_PERFORMER_LIMIT = 1;
const MAX_PERFORMER_LIMIT = 50;
const DEFAULT_PERFORMER_LIMIT = 5;

/** A ranking-population member with the fields needed for display. */
interface PerformerRosterEntry {
    readonly userId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly branchId: string | null;
    readonly branchName: string | null;
}

/** A roster entry paired with its computed ranking statistics. */
interface RankedPerformer {
    readonly learner: PerformerRosterEntry;
    readonly stats: LearnerRankingStats;
}

/**
 * Org-scoped, branch-grouped analytics for Owner / Master Admin dashboards.
 * All queries are constrained to the caller's organization for tenant safety
 * and intentionally ignore any single-branch JWT scope so owners see every branch.
 */
@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(TrainingSession)
        private readonly sessionRepository: Repository<TrainingSession>,
        @InjectRepository(Branch)
        private readonly branchRepository: Repository<Branch>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly eligibleTestService: EligibleTestService,
        private readonly learnerRankingService: LearnerRankingService,
    ) {}

    /** Per-branch knowledge score, pass rate and training hours for a month. */
    async getBranchSummary(
        scope: OrgBranchScope,
        yearMonth: string,
        branchId?: string,
    ): Promise<BranchAnalyticsSummaryDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.getMonthWindow(yearMonth);

        const branchQuery = this.branchRepository
            .createQueryBuilder('branch')
            .leftJoin('branch.organization', 'org')
            .where('org.id = :orgId', { orgId })
            .select(['branch.id', 'branch.name', 'branch.alias']);

        if (branchId) {
            branchQuery.andWhere('branch.id = :branchId', { branchId });
        }

        const branches = await branchQuery.getMany();

        const summaries = new Map<string, BranchAnalyticsSummaryDto>();
        branches.forEach(branch => {
            summaries.set(branch.id, {
                branchId: branch.id,
                branchName: branch.name,
                branchAlias: branch.alias?.trim() || null,
                averageScore: 0,
                passRate: 0,
                resultsCount: 0,
                totalMinutes: 0,
                totalHours: 0,
                activeLearners: 0,
            });
        });

        const resultQuery = this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .leftJoin('result.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('branch.id IS NOT NULL')
            .andWhere('result.calculatedAt >= :monthStart', {
                monthStart: window.monthStart,
            })
            .andWhere('result.calculatedAt < :monthEnd', {
                monthEnd: window.monthEnd,
            });

        if (branchId) {
            resultQuery.andWhere('branch.id = :branchId', { branchId });
        }

        const resultRows = await resultQuery
            .select('branch.id', 'branchId')
            .addSelect('branch.name', 'branchName')
            .addSelect('branch.alias', 'branchAlias')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .groupBy('branch.id')
            .addGroupBy('branch.name')
            .addGroupBy('branch.alias')
            .getRawMany<{
                branchId: string;
                branchName: string;
                branchAlias: string | null;
                averageScore: string;
                resultsCount: string;
                passedCount: string;
            }>();

        resultRows.forEach(row => {
            const resultsCount = Number(row.resultsCount) || 0;
            const passedCount = Number(row.passedCount) || 0;
            const entry = this.ensureBranchEntry(
                summaries,
                row.branchId,
                row.branchName,
                row.branchAlias,
            );
            entry.averageScore = this.round(Number(row.averageScore) || 0);
            entry.resultsCount = resultsCount;
            entry.passRate =
                resultsCount > 0
                    ? this.round((passedCount / resultsCount) * 100)
                    : 0;
        });

        const sessionQuery = this.sessionRepository
            .createQueryBuilder('session')
            .where('session.orgId = :orgId', { orgId })
            .andWhere('session.branchId IS NOT NULL')
            .andWhere('session.activityDate >= :monthStartDate', {
                monthStartDate: window.monthStartDate,
            })
            .andWhere('session.activityDate < :monthEndDate', {
                monthEndDate: window.monthEndDate,
            });

        if (branchId) {
            sessionQuery.andWhere('session.branchId = :branchId', { branchId });
        }

        const sessionRows = await sessionQuery
            .select('session.branchId', 'branchId')
            .addSelect('SUM(session.durationMinutes)', 'totalMinutes')
            .addSelect('COUNT(DISTINCT session.userId)', 'activeLearners')
            .groupBy('session.branchId')
            .getRawMany<{
                branchId: string;
                totalMinutes: string;
                activeLearners: string;
            }>();

        sessionRows.forEach(row => {
            const totalMinutes = Number(row.totalMinutes) || 0;
            const entry = this.ensureBranchEntry(summaries, row.branchId);
            entry.totalMinutes = totalMinutes;
            entry.totalHours = this.minutesToHours(totalMinutes);
            entry.activeLearners = Number(row.activeLearners) || 0;
        });

        return Array.from(summaries.values())
            .filter(entry => entry.resultsCount > 0 || entry.totalMinutes > 0)
            .sort((a, b) => b.averageScore - a.averageScore);
    }

    /**
     * Top or bottom learners for a month (optionally per branch), ranked on the
     * shared participation-aware score.
     *
     * The month selects the exam cycles that closed within it (test
     * `examEndDate`), not the dates learners happened to submit, so an early
     * submitter still counts toward the month their test window closed in.
     */
    async getBranchPerformers(
        scope: OrgBranchScope,
        params: {
            yearMonth: string;
            branchId?: string;
            order?: AnalyticsSortOrder;
            limit?: number;
        },
    ): Promise<BranchPerformerDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.getMonthWindow(params.yearMonth);
        const order: AnalyticsSortOrder =
            params.order === 'asc' ? 'asc' : 'desc';
        const limit = Math.min(
            Math.max(
                params.limit ?? DEFAULT_PERFORMER_LIMIT,
                MIN_PERFORMER_LIMIT,
            ),
            MAX_PERFORMER_LIMIT,
        );

        const [roster, eligibleTests] = await Promise.all([
            this.getPerformerRoster(orgId, params.branchId),
            this.eligibleTestService.resolveEligibleTests({
                orgId,
                branchId: params.branchId,
                periodStart: window.monthStart,
                periodEnd: window.monthEnd,
            }),
        ]);

        const statsByUser =
            await this.learnerRankingService.buildLearnerRankingStats({
                orgId,
                branchId: params.branchId,
                eligibleTests,
                learners: roster,
            });

        const ranked = roster
            .map(learner => ({ learner, stats: statsByUser.get(learner.userId) }))
            .filter((entry): entry is RankedPerformer => entry.stats !== undefined)
            .sort(
                (left, right) =>
                    compareLearnerRankingStats(left.stats, right.stats) ||
                    `${left.learner.lastName} ${left.learner.firstName}`.localeCompare(
                        `${right.learner.lastName} ${right.learner.firstName}`,
                    ),
            );

        // Top performers must have actually sat something; the "worst" list
        // deliberately keeps non-participants, since zero participation is the
        // signal a manager needs to act on.
        const candidates =
            order === 'desc'
                ? ranked.filter(entry => entry.stats.testsCompleted > 0)
                : [...ranked].reverse();

        return candidates.slice(0, limit).map(entry => this.toPerformerDto(entry));
    }

    /** Maps ranking statistics onto the analytics performer contract. */
    private toPerformerDto({ learner, stats }: RankedPerformer): BranchPerformerDto {
        return {
            userId: learner.userId,
            firstName: learner.firstName,
            lastName: learner.lastName,
            branchName: learner.branchName,
            averageScore: this.round(stats.averageScore),
            passRate:
                stats.testsCompleted > 0
                    ? this.round((stats.testsPassed / stats.testsCompleted) * 100)
                    : 0,
            resultsCount: stats.testsCompleted,
            totalEligibleTests: stats.totalEligibleTests,
            participationRate: stats.participationRate,
            rankingScore: stats.rankingScore,
        };
    }

    /** Active learners in scope — the ranking population. */
    private async getPerformerRoster(
        orgId: string,
        branchId?: string,
    ): Promise<PerformerRosterEntry[]> {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .leftJoin('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role IN (:...learnerRoles)', {
                learnerRoles: LEARNER_USER_ROLES,
            })
            .andWhere('user.status = :activeStatus', {
                activeStatus: UserStatus.ACTIVE,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('branch.id', 'branchId')
            .addSelect('branch.name', 'branchName');

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string | null;
            lastName: string | null;
            branchId: string | null;
            branchName: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            branchId: row.branchId ?? null,
            branchName: row.branchName ?? null,
        }));
    }

    /** Ensures a branch entry exists in the accumulator map. */
    private ensureBranchEntry(
        summaries: Map<string, BranchAnalyticsSummaryDto>,
        branchId: string,
        branchName?: string,
        branchAlias?: string | null,
    ): BranchAnalyticsSummaryDto {
        const alias = branchAlias?.trim() || null;
        const existing = summaries.get(branchId);
        if (existing) {
            if (branchName && !existing.branchName) {
                existing.branchName = branchName;
            }
            if (alias && !existing.branchAlias) {
                existing.branchAlias = alias;
            }
            return existing;
        }

        const created: BranchAnalyticsSummaryDto = {
            branchId,
            branchName: branchName ?? 'Unknown branch',
            branchAlias: alias,
            averageScore: 0,
            passRate: 0,
            resultsCount: 0,
            totalMinutes: 0,
            totalHours: 0,
            activeLearners: 0,
        };
        summaries.set(branchId, created);
        return created;
    }

    /** Throws when the caller has no organization context. */
    private requireOrg(scope: OrgBranchScope): string {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }
        return scope.orgId;
    }

    /** Rounds a number to one decimal place. */
    private round(value: number): number {
        return Math.round(value * 10) / 10;
    }

    /** Converts stored minutes to hours with one decimal place. */
    private minutesToHours(minutes: number): number {
        return Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;
    }

    /** Builds UTC month boundaries from a YYYY-MM string. */
    private getMonthWindow(yearMonth: string): MonthWindow {
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
            throw new BadRequestException(
                'yearMonth must be in YYYY-MM format',
            );
        }

        const [year, month] = yearMonth.split('-').map(Number);
        if (month < 1 || month > 12) {
            throw new BadRequestException('yearMonth month must be 1-12');
        }

        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 1));
        const pad = (value: number): string => String(value).padStart(2, '0');

        return {
            monthStart,
            monthEnd,
            monthStartDate: `${year}-${pad(month)}-01`,
            monthEndDate: `${monthEnd.getUTCFullYear()}-${pad(
                monthEnd.getUTCMonth() + 1,
            )}-01`,
        };
    }
}
