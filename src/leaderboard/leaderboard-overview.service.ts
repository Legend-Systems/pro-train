import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Leaderboard } from './entities/leaderboard.entity';
import { Result } from '../results/entities/result.entity';
import { UserRole } from '../user/entities/user.entity';
import type { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import {
    LeaderboardImproverDto,
    LeaderboardOverviewEntryDto,
    LeaderboardOverviewPeriod,
    LeaderboardOverviewQueryDto,
    LeaderboardOverviewResponseDto,
    LeaderboardSummaryDto,
} from './dto/leaderboard-overview.dto';

const IMPROVER_LIMIT = 5;
const ACTIVE_DAYS = 30;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Roles allowed to see underperforming "needs support" leaderboard data. */
const LEADERBOARD_ADMIN_ROLES: UserRole[] = [
    UserRole.MASTER_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
];

function canViewNeedsSupport(userRole?: string): boolean {
    return (
        userRole != null &&
        LEADERBOARD_ADMIN_ROLES.includes(userRole as UserRole)
    );
}

interface AggregatedUserStats {
    userId: string;
    firstName: string;
    lastName: string;
    email?: string;
    profilePicture?: string | null;
    branchName?: string | null;
    totalPoints: number;
    averageScore: number;
    testsCompleted: number;
    courseId?: number | null;
    courseTitle?: string | null;
}

/**
 * Org/course leaderboard rankings with period filters, summary insights,
 * and month-over-month improvers. Month views aggregate from results;
 * all-time views aggregate from the leaderboards table.
 */
@Injectable()
export class LeaderboardOverviewService {
    constructor(
        @InjectRepository(Leaderboard)
        private readonly leaderboardRepository: Repository<Leaderboard>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
    ) {}

    async getOverview(
        scope: OrgBranchScope,
        query: LeaderboardOverviewQueryDto = {},
    ): Promise<LeaderboardOverviewResponseDto> {
        try {
            if (!scope.orgId) {
                throw new BadRequestException('orgId is required');
            }

            const page = query.page ?? DEFAULT_PAGE;
            const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
            const period = query.period ?? LeaderboardOverviewPeriod.MONTH;
            const month =
                period === LeaderboardOverviewPeriod.MONTH
                    ? query.month || this.currentYearMonthUtc()
                    : undefined;
            const branchId = query.branchId || scope.branchId;

            const currentStats = await this.loadAggregatedStats({
                orgId: scope.orgId,
                branchId,
                courseId: query.courseId,
                period,
                month,
                search: query.search,
                activeOnly: query.activeOnly,
            });

            let previousByUser = new Map<string, AggregatedUserStats>();
            if (period === LeaderboardOverviewPeriod.MONTH && month) {
                const previousMonth = this.previousYearMonth(month);
                const previousStats = await this.loadAggregatedStats({
                    orgId: scope.orgId,
                    branchId,
                    courseId: query.courseId,
                    period: LeaderboardOverviewPeriod.MONTH,
                    month: previousMonth,
                    search: undefined,
                    activeOnly: false,
                });
                previousByUser = new Map(
                    previousStats.map(entry => [entry.userId, entry]),
                );
            }

            const ranked = this.rankUsers(currentStats, previousByUser);
            const summary = this.buildSummary(ranked, scope.userId);
            const { topImprovers, needsSupport } =
                period === LeaderboardOverviewPeriod.MONTH
                    ? this.buildImprovers(ranked)
                    : { topImprovers: [], needsSupport: [] };

            // Hide underperforming users from generic learners — admin-only coaching insight
            const sanitizedNeedsSupport = canViewNeedsSupport(scope.userRole)
                ? needsSupport
                : [];

            const skip = (page - 1) * limit;
            const pageEntries = ranked.slice(skip, skip + limit);

            return {
                entries: pageEntries,
                leaderboard: pageEntries,
                total: ranked.length,
                page,
                limit,
                period,
                month,
                courseId: query.courseId,
                summary,
                topImprovers,
                needsSupport: sanitizedNeedsSupport,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException(
                `Failed to fetch leaderboard overview: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`,
            );
        }
    }

    private async loadAggregatedStats(options: {
        orgId: string;
        branchId?: string;
        courseId?: number;
        period: LeaderboardOverviewPeriod;
        month?: string;
        search?: string;
        activeOnly?: boolean;
    }): Promise<AggregatedUserStats[]> {
        if (options.period === LeaderboardOverviewPeriod.MONTH) {
            return this.loadMonthlyFromResults(options);
        }
        return this.loadAllTimeFromLeaderboards(options);
    }

    private async loadAllTimeFromLeaderboards(options: {
        orgId: string;
        branchId?: string;
        courseId?: number;
        search?: string;
        activeOnly?: boolean;
    }): Promise<AggregatedUserStats[]> {
        const qb = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.user', 'user')
            .leftJoin('user.avatar', 'avatar')
            .leftJoin('user.branchId', 'userBranch')
            .leftJoin('l.branchId', 'branch')
            .leftJoin('l.course', 'course')
            .leftJoin('l.orgId', 'org')
            .where('org.id = :orgId', { orgId: options.orgId })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('user.email', 'email')
            .addSelect('MAX(avatar.url)', 'profilePicture')
            .addSelect(
                'MAX(COALESCE(branch.name, userBranch.name))',
                'branchName',
            )
            .addSelect('SUM(l.totalPoints)', 'totalPoints')
            .addSelect('AVG(l.averageScore)', 'averageScore')
            .addSelect('SUM(l.testsCompleted)', 'testsCompleted')
            .addSelect('MAX(course.courseId)', 'courseId')
            .addSelect('MAX(course.title)', 'courseTitle')
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .addGroupBy('user.email');

        if (options.courseId) {
            qb.andWhere('l.courseId = :courseId', {
                courseId: options.courseId,
            });
        }

        if (options.branchId) {
            qb.andWhere(
                '(branch.id = :branchId OR userBranch.id = :branchId)',
                { branchId: options.branchId },
            );
        }

        if (options.search?.trim()) {
            const term = `%${options.search.trim().toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term)',
                { term },
            );
        }

        if (options.activeOnly) {
            const cutoff = new Date();
            cutoff.setUTCDate(cutoff.getUTCDate() - ACTIVE_DAYS);
            qb.andWhere('l.lastUpdated >= :cutoff', { cutoff });
        }

        const rows = await qb.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            email: string;
            profilePicture: string | null;
            branchName: string | null;
            totalPoints: string;
            averageScore: string;
            testsCompleted: string;
            courseId: string | null;
            courseTitle: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            email: row.email,
            profilePicture: row.profilePicture,
            branchName: row.branchName,
            totalPoints: this.round(Number(row.totalPoints) || 0),
            averageScore: this.round(Number(row.averageScore) || 0),
            testsCompleted: Number(row.testsCompleted) || 0,
            courseId: row.courseId ? Number(row.courseId) : null,
            courseTitle: row.courseTitle,
        }));
    }

    private async loadMonthlyFromResults(options: {
        orgId: string;
        branchId?: string;
        courseId?: number;
        month?: string;
        search?: string;
        activeOnly?: boolean;
    }): Promise<AggregatedUserStats[]> {
        if (!options.month) {
            throw new BadRequestException('month is required for period=month');
        }

        const { start, end } = this.getMonthBounds(options.month);
        const qb = this.buildScopedResultsQuery(options.orgId, options.branchId)
            .innerJoin('result.user', 'user')
            .leftJoin('user.avatar', 'avatar')
            .leftJoin('user.branchId', 'userBranch')
            .leftJoin('result.course', 'course')
            .andWhere('result.createdAt >= :start', { start })
            .andWhere('result.createdAt < :end', { end })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('user.email', 'email')
            .addSelect('MAX(avatar.url)', 'profilePicture')
            .addSelect('MAX(userBranch.name)', 'branchName')
            .addSelect('SUM(result.score)', 'totalPoints')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'testsCompleted')
            .addSelect('MAX(course.courseId)', 'courseId')
            .addSelect('MAX(course.title)', 'courseTitle')
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .addGroupBy('user.email');

        if (options.courseId) {
            qb.andWhere('result.courseId = :courseId', {
                courseId: options.courseId,
            });
        }

        if (options.search?.trim()) {
            const term = `%${options.search.trim().toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term)',
                { term },
            );
        }

        if (options.activeOnly) {
            const cutoff = new Date();
            cutoff.setUTCDate(cutoff.getUTCDate() - ACTIVE_DAYS);
            qb.andHaving('MAX(result.createdAt) >= :cutoff', { cutoff });
        }

        const rows = await qb.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            email: string;
            profilePicture: string | null;
            branchName: string | null;
            totalPoints: string;
            averageScore: string;
            testsCompleted: string;
            courseId: string | null;
            courseTitle: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            email: row.email,
            profilePicture: row.profilePicture,
            branchName: row.branchName,
            totalPoints: this.round(Number(row.totalPoints) || 0),
            averageScore: this.round(Number(row.averageScore) || 0),
            testsCompleted: Number(row.testsCompleted) || 0,
            courseId: row.courseId ? Number(row.courseId) : null,
            courseTitle: row.courseTitle,
        }));
    }

    private buildScopedResultsQuery(
        orgId: string,
        branchId?: string,
    ): SelectQueryBuilder<Result> {
        const query = this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .where('org.id = :orgId', { orgId });

        if (branchId) {
            query
                .leftJoin('result.branchId', 'filterBranch')
                .andWhere('filterBranch.id = :branchId', { branchId });
        }

        return query;
    }

    private rankUsers(
        current: AggregatedUserStats[],
        previousByUser: Map<string, AggregatedUserStats>,
    ): LeaderboardOverviewEntryDto[] {
        const sorted = [...current].sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) {
                return b.totalPoints - a.totalPoints;
            }
            return b.averageScore - a.averageScore;
        });

        const previousRanked = [...previousByUser.values()].sort((a, b) => {
            if (b.totalPoints !== a.totalPoints) {
                return b.totalPoints - a.totalPoints;
            }
            return b.averageScore - a.averageScore;
        });
        const previousRankMap = new Map(
            previousRanked.map((entry, index) => [entry.userId, index + 1]),
        );

        const total = sorted.length;

        return sorted.map((entry, index) => {
            const rank = index + 1;
            const previous = previousByUser.get(entry.userId);
            const previousPoints = previous?.totalPoints ?? null;
            const previousRank = previousRankMap.get(entry.userId) ?? null;
            const pointsDelta =
                previousPoints !== null
                    ? this.round(entry.totalPoints - previousPoints)
                    : null;
            const rankChange =
                previousRank !== null ? previousRank - rank : null;
            const percentileRank =
                total > 0
                    ? Math.round(((total - rank + 1) / total) * 100)
                    : 0;

            return {
                userId: entry.userId,
                rank,
                firstName: entry.firstName,
                lastName: entry.lastName,
                email: entry.email,
                profilePicture: entry.profilePicture,
                branchName: entry.branchName,
                totalPoints: entry.totalPoints,
                averageScore: entry.averageScore,
                testsCompleted: entry.testsCompleted,
                letterGrade: this.calculateLetterGrade(entry.averageScore),
                achievementLevel: this.getAchievementLevel(entry.averageScore),
                previousPoints,
                pointsDelta,
                previousRank,
                rankChange,
                percentileRank,
                consistencyRating: this.estimateConsistency(
                    entry.averageScore,
                    entry.testsCompleted,
                ),
                badges: this.calculateBadges(rank, entry.averageScore),
                courseId: entry.courseId,
                courseTitle: entry.courseTitle,
            };
        });
    }

    private buildSummary(
        ranked: LeaderboardOverviewEntryDto[],
        currentUserId: string,
    ): LeaderboardSummaryDto {
        if (ranked.length === 0) {
            return {
                totalParticipants: 0,
                averagePoints: 0,
                highestScore: 0,
                averageScore: 0,
                yourRank: null,
                yourPoints: null,
                yourPointsDelta: null,
            };
        }

        const totalPoints = ranked.reduce(
            (sum, entry) => sum + entry.totalPoints,
            0,
        );
        const totalAvg = ranked.reduce(
            (sum, entry) => sum + entry.averageScore,
            0,
        );
        const you = ranked.find(entry => entry.userId === currentUserId);

        return {
            totalParticipants: ranked.length,
            averagePoints: this.round(totalPoints / ranked.length),
            highestScore: ranked[0]?.totalPoints ?? 0,
            averageScore: this.round(totalAvg / ranked.length),
            yourRank: you?.rank ?? null,
            yourPoints: you?.totalPoints ?? null,
            yourPointsDelta: you?.pointsDelta ?? null,
        };
    }

    private buildImprovers(ranked: LeaderboardOverviewEntryDto[]): {
        topImprovers: LeaderboardImproverDto[];
        needsSupport: LeaderboardImproverDto[];
    } {
        const withDelta = ranked.filter(
            entry => entry.pointsDelta !== null && entry.pointsDelta !== undefined,
        );

        const toImprover = (
            entry: LeaderboardOverviewEntryDto,
        ): LeaderboardImproverDto => ({
            userId: entry.userId,
            firstName: entry.firstName,
            lastName: entry.lastName,
            branchName: entry.branchName,
            currentRank: entry.rank,
            previousRank: entry.previousRank ?? null,
            currentPoints: entry.totalPoints,
            previousPoints: entry.previousPoints ?? null,
            pointsDelta: entry.pointsDelta ?? 0,
        });

        const topImprovers = [...withDelta]
            .sort((a, b) => (b.pointsDelta ?? 0) - (a.pointsDelta ?? 0))
            .filter(entry => (entry.pointsDelta ?? 0) > 0)
            .slice(0, IMPROVER_LIMIT)
            .map(toImprover);

        const needsSupport = [...withDelta]
            .sort((a, b) => (a.pointsDelta ?? 0) - (b.pointsDelta ?? 0))
            .filter(entry => (entry.pointsDelta ?? 0) < 0)
            .slice(0, IMPROVER_LIMIT)
            .map(toImprover);

        return { topImprovers, needsSupport };
    }

    private calculateBadges(rank: number, averageScore: number): string[] {
        const badges: string[] = [];
        if (rank === 1) badges.push('champion');
        if (rank <= 3) badges.push('top_performer');
        if (averageScore >= 95) badges.push('high_scorer');
        if (averageScore >= 85) badges.push('consistent_performer');
        return badges;
    }

    private estimateConsistency(
        averageScore: number,
        testsCompleted: number,
    ): number {
        if (testsCompleted < 2) return 3;
        if (averageScore >= 90) return 5;
        if (averageScore >= 80) return 4;
        if (averageScore >= 70) return 3;
        if (averageScore >= 60) return 2;
        return 1;
    }

    private getAchievementLevel(score: number): string {
        if (score >= 90) return 'expert';
        if (score >= 80) return 'advanced';
        if (score >= 70) return 'intermediate';
        return 'beginner';
    }

    private calculateLetterGrade(percentage: number): string {
        if (percentage >= 97) return 'A+';
        if (percentage >= 93) return 'A';
        if (percentage >= 90) return 'A-';
        if (percentage >= 87) return 'B+';
        if (percentage >= 83) return 'B';
        if (percentage >= 80) return 'B-';
        if (percentage >= 77) return 'C+';
        if (percentage >= 73) return 'C';
        if (percentage >= 70) return 'C-';
        if (percentage >= 67) return 'D+';
        if (percentage >= 63) return 'D';
        if (percentage >= 60) return 'D-';
        return 'F';
    }

    private currentYearMonthUtc(): string {
        const now = new Date();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        return `${now.getUTCFullYear()}-${month}`;
    }

    private previousYearMonth(yearMonth: string): string {
        const [year, month] = yearMonth.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 2, 1));
        return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    }

    private getMonthBounds(yearMonth: string): { start: Date; end: Date } {
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
            throw new BadRequestException('month must be in YYYY-MM format');
        }
        const [year, month] = yearMonth.split('-').map(Number);
        if (month < 1 || month > 12) {
            throw new BadRequestException('month must be between 01 and 12');
        }
        return {
            start: new Date(Date.UTC(year, month - 1, 1)),
            end: new Date(Date.UTC(year, month, 1)),
        };
    }

    private round(value: number): number {
        return Math.round(value * 100) / 100;
    }
}
