import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { UserRole } from '../user/entities/user.entity';
import { Result } from '../results/entities/result.entity';
import { PASSING_SCORE_PERCENTAGE } from '../results/constants/passing-score.constants';
import { LeaderboardOverviewService } from '../leaderboard/leaderboard-overview.service';
import {
    LeaderboardOverviewPeriod,
    LeaderboardOverviewQueryDto,
} from '../leaderboard/dto/leaderboard-overview.dto';
import { RewardsService } from '../rewards/rewards.service';
import { TrainingHoursService } from '../training-hours/training-hours.service';
import { AdminInsightsReportsService } from '../reports/services/admin-insights-reports.service';
import {
    HomeCarouselResponseDto,
    HomeInsightAdminDto,
    HomeInsightBranchDto,
    HomeInsightEducationDto,
    HomeInsightLeaderboardDto,
    HomeInsightPersonalDto,
    HomeInsightPersonDto,
} from './dto/home-carousel.dto';

/** Roles that receive the admin-only carousel payload. */
const ADMIN_CAROUSEL_ROLES: ReadonlySet<string> = new Set([
    UserRole.MASTER_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
]);

const SNAPSHOT_LIMIT = 3;
const BRANCH_LIMIT = 3;

/**
 * Aggregates learner + optional admin insights for the home carousel.
 * Admin slices are omitted unless the caller has an admin role (server-side gate).
 */
