import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Result } from '../results/entities/result.entity';
import { TrainingSession } from '../training-hours/entities/training-session.entity';
import { Branch } from '../branch/entities/branch.entity';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
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
            .select(['branch.id', 'branch.name']);

        if (branchId) {
            branchQuery.andWhere('branch.id = :branchId', { branchId });
        }

        const branches = await branchQuery.getMany();

        const summaries = new Map<string, BranchAnalyticsSummaryDto>();
        branches.forEach(branch => {
            summaries.set(branch.id, {
                branchId: branch.id,
                branchName: branch.name,
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
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .groupBy('branch.id')
            .addGroupBy('branch.name')
            .getRawMany<{
                branchId: string;
                branchName: string;
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

    /** Top or bottom learners by average score for a month (optionally per branch). */
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
        const order = params.order === 'asc' ? 'ASC' : 'DESC';
        const limit = Math.min(Math.max(params.limit ?? 5, 1), 50);

        const query = this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.user', 'user')
            .leftJoin('user.branchId', 'userBranch')
            .leftJoin('result.orgId', 'org')
            .leftJoin('result.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('result.calculatedAt >= :monthStart', {
                monthStart: window.monthStart,
            })
            .andWhere('result.calculatedAt < :monthEnd', {
                monthEnd: window.monthEnd,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('MAX(userBranch.name)', 'branchName')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .having('COUNT(result.resultId) >= 1')
            .orderBy('averageScore', order)
            .limit(limit);

        if (params.branchId) {
            query.andWhere('branch.id = :branchId', {
                branchId: params.branchId,
            });
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            averageScore: string;
            resultsCount: string;
            passedCount: string;
        }>();

        return rows.map(row => {
            const resultsCount = Number(row.resultsCount) || 0;
            const passedCount = Number(row.passedCount) || 0;
            return {
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                branchName: row.branchName ?? null,
                averageScore: this.round(Number(row.averageScore) || 0),
                passRate:
                    resultsCount > 0
                        ? this.round((passedCount / resultsCount) * 100)
                        : 0,
                resultsCount,
            };
        });
    }

    /** Ensures a branch entry exists in the accumulator map. */
    private ensureBranchEntry(
        summaries: Map<string, BranchAnalyticsSummaryDto>,
        branchId: string,
        branchName?: string,
    ): BranchAnalyticsSummaryDto {
        const existing = summaries.get(branchId);
        if (existing) {
            if (branchName && !existing.branchName) {
                existing.branchName = branchName;
            }
            return existing;
        }

        const created: BranchAnalyticsSummaryDto = {
            branchId,
            branchName: branchName ?? 'Unknown branch',
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
