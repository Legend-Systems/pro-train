import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Leaderboard } from '../../leaderboard/entities/leaderboard.entity';
import { Result } from '../../results/entities/result.entity';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';
import { User, UserStatus } from '../../user/entities/user.entity';
import { Course } from '../../course/entities/course.entity';
import type { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import { EligibleTestService } from '../../ranking/services/eligible-test.service';
import { LearnerRankingService } from '../../ranking/services/learner-ranking.service';
import { LearnerRankingStats } from '../../ranking/types/learner-ranking-stats.type';
import { compareLearnerRankingStats } from '../../ranking/utils/ranking-comparator.util';
import { REPORT_LEARNER_ROLES } from '../constants/report-user-exclusions.constant';
import { ReportAudienceService } from './report-audience.service';
import {
    LeaderboardAnalyticsReportDto,
    LeaderboardStatsReportDto,
    LeaderboardPerformanceReportDto,
    GlobalLeaderboardStatsReportDto,
    TopPerformerReportDto,
    CompetitiveMetricsReportDto,
    RankMovementReportDto,
} from '../dto/leaderboard-analytics.dto';

@Injectable()
export class LeaderboardReportsService {
    constructor(
        @InjectRepository(Leaderboard)
        private leaderboardRepository: Repository<Leaderboard>,
        @InjectRepository(Result)
        private resultRepository: Repository<Result>,
        @InjectRepository(TestAttempt)
        private testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
        private readonly eligibleTestService: EligibleTestService,
        private readonly learnerRankingService: LearnerRankingService,
        private readonly reportAudienceService: ReportAudienceService,
    ) {}

    async getLeaderboardAnalytics(
        userId?: string,
        courseId?: number,
    ): Promise<LeaderboardAnalyticsReportDto> {
        const cacheKey = `leaderboard_analytics_${userId || 'global'}_${courseId || 'all'}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<LeaderboardAnalyticsReportDto>(
                cacheKey,
            );

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Generate fresh analytics data
        const [stats, performance] = await Promise.all([
            this.getLeaderboardStats(userId, courseId),
            this.getLeaderboardPerformance(userId, courseId),
        ]);

        const analyticsData: LeaderboardAnalyticsReportDto = {
            stats,
            performance,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 15 minutes (900 seconds) - leaderboards are dynamic
        await this.cacheManager.set(cacheKey, analyticsData, 900);

        return analyticsData;
    }

    async getGlobalLeaderboardStats(): Promise<GlobalLeaderboardStatsReportDto> {
        const cacheKey = 'global_leaderboard_stats';

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<GlobalLeaderboardStatsReportDto>(
                cacheKey,
            );

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Total participants across all leaderboards
        const participantQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .select('COUNT(DISTINCT l.userId)');
        await this.reportAudienceService.omitFromQuery(
            participantQuery,
            'l.userId',
            null,
        );
        const totalParticipants = await participantQuery.getRawOne();

        // Average points across all participants
        const averageQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .select('AVG(l.totalPoints)', 'avgPoints');
        await this.reportAudienceService.omitFromQuery(
            averageQuery,
            'l.userId',
            null,
        );
        const avgPointsResult = await averageQuery.getRawOne();

        const averagePoints = Number(avgPointsResult?.avgPoints || 0);

        // Top performers across all courses
        const topPerformerQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.user', 'u');
        await this.reportAudienceService.omitFromQuery(
            topPerformerQuery,
            'u.id',
            null,
        );
        const topGlobalPerformers = await topPerformerQuery
            .select('u.id', 'userId')
            .addSelect('u.firstName', 'firstName')
            .addSelect('u.lastName', 'lastName')
            .addSelect('SUM(l.totalPoints)', 'totalPoints')
            .addSelect('COUNT(DISTINCT l.courseId)', 'coursesParticipated')
            .groupBy('u.id')
            .addGroupBy('u.firstName')
            .addGroupBy('u.lastName')
            .orderBy('SUM(l.totalPoints)', 'DESC')
            .limit(10)
            .getRawMany();

        // Course leaderboard activity
        const courseActivityQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.course', 'c');
        await this.reportAudienceService.omitFromQuery(
            courseActivityQuery,
            'l.userId',
            null,
        );
        const courseActivity = await courseActivityQuery
            .select('c.courseId', 'courseId')
            .addSelect('c.title', 'title')
            .addSelect('COUNT(DISTINCT l.userId)', 'participants')
            .addSelect('AVG(l.totalPoints)', 'averagePoints')
            .addSelect('MAX(l.totalPoints)', 'topScore')
            .groupBy('c.courseId, c.title')
            .orderBy('COUNT(DISTINCT l.userId)', 'DESC')
            .limit(5)
            .getRawMany();

        // Recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentActivityQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .where('l.lastUpdated >= :sevenDaysAgo', { sevenDaysAgo });
        await this.reportAudienceService.omitFromQuery(
            recentActivityQuery,
            'l.userId',
            null,
        );
        const recentActivity = await recentActivityQuery.getCount();

        const statsData: GlobalLeaderboardStatsReportDto = {
            totalParticipants: Number(totalParticipants?.count || 0),
            averagePoints: Math.round(averagePoints * 100) / 100,
            topGlobalPerformers: topGlobalPerformers.map(performer => ({
                userId: performer.userId,
                name: `${performer.firstName} ${performer.lastName}`,
                totalPoints: Number(performer.totalPoints),
                coursesParticipated: Number(performer.coursesParticipated),
            })),
            mostActiveCourses: courseActivity.map(course => ({
                courseId: course.courseId,
                title: course.title,
                participants: Number(course.participants),
                averagePoints:
                    Math.round(Number(course.averagePoints) * 100) / 100,
                topScore: Number(course.topScore),
            })),
            recentActivity,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 10 minutes (600 seconds)
        await this.cacheManager.set(cacheKey, statsData, 600);

        return statsData;
    }

    /**
     * Top performers for the course analytics tab.
     *
     * Ranked with the shared participation-aware score over eligible tests
     * only (active, exam window fully closed), so a learner who sat one easy
     * test can no longer outrank someone who completed the programme. Raw
     * `leaderboards.totalPoints` ordering was also unscoped, which leaked
     * other organizations into the list.
     */
    async getTopPerformers(
        scope: OrgBranchScope,
        courseId?: number,
        limit: number = 10,
    ): Promise<TopPerformerReportDto[]> {
        if (!scope.orgId) {
            return [];
        }

        const cacheKey = `top_performers_${scope.orgId}_${
            scope.branchId || 'all-branches'
        }_${courseId || 'global'}_${limit}`;

        const cachedData =
            await this.cacheManager.get<TopPerformerReportDto[]>(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        const [roster, allEligibleTests] = await Promise.all([
            this.getLearnerRoster(scope.orgId, scope.branchId),
            this.eligibleTestService.resolveEligibleTests({
                orgId: scope.orgId,
                branchId: scope.branchId,
            }),
        ]);

        const eligibleTests = courseId
            ? allEligibleTests.filter(test => test.courseId === courseId)
            : allEligibleTests;

        const statsByUser =
            await this.learnerRankingService.buildLearnerRankingStats({
                orgId: scope.orgId,
                branchId: scope.branchId,
                eligibleTests,
                learners: roster,
            });

        const topPerformers: TopPerformerReportDto[] = roster
            .map(learner => ({
                learner,
                stats: statsByUser.get(learner.userId),
            }))
            .filter(
                (
                    entry,
                ): entry is {
                    learner: (typeof roster)[number];
                    stats: LearnerRankingStats;
                } => entry.stats !== undefined && entry.stats.testsCompleted > 0,
            )
            .sort(
                (left, right) =>
                    compareLearnerRankingStats(left.stats, right.stats) ||
                    `${left.learner.lastName} ${left.learner.firstName}`.localeCompare(
                        `${right.learner.lastName} ${right.learner.firstName}`,
                    ),
            )
            .slice(0, limit)
            .map(({ learner, stats }, index) => ({
                userId: learner.userId,
                name: `${learner.firstName} ${learner.lastName}`.trim(),
                points: stats.totalPoints,
                rank: index + 1,
                courseId,
            }));

        // Cache the result for 15 minutes (900 seconds)
        await this.cacheManager.set(cacheKey, topPerformers, 900);

        return topPerformers;
    }

    /** Active learners in scope — the ranking population. */
    private async getLearnerRoster(
        orgId: string,
        branchId?: string,
    ): Promise<
        Array<{
            userId: string;
            firstName: string;
            lastName: string;
            branchId: string | null;
        }>
    > {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .leftJoin('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role IN (:...learnerRoles)', {
                learnerRoles: REPORT_LEARNER_ROLES,
            })
            .andWhere('user.status = :activeStatus', {
                activeStatus: UserStatus.ACTIVE,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('branch.id', 'branchId');

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        await this.reportAudienceService.omitFromQuery(query, 'user.id', orgId);

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string | null;
            lastName: string | null;
            branchId: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            branchId: row.branchId ?? null,
        }));
    }

    async getRankMovements(
        courseId?: number,
        days: number = 7,
    ): Promise<RankMovementReportDto[]> {
        const cacheKey = `rank_movements_${courseId || 'global'}_${days}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<RankMovementReportDto[]>(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - days);

        // This is a simplified implementation
        // In a real scenario, you'd want to track historical rank data
        let query = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.user', 'u')
            .select('u.id', 'userId')
            .addSelect('u.firstName', 'firstName')
            .addSelect('u.lastName', 'lastName')
            .addSelect('l.totalPoints', 'currentPoints')
            .addSelect('l.rank', 'currentRank')
            .addSelect('l.lastUpdated', 'lastUpdated')
            .where('l.lastUpdated >= :daysAgo', { daysAgo });

        if (courseId) {
            query = query.andWhere('l.courseId = :courseId', { courseId });
        }

        await this.reportAudienceService.omitFromQuery(query, 'u.id', null);

        const movements = await query.orderBy('l.lastUpdated', 'DESC').getRawMany();

        const rankMovements: RankMovementReportDto[] = movements.map(
            movement => ({
                userId: movement.userId,
                name: `${movement.firstName} ${movement.lastName}`,
                currentRank: Number(movement.currentRank),
                previousRank:
                    Number(movement.currentRank) +
                    Math.floor(Math.random() * 5 - 2), // Simulated
                rankChange: Math.floor(Math.random() * 10 - 5), // Simulated
                currentPoints: Number(movement.currentPoints),
                pointsChange: Math.floor(Math.random() * 100 - 50), // Simulated
            }),
        );

        // Cache the result for 1 hour (3600 seconds)
        await this.cacheManager.set(cacheKey, rankMovements, 3600);

        return rankMovements;
    }

    async getCompetitiveMetrics(
        courseId?: number,
    ): Promise<CompetitiveMetricsReportDto> {
        const cacheKey = `competitive_metrics_${courseId || 'global'}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<CompetitiveMetricsReportDto>(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        let query = this.leaderboardRepository.createQueryBuilder('l');

        if (courseId) {
            query = query.where('l.courseId = :courseId', { courseId });
        }

        await this.reportAudienceService.omitFromQuery(query, 'l.userId', null);

        // Calculate competitive intensity metrics
        const leaderboardData = await query
            .select('l.totalPoints', 'points')
            .addSelect('l.rank', 'rank')
            .orderBy('l.totalPoints', 'DESC')
            .getRawMany();

        const points = leaderboardData.map(entry => Number(entry.points));
        const totalParticipants = points.length;

        // Calculate standard deviation to measure competition intensity
        const mean =
            points.reduce((sum, point) => sum + point, 0) / totalParticipants;
        const standardDeviation = Math.sqrt(
            points.reduce((sum, point) => sum + Math.pow(point - mean, 2), 0) /
                totalParticipants,
        );

        // Competition intensity (lower std dev = tighter competition)
        const competitionIntensity =
            standardDeviation > 0
                ? Math.max(0, 100 - (standardDeviation / mean) * 100)
                : 0;

        // Top 10% threshold
        const top10Threshold = Math.floor(totalParticipants * 0.1);
        const top10Points = points.slice(0, top10Threshold);
        const averageTop10 =
            top10Points.reduce((sum, point) => sum + point, 0) /
            top10Points.length;

        // Bottom 10% threshold
        const bottom10Threshold = Math.floor(totalParticipants * 0.9);
        const bottom10Points = points.slice(bottom10Threshold);
        const averageBottom10 =
            bottom10Points.reduce((sum, point) => sum + point, 0) /
            bottom10Points.length;

        const metrics: CompetitiveMetricsReportDto = {
            totalParticipants,
            competitionIntensity: Math.round(competitionIntensity * 100) / 100,
            averagePoints: Math.round(mean * 100) / 100,
            topPerformerThreshold: Math.round(averageTop10 * 100) / 100,
            participationGap:
                Math.round((averageTop10 - averageBottom10) * 100) / 100,
            standardDeviation: Math.round(standardDeviation * 100) / 100,
        };

        // Cache the result for 30 minutes (1800 seconds)
        await this.cacheManager.set(cacheKey, metrics, 1800);

        return metrics;
    }

    private async getLeaderboardStats(
        userId?: string,
        courseId?: number,
    ): Promise<LeaderboardStatsReportDto> {
        let query = this.leaderboardRepository.createQueryBuilder('l');

        if (userId) {
            query = query.where('l.userId = :userId', { userId });
        } else {
            await this.reportAudienceService.omitFromQuery(
                query,
                'l.userId',
                null,
            );
        }

        if (courseId) {
            query = query.andWhere('l.courseId = :courseId', { courseId });
        }

        // User's current rankings
        const userRankings = await query
            .select('l.rank', 'rank')
            .addSelect('l.totalPoints', 'points')
            .addSelect('l.courseId', 'courseId')
            .orderBy('l.totalPoints', 'DESC')
            .getRawMany();

        const totalRankings = userRankings.length;
        const averageRank =
            totalRankings > 0
                ? userRankings.reduce(
                      (sum, ranking) => sum + Number(ranking.rank),
                      0,
                  ) / totalRankings
                : 0;

        const totalPoints = userRankings.reduce(
            (sum, ranking) => sum + Number(ranking.points),
            0,
        );
        const bestRank =
            totalRankings > 0
                ? Math.min(...userRankings.map(r => Number(r.rank)))
                : 0;

        // Recent improvements
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let recentQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .where('l.lastUpdated >= :thirtyDaysAgo', { thirtyDaysAgo });

        if (userId) {
            recentQuery = recentQuery.andWhere('l.userId = :userId', {
                userId,
            });
        } else {
            await this.reportAudienceService.omitFromQuery(
                recentQuery,
                'l.userId',
                null,
            );
        }

        if (courseId) {
            recentQuery = recentQuery.andWhere('l.courseId = :courseId', {
                courseId,
            });
        }

        const recentActivity = await recentQuery.getCount();

        return {
            totalRankings,
            averageRank: Math.round(averageRank * 100) / 100,
            bestRank,
            totalPoints,
            recentActivity,
        };
    }

    private async getLeaderboardPerformance(
        userId?: string,
        courseId?: number,
    ): Promise<LeaderboardPerformanceReportDto> {
        // Performance trends over time
        let query = this.leaderboardRepository
            .createQueryBuilder('l')
            .select('DATE(l.lastUpdated)', 'date')
            .addSelect('AVG(l.totalPoints)', 'averagePoints')
            .addSelect('AVG(l.rank)', 'averageRank')
            .groupBy('DATE(l.lastUpdated)')
            .orderBy('DATE(l.lastUpdated)', 'ASC')
            .limit(30);

        if (userId) {
            query = query.andWhere('l.userId = :userId', { userId });
        } else {
            await this.reportAudienceService.omitFromQuery(
                query,
                'l.userId',
                null,
            );
        }

        if (courseId) {
            query = query.andWhere('l.courseId = :courseId', { courseId });
        }

        const trends = await query.getRawMany();

        // Course-specific performance
        let courseQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.course', 'c')
            .select('c.title', 'courseName')
            .addSelect('l.rank', 'rank')
            .addSelect('l.totalPoints', 'points')
            .addSelect('c.courseId', 'courseId')
            .orderBy('l.totalPoints', 'DESC');

        if (userId) {
            courseQuery = courseQuery.andWhere('l.userId = :userId', {
                userId,
            });
        } else {
            await this.reportAudienceService.omitFromQuery(
                courseQuery,
                'l.userId',
                null,
            );
        }

        if (courseId) {
            courseQuery = courseQuery.andWhere('l.courseId = :courseId', {
                courseId,
            });
        }

        const coursePerformance = await courseQuery.getRawMany();

        return {
            performanceTrends: trends.map(trend => ({
                date: trend.date,
                averagePoints:
                    Math.round(Number(trend.averagePoints) * 100) / 100,
                averageRank: Math.round(Number(trend.averageRank) * 100) / 100,
            })),
            coursePerformance: coursePerformance.map(course => ({
                courseId: course.courseId,
                courseName: course.courseName,
                rank: Number(course.rank),
                points: Number(course.points),
            })),
        };
    }
}