@Injectable()
export class HomeInsightsService {
    private readonly logger = new Logger(HomeInsightsService.name);

    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        private readonly leaderboardOverviewService: LeaderboardOverviewService,
        private readonly rewardsService: RewardsService,
        private readonly trainingHoursService: TrainingHoursService,
        private readonly adminInsightsReportsService: AdminInsightsReportsService,
    ) {}

    /** Builds the full carousel payload for the authenticated user. */
    async getCarousel(scope: OrgBranchScope): Promise<HomeCarouselResponseDto> {
        const isAdmin = this.isAdminRole(scope.userRole);

        const [personal, leaderboard, admin] = await Promise.all([
            this.buildPersonal(scope),
            this.buildLeaderboardSnapshot(scope, isAdmin),
            isAdmin ? this.buildAdmin(scope) : Promise.resolve(undefined),
        ]);

        return {
            education: this.buildEducation(),
            personal,
            leaderboard,
            admin,
            generatedAt: new Date().toISOString(),
        };
    }

    /** Static educational copy plus the live 80% pass mark. */
    private buildEducation(): HomeInsightEducationDto {
        return {
            passMarkPercent: PASSING_SCORE_PERCENTAGE,
            courseCompletionTips: [
                'A course is complete when you pass every active Exam at least once.',
                'Use Quizzes and Training tests to practise before mandatory Exams.',
                'Track mandatory exams on the course page — only Exams gate completion.',
                'Study materials first, then take a practice quiz, then attempt the Exam.',
            ],
            testPassTips: [
                `You need ${PASSING_SCORE_PERCENTAGE}% or higher to pass.`,
                'If time runs out, the test is submitted automatically — watch the timer.',
                'Review flagged questions before submitting when time allows.',
                'Failed attempts still count toward your max attempts — prepare first.',
                'Retake when attempts remain; your latest score feeds Knowledge Score.',
            ],
        };
    }

    /** XP, pass/fail, hours, streak, and recommended next actions. */
    private async buildPersonal(
        scope: OrgBranchScope,
    ): Promise<HomeInsightPersonalDto> {
        const userId = scope.userId;

        const [resultCounts, rewards, hours, streak] = await Promise.all([
            this.getUserResultCounts(userId),
            scope.orgId
                ? this.rewardsService
                      .getUserStats(userId, scope)
                      .catch(() => null)
                : Promise.resolve(null),
            scope.orgId
                ? this.trainingHoursService
                      .getUserSummary(userId, scope.orgId, scope.branchId)
                      .catch(() => null)
                : Promise.resolve(null),
            this.getUserStreak(userId),
        ]);

        const knowledgeScore = resultCounts.averageScore;
        const achievements = this.buildAchievements(resultCounts, rewards?.level);
        const milestones = this.buildMilestones(resultCounts, hours?.totalHours ?? 0);
        const recommendedActions = this.buildRecommendedActions(
            resultCounts,
            knowledgeScore,
            streak.currentStreak,
        );

        return {
            knowledgeScore,
            currentXP: rewards?.currentXP ?? 0,
            totalXP: rewards?.totalXP ?? 0,
            level: rewards?.level ?? 1,
            xpRank: rewards?.rank ?? 'Bronze',
            testsPassed: resultCounts.passedResults,
            testsFailed: resultCounts.failedResults,
            passRate: resultCounts.passRate,
            averageScore: resultCounts.averageScore,
            totalTrainingHours: hours?.totalHours ?? 0,
            currentMonthTrainingHours: hours?.currentMonthHours ?? 0,
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            achievements,
            milestones,
            recommendedActions,
        };
    }

    /** Top/bottom users, improvers, and branch rankings for slide 3. */
    private async buildLeaderboardSnapshot(
        scope: OrgBranchScope,
        includeAdminCoachingData: boolean,
    ): Promise<HomeInsightLeaderboardDto> {
        const query: LeaderboardOverviewQueryDto = {
            page: 1,
            limit: 50,
            period: LeaderboardOverviewPeriod.MONTH,
        };

        const [overview, branches] = await Promise.all([
            this.leaderboardOverviewService.getOverview(scope, query).catch(error => {
                this.logger.warn(
                    `Leaderboard overview failed for carousel: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
                return null;
            }),
            this.getBranchRankings(scope),
        ]);

        const entries = overview?.entries ?? overview?.leaderboard ?? [];
        const topUsers = entries.slice(0, SNAPSHOT_LIMIT).map(entry =>
            this.mapOverviewPerson(entry),
        );
        const bottomUsers = includeAdminCoachingData
            ? [...entries]
                  .reverse()
                  .slice(0, SNAPSHOT_LIMIT)
                  .map(entry => this.mapOverviewPerson(entry))
            : [];

        const topImprovers = (overview?.topImprovers ?? [])
            .slice(0, SNAPSHOT_LIMIT)
            .map(entry => ({
                userId: entry.userId,
                firstName: entry.firstName,
                lastName: entry.lastName,
                branchName: entry.branchName ?? null,
                averageScore: entry.currentPoints,
                rank: entry.currentRank,
                totalPoints: entry.currentPoints,
                pointsDelta: entry.pointsDelta ?? null,
            }));

        return {
            yourRank: overview?.summary?.yourRank ?? null,
            yourPoints: overview?.summary?.yourPoints ?? null,
            totalParticipants: overview?.summary?.totalParticipants ?? entries.length,
            averageScore: overview?.summary?.averageScore ?? 0,
            topUsers,
            bottomUsers,
            topImprovers,
            topBranches: branches.slice(0, BRANCH_LIMIT),
            bottomBranches: includeAdminCoachingData
                ? [...branches].reverse().slice(0, BRANCH_LIMIT)
                : [],
        };
    }

    /**
     * Admin org analytics — only called when role is Master Admin / Owner / Admin.
     * Uses existing admin insights hub so we do not duplicate query logic.
     */
    private async buildAdmin(
        scope: OrgBranchScope,
    ): Promise<HomeInsightAdminDto | undefined> {
        try {
            const overview = await this.adminInsightsReportsService.getOverview(
                scope,
                { timeframe: 'month', limit: SNAPSHOT_LIMIT },
            );

            const hardestTests = (overview.mostFailedTests ?? [])
                .slice(0, SNAPSHOT_LIMIT)
                .map(test => ({
                    testId: test.testId,
                    testTitle: test.testTitle,
                    courseTitle: test.courseTitle ?? null,
                    passRate: test.passRate,
                    averageScore: test.averageScore ?? 0,
                    totalAttempts: test.totalAttempts,
                }));

            const easiestTests = (overview.mostPassedTests ?? [])
                .slice(0, SNAPSHOT_LIMIT)
                .map(test => ({
                    testId: test.testId,
                    testTitle: test.testTitle,
                    courseTitle: test.courseTitle ?? null,
                    passRate: test.passRate,
                    averageScore: test.averageScore ?? 0,
                    totalAttempts: test.totalAttempts,
                }));

            const branchComparison = (overview.branchComparison ?? [])
                .slice(0, 6)
                .map(branch => ({
                    branchId: branch.branchId,
                    branchName: branch.branchName,
                    averageScore: branch.averageScore,
                    passRate: branch.passRate,
                    resultsCount: branch.resultsCount,
                }));

            const keyTrainingAreas = (overview.keyAreas ?? [])
                .slice(0, SNAPSHOT_LIMIT)
                .map(area => ({
                    courseId: area.entityId,
                    courseTitle: area.title,
                    averageScore: area.averageScore,
                    passRate: this.round(100 - (area.failureRate ?? 0)),
                    resultsCount: 0,
                }));

            const operationalHighlights = this.buildAdminHighlights(overview);

            return {
                averageKnowledgeScore: overview.kpis.averageKnowledgeScore,
                overallPassRate: overview.kpis.overallPassRate,
                totalResults: overview.kpis.totalResults,
                activeLearners: overview.kpis.activeLearners,
                totalTrainingHours: overview.kpis.totalTrainingHours,
                atRiskUserCount: overview.kpis.atRiskUserCount,
                highPotentialUserCount: overview.kpis.highPotentialUserCount,
                topPerformers: (overview.topPerformers ?? []).map(p => ({
                    userId: p.userId,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    branchName: p.branchName,
                    averageScore: p.averageScore,
                    passRate: p.passRate,
                })),
                worstPerformers: (overview.worstPerformers ?? []).map(p => ({
                    userId: p.userId,
                    firstName: p.firstName,
                    lastName: p.lastName,
                    branchName: p.branchName,
                    averageScore: p.averageScore,
                    passRate: p.passRate,
                })),
                hardestTests,
                easiestTests,
                branchComparison,
                keyTrainingAreas,
                operationalHighlights,
            };
        } catch (error) {
            this.logger.warn(
                `Admin carousel insights failed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return undefined;
        }
    }

    private isAdminRole(role?: string): boolean {
        return !!role && ADMIN_CAROUSEL_ROLES.has(role);
    }

    private async getUserResultCounts(userId: string): Promise<{
        totalResults: number;
        passedResults: number;
        failedResults: number;
        averageScore: number;
        passRate: number;
    }> {
        const row = await this.resultRepository
            .createQueryBuilder('result')
            .where('result.userId = :userId', { userId })
            .select('COUNT(result.resultId)', 'totalResults')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedResults',
            )
            .addSelect('AVG(result.percentage)', 'averageScore')
            .getRawOne<{
                totalResults: string;
                passedResults: string;
                averageScore: string;
            }>();

        const totalResults = Number(row?.totalResults) || 0;
        const passedResults = Number(row?.passedResults) || 0;
        const failedResults = Math.max(totalResults - passedResults, 0);
        const averageScore = this.round(Number(row?.averageScore) || 0);
        const passRate =
            totalResults > 0
                ? this.round((passedResults / totalResults) * 100)
                : 0;

        return {
            totalResults,
            passedResults,
            failedResults,
            averageScore,
            passRate,
        };
    }

    /** Approximate streak from distinct result activity dates (UTC days). */
    private async getUserStreak(
        userId: string,
    ): Promise<{ currentStreak: number; longestStreak: number }> {
        const rows = await this.resultRepository
            .createQueryBuilder('result')
            .where('result.userId = :userId', { userId })
            .select('DATE(result.calculatedAt)', 'activityDate')
            .groupBy('DATE(result.calculatedAt)')
            .orderBy('activityDate', 'DESC')
            .limit(90)
            .getRawMany<{ activityDate: string | Date }>();

        if (rows.length === 0) {
            return { currentStreak: 0, longestStreak: 0 };
        }

        // mysql2 may return DATE() as a Date object, not a string
        const days = rows
            .map(row => this.toUtcDateKey(row.activityDate))
            .filter((value): value is string => value !== null);

        if (days.length === 0) {
            return { currentStreak: 0, longestStreak: 0 };
        }

        const todayKey = new Date().toISOString().slice(0, 10);
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayKey = yesterday.toISOString().slice(0, 10);
        const isActiveRecently =
            days[0] === todayKey || days[0] === yesterdayKey;

        let longestStreak = 1;
        let run = 1;
        for (let index = 1; index < days.length; index += 1) {
            const newer = new Date(`${days[index - 1]}T00:00:00.000Z`);
            const older = new Date(`${days[index]}T00:00:00.000Z`);
            const dayDiff = Math.round(
                (newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24),
            );
            if (dayDiff === 1) {
                run += 1;
                longestStreak = Math.max(longestStreak, run);
            } else {
                run = 1;
            }
        }

        let currentStreak = 0;
        if (isActiveRecently) {
            currentStreak = 1;
            for (let index = 1; index < days.length; index += 1) {
                const newer = new Date(`${days[index - 1]}T00:00:00.000Z`);
                const older = new Date(`${days[index]}T00:00:00.000Z`);
                const dayDiff = Math.round(
                    (newer.getTime() - older.getTime()) /
                        (1000 * 60 * 60 * 24),
                );
                if (dayDiff !== 1) {
                    break;
                }
                currentStreak += 1;
            }
        }

        return {
            currentStreak,
            longestStreak: Math.max(longestStreak, currentStreak),
        };
    }

    /** Normalizes mysql DATE() / Date / string values to YYYY-MM-DD. */
    private toUtcDateKey(value: string | Date | null | undefined): string | null {
        if (value == null) {
            return null;
        }

        if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) {
                return null;
            }
            return value.toISOString().slice(0, 10);
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length >= 10 ? trimmed.slice(0, 10) : null;
        }

        return null;
    }

    /** Org branch rankings by average knowledge score (available to all roles). */
    private async getBranchRankings(
        scope: OrgBranchScope,
    ): Promise<HomeInsightBranchDto[]> {
        if (!scope.orgId) {
            return [];
        }

        const rows = await this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .leftJoin('result.branchId', 'branch')
            .where('org.id = :orgId', { orgId: scope.orgId })
            .andWhere('branch.id IS NOT NULL')
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
            .having('COUNT(result.resultId) > 0')
            .orderBy('averageScore', 'DESC')
            .getRawMany<{
                branchId: string;
                branchName: string;
                averageScore: string;
                resultsCount: string;
                passedCount: string;
            }>();

        return rows.map(row => {
            const resultsCount = Number(row.resultsCount) || 0;
            const passedCount = Number(row.passedCount) || 0;
            return {
                branchId: row.branchId,
                branchName: row.branchName,
                averageScore: this.round(Number(row.averageScore) || 0),
                passRate:
                    resultsCount > 0
                        ? this.round((passedCount / resultsCount) * 100)
                        : 0,
                resultsCount,
            };
        });
    }

    private mapOverviewPerson(entry: {
        userId: string;
        firstName: string;
        lastName: string;
        branchName?: string | null;
        averageScore: number;
        rank: number;
        totalPoints: number;
        pointsDelta?: number | null;
    }): HomeInsightPersonDto {
        return {
            userId: entry.userId,
            firstName: entry.firstName,
            lastName: entry.lastName,
            branchName: entry.branchName ?? null,
            averageScore: entry.averageScore,
            rank: entry.rank,
            totalPoints: entry.totalPoints,
            pointsDelta: entry.pointsDelta ?? null,
        };
    }

    private buildAchievements(
        counts: { passedResults: number; passRate: number; averageScore: number },
        level?: number,
    ): string[] {
        const badges: string[] = [];
        if (counts.passedResults >= 1) badges.push('First Pass');
        if (counts.passedResults >= 5) badges.push('5 Tests Passed');
        if (counts.passRate >= 80) badges.push('High Pass Rate');
        if (counts.averageScore >= PASSING_SCORE_PERCENTAGE) {
            badges.push('Above Pass Mark');
        }
        if ((level ?? 0) >= 3) badges.push(`Level ${level} Achiever`);
        return badges;
    }

    private buildMilestones(
        counts: { passedResults: number; totalResults: number },
        totalHours: number,
    ): string[] {
        const milestones: string[] = [];
        if (counts.totalResults >= 1) milestones.push('Completed first assessment');
        if (counts.passedResults >= 3) milestones.push('3 exams under your belt');
        if (totalHours >= 2) milestones.push('2+ hours of training logged');
        if (totalHours >= 5) milestones.push('5+ hours of training logged');
        return milestones;
    }

    private buildRecommendedActions(
        counts: {
            failedResults: number;
            passRate: number;
            averageScore: number;
            totalResults: number;
        },
        knowledgeScore: number,
        currentStreak: number,
    ): string[] {
        const actions: string[] = [];

        if (counts.totalResults === 0) {
            actions.push('Start a practice Quiz to build confidence before Exams.');
        }
        if (counts.failedResults > 0) {
            actions.push('Review failed results and retake when attempts remain.');
        }
        if (knowledgeScore < PASSING_SCORE_PERCENTAGE && counts.totalResults > 0) {
            actions.push(
                `Aim for ${PASSING_SCORE_PERCENTAGE}%+ — open course materials and try a Training test.`,
            );
        }
        if (currentStreak === 0) {
            actions.push('Log a short study session today to start a new streak.');
        } else {
            actions.push(`Keep your ${currentStreak}-day streak going with a quick quiz.`);
        }
        if (counts.passRate < 70 && counts.totalResults >= 3) {
            actions.push('Focus on weak topics — check past results for patterns.');
        }

        return actions.slice(0, 4);
    }

    private buildAdminHighlights(overview: {
        kpis: {
            overallPassRate: number;
            averageKnowledgeScore: number;
            atRiskUserCount: number;
            highPotentialUserCount: number;
            activeLearners: number;
        };
        mostFailedTests?: Array<{ testTitle: string }>;
        keyAreas?: Array<{ title: string }>;
    }): string[] {
        const highlights: string[] = [];
        highlights.push(
            `Org pass rate is ${overview.kpis.overallPassRate}% this month.`,
        );
        highlights.push(
            `Average knowledge score sits at ${overview.kpis.averageKnowledgeScore}%.`,
        );
        if (overview.kpis.atRiskUserCount > 0) {
            highlights.push(
                `${overview.kpis.atRiskUserCount} learners need support.`,
            );
        }
        if (overview.kpis.highPotentialUserCount > 0) {
            highlights.push(
                `${overview.kpis.highPotentialUserCount} high-potential learners to coach.`,
            );
        }
        const hardest = overview.mostFailedTests?.[0]?.testTitle;
        if (hardest) {
            highlights.push(`Hardest test right now: ${hardest}.`);
        }
        const gap = overview.keyAreas?.[0]?.title;
        if (gap) {
            highlights.push(`Priority training area: ${gap}.`);
        }
        highlights.push(
            `${overview.kpis.activeLearners} active learners in the current window.`,
        );
        return highlights.slice(0, 5);
    }

    private round(value: number): number {
        return Math.round(value * 10) / 10;
    }
}
