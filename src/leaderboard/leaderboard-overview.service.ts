import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result } from '../results/entities/result.entity';
import {
    LEARNER_USER_ROLES,
    User,
    UserRole,
    UserStatus,
} from '../user/entities/user.entity';
import type { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { EligibleTestService } from '../ranking/services/eligible-test.service';
import { LearnerRankingService } from '../ranking/services/learner-ranking.service';
import { EligibleTest } from '../ranking/types/eligible-test.type';
import { LearnerRankingStats } from '../ranking/types/learner-ranking-stats.type';
import { compareLearnerRankingStats } from '../ranking/utils/ranking-comparator.util';
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

/** Hard ceiling on ranked learners so a large org cannot stall the request. */
const MAX_RANKED_LEARNERS = 1000;

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

/** Learner identity plus the display fields the leaderboard renders. */
interface LearnerRosterEntry {
    readonly userId: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly email?: string;
    readonly profilePicture: string | null;
    readonly branchId: string | null;
    readonly branchName: string | null;
}

/** A roster row joined to its ranking metrics, ready to sort. */
interface RankableLearner {
    readonly profile: LearnerRosterEntry;
    readonly stats: LearnerRankingStats;
}

/** Period bounds applied to `examEndDate` when selecting eligible tests. */
interface EligibilityWindow {
    readonly periodStart: Date | null;
    readonly periodEnd: Date | null;
}

/**
 * Org-wide leaderboard rankings with period filters, summary insights, and
 * month-over-month improvers. Rankings include every branch unless an admin
 * passes `branchId`.
 *
 * ## Ranking model
 * Learners are ranked on a weighted blend of knowledge and engagement rather
 * than on the average of whatever tests they chose to sit:
 *
 *   `rankingScore = (averageScore × 0.6) + (participationRate × 100 × 0.4)`
 *
 * Only **eligible** tests count — active tests whose exam window has fully
 * closed (see `EligibleTestService`). Open and future windows are excluded so
 * nobody is scored on training they still have time to complete.
 *
 * ## Periods
 * Both period modes run the same ranking pass; only the eligible-test set
 * differs. `month` keeps tests whose `examEndDate` falls inside that calendar
 * month, so the leaderboard reflects the exam cycles that closed in the month
 * — not the dates learners happened to submit. `all-time` keeps every closed
 * window. Previously `all-time` summed the `leaderboards` table and `month`
 * counted raw result rows, which double-counted retries.
 */
@Injectable()
export class LeaderboardOverviewService {
    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly eligibleTestService: EligibleTestService,
        private readonly learnerRankingService: LearnerRankingService,
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
            // Org-wide by default so Top Performers / Complete Rankings include
            // every branch. Do not fall back to scope.branchId — that silently
            // hid other offices from learners (often leaving only themselves).
            // An explicit query.branchId still narrows the list (admin filters).
            const branchId = query.branchId;

            const roster = await this.loadRoster({
                orgId: scope.orgId,
                branchId,
                search: query.search,
                activeOnly: query.activeOnly,
            });

            const current = await this.rankLearners({
                orgId: scope.orgId,
                branchId,
                courseId: query.courseId,
                roster,
                window: this.resolveEligibilityWindow(period, month),
            });

            let previousByUser = new Map<string, RankableLearner>();
            if (period === LeaderboardOverviewPeriod.MONTH && month) {
                const previous = await this.rankLearners({
                    orgId: scope.orgId,
                    branchId,
                    courseId: query.courseId,
                    roster,
                    window: this.resolveEligibilityWindow(
                        LeaderboardOverviewPeriod.MONTH,
                        this.previousYearMonth(month),
                    ),
                });
                previousByUser = new Map(
                    previous.map(entry => [entry.profile.userId, entry]),
                );
            }

            const ranked = this.buildEntries(current, previousByUser);
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

    /**
     * `month` buckets by the month an exam window closed in; `all-time` leaves
     * the window unbounded so every closed exam counts.
     */
    private resolveEligibilityWindow(
        period: LeaderboardOverviewPeriod,
        month?: string,
    ): EligibilityWindow {
        if (period !== LeaderboardOverviewPeriod.MONTH || !month) {
            return { periodStart: null, periodEnd: null };
        }

        const { start, end } = this.getMonthBounds(month);
        return { periodStart: start, periodEnd: end };
    }

    /**
     * Every active learner in scope. The roster is the ranking denominator, so
     * learners who sat nothing still appear (ranked last with a zero score)
     * rather than vanishing from the board.
     */
    private async loadRoster(options: {
        orgId: string;
        branchId?: string;
        search?: string;
        activeOnly?: boolean;
    }): Promise<LearnerRosterEntry[]> {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .leftJoin('user.branchId', 'branch')
            .leftJoin('user.avatar', 'avatar')
            .where('org.id = :orgId', { orgId: options.orgId })
            .andWhere('user.role IN (:...learnerRoles)', {
                learnerRoles: LEARNER_USER_ROLES,
            })
            .andWhere('user.status = :activeStatus', {
                activeStatus: UserStatus.ACTIVE,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('user.email', 'email')
            .addSelect('avatar.url', 'profilePicture')
            .addSelect('branch.id', 'branchId')
            .addSelect('branch.name', 'branchName')
            .orderBy('user.lastName', 'ASC')
            .addOrderBy('user.firstName', 'ASC')
            .limit(MAX_RANKED_LEARNERS);

        if (options.branchId) {
            query.andWhere('branch.id = :branchId', {
                branchId: options.branchId,
            });
        }

        if (options.search?.trim()) {
            const term = `%${options.search.trim().toLowerCase()}%`;
            query.andWhere(
                '(LOWER(user.firstName) LIKE :term OR LOWER(user.lastName) LIKE :term)',
                { term },
            );
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string | null;
            lastName: string | null;
            email: string;
            profilePicture: string | null;
            branchId: string | null;
            branchName: string | null;
        }>();

        const roster: LearnerRosterEntry[] = rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            email: row.email,
            profilePicture: row.profilePicture ?? null,
            branchId: row.branchId ?? null,
            branchName: row.branchName ?? null,
        }));

        if (!options.activeOnly) {
            return roster;
        }

        const activeUserIds = await this.getRecentlyActiveUserIds(
            options.orgId,
        );
        return roster.filter(learner => activeUserIds.has(learner.userId));
    }

    /** Learners with at least one graded result in the last 30 days. */
    private async getRecentlyActiveUserIds(
        orgId: string,
    ): Promise<Set<string>> {
        const cutoff = new Date();
        cutoff.setUTCDate(cutoff.getUTCDate() - ACTIVE_DAYS);

        const rows = await this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .where('org.id = :orgId', { orgId })
            .andWhere('result.voidedByResetId IS NULL')
            .andWhere('result.calculatedAt >= :cutoff', { cutoff })
            .select('DISTINCT result.userId', 'userId')
            .getRawMany<{ userId: string }>();

        return new Set(rows.map(row => row.userId));
    }

    /** Resolves eligible tests for the window, then ranks the roster on them. */
    private async rankLearners(options: {
        orgId: string;
        branchId?: string;
        courseId?: number;
        roster: readonly LearnerRosterEntry[];
        window: EligibilityWindow;
    }): Promise<RankableLearner[]> {
        const eligibleTests = this.filterByCourse(
            await this.eligibleTestService.resolveEligibleTests({
                orgId: options.orgId,
                branchId: options.branchId,
                periodStart: options.window.periodStart,
                periodEnd: options.window.periodEnd,
            }),
            options.courseId,
        );

        const statsByUser =
            await this.learnerRankingService.buildLearnerRankingStats({
                orgId: options.orgId,
                branchId: options.branchId,
                eligibleTests,
                learners: options.roster,
            });

        return options.roster
            .map(profile => ({
                profile,
                stats: statsByUser.get(profile.userId),
            }))
            .filter(
                (entry): entry is RankableLearner => entry.stats !== undefined,
            )
            .sort((left, right) => this.compareRankable(left, right));
    }

    private filterByCourse(
        tests: readonly EligibleTest[],
        courseId?: number,
    ): EligibleTest[] {
        if (!courseId) {
            return [...tests];
        }
        return tests.filter(test => test.courseId === courseId);
    }

    /** Shared order: ranking score, engagement, knowledge, then stable name. */
    private compareRankable(
        left: RankableLearner,
        right: RankableLearner,
    ): number {
        return (
            compareLearnerRankingStats(left.stats, right.stats) ||
            `${left.profile.lastName} ${left.profile.firstName}`.localeCompare(
                `${right.profile.lastName} ${right.profile.firstName}`,
            )
        );
    }

    private buildEntries(
        current: readonly RankableLearner[],
        previousByUser: Map<string, RankableLearner>,
    ): LeaderboardOverviewEntryDto[] {
        const previousRanked = [...previousByUser.values()].sort((a, b) =>
            this.compareRankable(a, b),
        );
        const previousRankMap = new Map(
            previousRanked.map((entry, index) => [
                entry.profile.userId,
                index + 1,
            ]),
        );

        const total = current.length;

        return current.map((entry, index) => {
            const { profile, stats } = entry;
            const rank = index + 1;
            const previous = previousByUser.get(profile.userId);
            const previousPoints = previous?.stats.totalPoints ?? null;
            const previousRank = previousRankMap.get(profile.userId) ?? null;
            const pointsDelta =
                previousPoints !== null
                    ? this.round(stats.totalPoints - previousPoints)
                    : null;
            const rankChange =
                previousRank !== null ? previousRank - rank : null;
            const percentileRank =
                total > 0
                    ? Math.round(((total - rank + 1) / total) * 100)
                    : 0;

            return {
                userId: profile.userId,
                rank,
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                profilePicture: profile.profilePicture,
                branchName: profile.branchName,
                totalPoints: stats.totalPoints,
                averageScore: stats.averageScore,
                testsCompleted: stats.testsCompleted,
                testsPassed: stats.testsPassed,
                totalEligibleTests: stats.totalEligibleTests,
                participationRate: stats.participationRate,
                rankingScore: stats.rankingScore,
                letterGrade: this.calculateLetterGrade(stats.averageScore),
                achievementLevel: this.getAchievementLevel(stats.averageScore),
                previousPoints,
                pointsDelta,
                previousRank,
                rankChange,
                percentileRank,
                consistencyRating: this.estimateConsistency(
                    stats.averageScore,
                    stats.testsCompleted,
                ),
                badges: this.calculateBadges(rank, stats.averageScore),
                courseId: null,
                courseTitle: null,
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
                averageParticipationRate: 0,
                totalEligibleTests: 0,
                yourRank: null,
                yourPoints: null,
                yourPointsDelta: null,
            };
        }

        // Summary averages describe learners who actually sat something, so a
        // large roster of non-participants cannot drag the org score to zero.
        const participants = ranked.filter(entry => entry.testsCompleted > 0);
        const basis = participants.length > 0 ? participants : ranked;

        const totalPoints = basis.reduce(
            (sum, entry) => sum + entry.totalPoints,
            0,
        );
        const totalAvg = basis.reduce(
            (sum, entry) => sum + entry.averageScore,
            0,
        );
        const totalParticipation = basis.reduce(
            (sum, entry) => sum + (entry.participationRate ?? 0),
            0,
        );
        const you = ranked.find(entry => entry.userId === currentUserId);

        return {
            totalParticipants: participants.length,
            averagePoints: this.round(totalPoints / basis.length),
            highestScore: ranked[0]?.totalPoints ?? 0,
            averageScore: this.round(totalAvg / basis.length),
            averageParticipationRate: this.round(
                totalParticipation / basis.length,
            ),
            totalEligibleTests: ranked[0]?.totalEligibleTests ?? 0,
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
