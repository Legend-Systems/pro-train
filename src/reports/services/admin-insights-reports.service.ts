import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import { Answer } from '../../answers/entities/answer.entity';
import { Leaderboard } from '../../leaderboard/entities/leaderboard.entity';
import { Result } from '../../results/entities/result.entity';
import { TrainingSession } from '../../training-hours/entities/training-session.entity';
import { Test } from '../../test/entities/test.entity';
import {
    AttemptStatus,
    TestAttempt,
} from '../../test_attempts/entities/test_attempt.entity';
import { User, UserRole, UserStatus } from '../../user/entities/user.entity';
import {
    AdminAtRiskUserDto,
    AdminBranchComparisonDto,
    AdminBranchTopPerformersDto,
    AdminChallengingQuestionDto,
    AdminEffectivenessTrendPointDto,
    AdminHighPotentialUserDto,
    AdminKeyAreaDto,
    AdminKnowledgeImprovementDto,
    AdminLeaderboardEntryDto,
    AdminLeaderboardInsightsDto,
    AdminOverviewReportDto,
    AdminPassRateDto,
    AdminPerformerDto,
    AdminRankingEntryDto,
    AdminReportFiltersDto,
    AdminReportSortOrder,
    AdminReportTimeframe,
    AdminSkillGapDto,
    AdminTestCompletionSummaryDto,
    AdminTestPassFailDto,
    AdminTestsNotCompletedReportDto,
    AdminTestsNotCompletedUserDto,
    AdminTopScorerDto,
    AdminTrainingHoursUserDto,
} from '../dto/admin-insights.dto';

/** Minutes in one hour for display conversion. */
const MINUTES_PER_HOUR = 60;

/** Default ranked-list size. */
const DEFAULT_LIMIT = 10;

/** Hub overview uses a compact top-N. */
const OVERVIEW_LIMIT = 5;

/** Scores at or below this are treated as weak knowledge. */
const LOW_SCORE_THRESHOLD = 60;

/** Pass rates at or below this signal high failure. */
const HIGH_FAILURE_PASS_RATE = 60;

/** Minimum results required before ranking a learner. */
const MIN_RESULTS_FOR_RANKING = 1;

/** Improvement threshold (percentage points) for high-potential users. */
const HIGH_POTENTIAL_IMPROVEMENT = 5;

/** Absolute score threshold for high-potential users. */
const HIGH_POTENTIAL_SCORE = 75;

/** At-risk: low engagement ceiling for results in the current window. */
const AT_RISK_MAX_RESULTS = 2;

/** Hard ceiling on full-org ranking rows so a PDF stays deliverable by email. */
const MAX_RANKING_ROWS = 1000;

/** Learners celebrated per branch in the leaderboard report. */
const BRANCH_TOP_PERFORMER_COUNT = 3;

/** Default number of highest-scoring test results to celebrate. */
const TOP_SCORER_LIMIT = 10;

/** Date window derived from timeframe or explicit start/end. */
interface DateWindow {
    start: Date;
    end: Date;
    previousStart: Date;
    previousEnd: Date;
    label: AdminReportTimeframe;
}

/** Active test that was available during the selected report month. */
interface RelevantReportTest {
    readonly testId: number;
    readonly testTitle: string;
    readonly courseTitle: string | null;
    readonly testBranchId: string | null;
    readonly courseBranchId: string | null;
    readonly examStartDate: Date | null;
    readonly examEndDate: Date | null;
}

/** Best attempt outcome for a learner+test as of month-end. */
type AttemptOutcome = 'submitted' | 'incomplete' | 'none';

/**
 * Org-scoped admin reporting catalogue for owner / admin / master_admin.
 * All queries require organization context and optionally filter by branch.
 */
@Injectable()
export class AdminInsightsReportsService {
    private readonly logger = new Logger(AdminInsightsReportsService.name);

    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(TrainingSession)
        private readonly sessionRepository: Repository<TrainingSession>,
        @InjectRepository(Leaderboard)
        private readonly leaderboardRepository: Repository<Leaderboard>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
    ) {}

    /** Executive hub payload combining KPIs and actionable slices. */
    async getOverview(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminOverviewReportDto> {
        const orgId = this.requireOrg(scope);
        const timeframe = filters.timeframe ?? 'month';
        const branchId = filters.branchId;
        const limit = OVERVIEW_LIMIT;

        const [
            topPerformers,
            worstPerformers,
            passFail,
            branchComparison,
            atRiskUsers,
            highPotentialUsers,
            keyAreas,
            effectivenessTrends,
            trainingHours,
        ] = await Promise.all([
            this.getPerformers(scope, {
                ...filters,
                order: 'desc',
                limit,
            }),
            this.getPerformers(scope, {
                ...filters,
                order: 'asc',
                limit,
            }),
            this.getPassFailRanking(scope, { ...filters, limit }),
            this.getBranchComparison(scope, filters),
            this.getAtRiskUsers(scope, { ...filters, limit }),
            this.getHighPotentialUsers(scope, { ...filters, limit }),
            this.getKeyAreas(scope, { ...filters, limit }),
            this.getEffectivenessTrends(scope, filters),
            this.getTrainingHours(scope, { ...filters, limit: 100 }),
        ]);

        const window = this.resolveWindow(filters);
        const kpiRows = await this.buildScopedResultsQuery(orgId, branchId)
            .andWhere('result.calculatedAt >= :start', { start: window.start })
            .andWhere('result.calculatedAt < :end', { end: window.end })
            .select('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .addSelect('COUNT(DISTINCT result.userId)', 'activeLearners')
            .getRawOne<{
                averageScore: string;
                resultsCount: string;
                passedCount: string;
                activeLearners: string;
            }>();

        const totalResults = Number(kpiRows?.resultsCount) || 0;
        const passedCount = Number(kpiRows?.passedCount) || 0;
        const totalTrainingHours = this.round(
            trainingHours.reduce((sum, row) => sum + row.totalHours, 0),
        );

        return {
            kpis: {
                averageKnowledgeScore: this.round(
                    Number(kpiRows?.averageScore) || 0,
                ),
                overallPassRate:
                    totalResults > 0
                        ? this.round((passedCount / totalResults) * 100)
                        : 0,
                totalResults,
                activeLearners: Number(kpiRows?.activeLearners) || 0,
                totalTrainingHours,
                atRiskUserCount: atRiskUsers.length,
                highPotentialUserCount: highPotentialUsers.length,
                keyAreaCount: keyAreas.length,
            },
            topPerformers,
            worstPerformers,
            mostFailedTests: passFail.mostFailed,
            mostPassedTests: passFail.mostPassed,
            branchComparison,
            atRiskUsers,
            highPotentialUsers,
            keyAreas,
            effectivenessTrends,
            generatedAt: new Date(),
            timeframe,
        };
    }

    /** Top or worst performers by average knowledge score. */
    async getPerformers(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminPerformerDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.resolveWindow(filters);
        const order: AdminReportSortOrder =
            filters.order === 'asc' ? 'asc' : 'desc';
        const limit = this.resolveLimit(filters.limit);

        const query = this.buildScopedResultsQuery(orgId, filters.branchId)
            .innerJoin('result.user', 'user')
            .leftJoin('user.branchId', 'userBranch')
            .andWhere('result.calculatedAt >= :start', { start: window.start })
            .andWhere('result.calculatedAt < :end', { end: window.end })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
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
            .having('COUNT(result.resultId) >= :minResults', {
                minResults: MIN_RESULTS_FOR_RANKING,
            })
            .orderBy('averageScore', order === 'asc' ? 'ASC' : 'DESC')
            .limit(limit);

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            averageScore: string;
            resultsCount: string;
            passedCount: string;
        }>();

        return rows.map(row => this.mapPerformer(row));
    }

    /** Current training hours per user for a month (default: current UTC month). */
    async getTrainingHours(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminTrainingHoursUserDto[]> {
        const orgId = this.requireOrg(scope);
        const yearMonth = filters.yearMonth ?? this.currentYearMonth();
        const { monthStartDate, monthEndDate } =
            this.getMonthDateStrings(yearMonth);
        const limit = this.resolveLimit(filters.limit ?? 50);

        const query = this.sessionRepository
            .createQueryBuilder('session')
            .innerJoin(User, 'user', 'user.id = session.userId')
            .leftJoin('user.branchId', 'userBranch')
            .where('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate >= :monthStartDate', {
                monthStartDate,
            })
            .andWhere('session.activityDate < :monthEndDate', { monthEndDate })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('session.userId', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('MAX(userBranch.name)', 'branchName')
            .addSelect('SUM(session.durationMinutes)', 'totalMinutes')
            .addSelect('COUNT(session.id)', 'sessionCount')
            .groupBy('session.userId')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .orderBy('totalMinutes', 'DESC')
            .limit(limit);

        if (filters.branchId) {
            query.andWhere('session.branchId = :branchId', {
                branchId: filters.branchId,
            });
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            totalMinutes: string;
            sessionCount: string;
        }>();

        return rows.map(row => {
            const totalMinutes = Number(row.totalMinutes) || 0;
            return {
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                branchName: row.branchName ?? null,
                totalMinutes,
                totalHours: this.minutesToHours(totalMinutes),
                sessionCount: Number(row.sessionCount) || 0,
            };
        });
    }

    /** Top failed and passed tests by volume / rate. */
    async getPassFailRanking(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<{
        mostFailed: AdminTestPassFailDto[];
        mostPassed: AdminTestPassFailDto[];
    }> {
        const rankings = await this.getTestRankings(scope, filters);
        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);

        const mostFailed = [...rankings]
            .filter(row => row.failedCount > 0)
            .sort((a, b) => b.failedCount - a.failedCount || a.passRate - b.passRate)
            .slice(0, limit);

        const mostPassed = [...rankings]
            .filter(row => row.passedCount > 0)
            .sort((a, b) => b.passedCount - a.passedCount || b.passRate - a.passRate)
            .slice(0, limit);

        return { mostFailed, mostPassed };
    }

    /** Average pass rate per test and course. */
    async getPassRates(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminPassRateDto[]> {
        const testRows = await this.getTestRankings(scope, filters);
        const courseMap = new Map<
            number,
            {
                title: string;
                totalAttempts: number;
                passedCount: number;
                scoreSum: number;
            }
        >();

        testRows.forEach(row => {
            if (row.courseId == null) {
                return;
            }
            const existing = courseMap.get(row.courseId) ?? {
                title: row.courseTitle ?? `Course ${row.courseId}`,
                totalAttempts: 0,
                passedCount: 0,
                scoreSum: 0,
            };
            existing.totalAttempts += row.totalAttempts;
            existing.passedCount += row.passedCount;
            existing.scoreSum += row.averageScore * row.totalAttempts;
            courseMap.set(row.courseId, existing);
        });

        const testRates: AdminPassRateDto[] = testRows.map(row => ({
            entityType: 'test',
            entityId: row.testId,
            title: row.testTitle,
            totalAttempts: row.totalAttempts,
            passRate: row.passRate,
            averageScore: row.averageScore,
        }));

        const courseRates: AdminPassRateDto[] = Array.from(
            courseMap.entries(),
        ).map(([courseId, stats]) => ({
            entityType: 'course' as const,
            entityId: courseId,
            title: stats.title,
            totalAttempts: stats.totalAttempts,
            passRate:
                stats.totalAttempts > 0
                    ? this.round(
                          (stats.passedCount / stats.totalAttempts) * 100,
                      )
                    : 0,
            averageScore:
                stats.totalAttempts > 0
                    ? this.round(stats.scoreSum / stats.totalAttempts)
                    : 0,
        }));

        return [...courseRates, ...testRates].sort(
            (a, b) => a.passRate - b.passRate,
        );
    }

    /** Highest / lowest knowledge-score improvement vs previous period. */
    async getKnowledgeImprovement(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<{
        highest: AdminKnowledgeImprovementDto[];
        lowest: AdminKnowledgeImprovementDto[];
    }> {
        const improvements = await this.computeImprovements(scope, filters);
        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);

        const highest = [...improvements]
            .sort((a, b) => b.improvementDelta - a.improvementDelta)
            .slice(0, limit);
        const lowest = [...improvements]
            .sort((a, b) => a.improvementDelta - b.improvementDelta)
            .slice(0, limit);

        return { highest, lowest };
    }

    /** Overall and optional branch-scoped leaderboard snapshot. */
    async getLeaderboards(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<{
        overall: AdminLeaderboardEntryDto[];
        byBranch: AdminLeaderboardEntryDto[];
    }> {
        const orgId = this.requireOrg(scope);
        const limit = this.resolveLimit(filters.limit);

        const overallQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.user', 'user')
            .leftJoin('user.branchId', 'userBranch')
            .leftJoin('l.course', 'course')
            .leftJoin('l.orgId', 'org')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('MAX(userBranch.name)', 'branchName')
            .addSelect('SUM(l.totalPoints)', 'totalPoints')
            .addSelect('AVG(l.averageScore)', 'averageScore')
            .addSelect('MIN(l.rank)', 'rank')
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .orderBy('totalPoints', 'DESC')
            .limit(limit);

        if (filters.branchId) {
            overallQuery
                .leftJoin('l.branchId', 'branch')
                .andWhere('branch.id = :branchId', {
                    branchId: filters.branchId,
                });
        }

        const overallRows = await overallQuery.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            totalPoints: string;
            averageScore: string;
            rank: string;
        }>();

        const byBranchQuery = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.user', 'user')
            .leftJoin('user.branchId', 'userBranch')
            .leftJoin('l.course', 'course')
            .leftJoin('l.orgId', 'org')
            .leftJoin('l.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('MAX(COALESCE(branch.name, userBranch.name))', 'branchName')
            .addSelect('SUM(l.totalPoints)', 'totalPoints')
            .addSelect('AVG(l.averageScore)', 'averageScore')
            .addSelect('MIN(l.rank)', 'rank')
            .addSelect('MAX(course.courseId)', 'courseId')
            .addSelect('MAX(course.title)', 'courseTitle')
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .orderBy('totalPoints', 'DESC')
            .limit(limit);

        if (filters.branchId) {
            byBranchQuery.andWhere('branch.id = :branchId', {
                branchId: filters.branchId,
            });
        }

        const byBranchRows = await byBranchQuery.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            totalPoints: string;
            averageScore: string;
            rank: string;
            courseId: string | null;
            courseTitle: string | null;
        }>();

        return {
            overall: overallRows.map((row, index) => ({
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                branchName: row.branchName ?? null,
                totalPoints: this.round(Number(row.totalPoints) || 0),
                averageScore: this.round(Number(row.averageScore) || 0),
                rank: Number(row.rank) || index + 1,
                courseId: null,
                courseTitle: null,
            })),
            byBranch: byBranchRows.map((row, index) => ({
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                branchName: row.branchName ?? null,
                totalPoints: this.round(Number(row.totalPoints) || 0),
                averageScore: this.round(Number(row.averageScore) || 0),
                rank: Number(row.rank) || index + 1,
                courseId: row.courseId ? Number(row.courseId) : null,
                courseTitle: row.courseTitle ?? null,
            })),
        };
    }

    /**
     * Motivation-focused leaderboard datasets.
     *
     * Rankings reflect current cumulative standing (every active learner in
     * the organization, not just the top few). Top scorers and completion
     * totals are scoped to the reporting window so digests stay topical.
     * Nothing here exposes a learner's average score or pass rate.
     */
    async getLeaderboardInsights(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminLeaderboardInsightsDto> {
        const orgId = this.requireOrg(scope);
        const branchId = filters.branchId;
        const window = this.resolveWindow(filters);

        const [roster, pointsByUser, lifetimeTotals, windowTotals, topScorers] =
            await Promise.all([
                this.getLearnerRoster(orgId, branchId),
                this.getLeaderboardPointsByUser(orgId, branchId),
                this.getResultTotalsByUser(orgId, branchId),
                this.getResultTotalsByUser(
                    orgId,
                    branchId,
                    window.start,
                    window.end,
                ),
                this.getTopScorers(
                    orgId,
                    branchId,
                    window.start,
                    window.end,
                    this.resolveLimit(filters.limit ?? TOP_SCORER_LIMIT),
                ),
            ]);

        const fullRankings = this.buildRankings(
            roster,
            pointsByUser,
            lifetimeTotals,
        );

        return {
            fullRankings,
            branchTopPerformers: this.buildBranchTopPerformers(fullRankings),
            topScorers,
            testCompletion: this.summariseTestCompletion(windowTotals),
        };
    }

    /**
     * Learners who still owe tests for a calendar month.
     *
     * Month filter (`filters.yearMonth`, default current UTC month):
     * - Relevant tests are those available during that month (created before
     *   month-end, exam window overlapping the month when scheduled).
     * - Completion is evaluated as of month-end (a July submit still counts
     *   in August so people are not re-flagged after they finish).
     *
     * Two groups:
     * 1. No attempts — never started the test before month-end.
     * 2. Incomplete — only `in_progress` or `expired` attempts (started, never submitted).
     */
    async getTestsNotCompleted(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminTestsNotCompletedReportDto> {
        const orgId = this.requireOrg(scope);
        const yearMonth = filters.yearMonth ?? this.currentYearMonth();
        const { monthStartDate, monthEndDate } =
            this.getMonthDateStrings(yearMonth);
        const monthStart = new Date(`${monthStartDate}T00:00:00.000Z`);
        const monthEnd = new Date(`${monthEndDate}T00:00:00.000Z`);

        const [roster, tests] = await Promise.all([
            this.getLearnerRoster(orgId, filters.branchId),
            this.getTestsAvailableInMonth(
                orgId,
                filters.branchId,
                monthStart,
                monthEnd,
            ),
        ]);

        if (roster.length === 0 || tests.length === 0) {
            return {
                yearMonth,
                monthLabel: this.formatMonthLabel(yearMonth),
                usersWithNoAttempts: [],
                usersWithIncompleteAttempts: [],
            };
        }

        const attemptsByUserAndTest = await this.getAttemptOutcomesByUserAndTest(
            tests.map(test => test.testId),
            monthEnd,
        );

        const usersWithNoAttempts: AdminTestsNotCompletedUserDto[] = [];
        const usersWithIncompleteAttempts: AdminTestsNotCompletedUserDto[] = [];

        for (const learner of roster) {
            const expectedTests = tests.filter(test =>
                this.isTestExpectedForLearner(test, learner.branchId),
            );
            if (expectedTests.length === 0) {
                continue;
            }

            const noAttemptTests: RelevantReportTest[] = [];
            const incompleteTests: RelevantReportTest[] = [];

            for (const test of expectedTests) {
                const key = `${learner.userId}:${test.testId}`;
                const outcome = attemptsByUserAndTest.get(key) ?? 'none';
                if (outcome === 'submitted') {
                    continue;
                }
                if (outcome === 'incomplete') {
                    incompleteTests.push(test);
                } else {
                    noAttemptTests.push(test);
                }
            }

            if (noAttemptTests.length > 0) {
                usersWithNoAttempts.push(
                    this.mapTestsNotCompletedUser(learner, noAttemptTests),
                );
            }
            if (incompleteTests.length > 0) {
                usersWithIncompleteAttempts.push(
                    this.mapTestsNotCompletedUser(learner, incompleteTests),
                );
            }
        }

        return {
            yearMonth,
            monthLabel: this.formatMonthLabel(yearMonth),
            usersWithNoAttempts,
            usersWithIncompleteAttempts,
        };
    }

    /** Per-branch knowledge, pass rate, and training hours. */
    async getBranchComparison(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminBranchComparisonDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.resolveWindow(filters);

        const resultRows = await this.buildScopedResultsQuery(
            orgId,
            filters.branchId,
        )
            .leftJoin('result.branchId', 'branch')
            .andWhere('result.calculatedAt >= :start', { start: window.start })
            .andWhere('result.calculatedAt < :end', { end: window.end })
            .andWhere('branch.id IS NOT NULL')
            .select('branch.id', 'branchId')
            .addSelect('branch.name', 'branchName')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .addSelect('COUNT(DISTINCT result.userId)', 'activeLearners')
            .groupBy('branch.id')
            .addGroupBy('branch.name')
            .getRawMany<{
                branchId: string;
                branchName: string;
                averageScore: string;
                resultsCount: string;
                passedCount: string;
                activeLearners: string;
            }>();

        const yearMonth = filters.yearMonth ?? this.currentYearMonth();
        const { monthStartDate, monthEndDate } =
            this.getMonthDateStrings(yearMonth);

        const sessionQuery = this.sessionRepository
            .createQueryBuilder('session')
            .leftJoin('session.branchId', 'branch')
            .where('session.orgId = :orgId', { orgId })
            .andWhere('session.branchId IS NOT NULL')
            .andWhere('session.activityDate >= :monthStartDate', {
                monthStartDate,
            })
            .andWhere('session.activityDate < :monthEndDate', { monthEndDate })
            .select('branch.id', 'branchId')
            .addSelect('SUM(session.durationMinutes)', 'totalMinutes')
            .groupBy('branch.id');

        if (filters.branchId) {
            sessionQuery.andWhere('session.branchId = :branchId', {
                branchId: filters.branchId,
            });
        }

        const sessionRows = await sessionQuery.getRawMany<{
            branchId: string;
            totalMinutes: string;
        }>();

        const hoursByBranch = new Map(
            sessionRows.map(row => [
                row.branchId,
                this.minutesToHours(Number(row.totalMinutes) || 0),
            ]),
        );

        return resultRows
            .map(row => {
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
                    totalHours: hoursByBranch.get(row.branchId) ?? 0,
                    activeLearners: Number(row.activeLearners) || 0,
                };
            })
            .sort((a, b) => b.averageScore - a.averageScore);
    }

    /** Learners with low engagement and weak / declining scores. */
    async getAtRiskUsers(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminAtRiskUserDto[]> {
        const improvements = await this.computeImprovements(scope, filters);
        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);

        return improvements
            .map(row => {
                const riskReasons: string[] = [];
                if (row.currentAverage <= LOW_SCORE_THRESHOLD) {
                    riskReasons.push('Low knowledge score');
                }
                if (row.improvementDelta <= 0) {
                    riskReasons.push('Stagnant or declining improvement');
                }
                if (row.currentResultsCount <= AT_RISK_MAX_RESULTS) {
                    riskReasons.push('Low engagement');
                }
                return {
                    userId: row.userId,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    branchName: row.branchName,
                    averageScore: row.currentAverage,
                    improvementDelta: row.improvementDelta,
                    resultsCount: row.currentResultsCount,
                    riskReasons,
                };
            })
            .filter(row => row.riskReasons.length >= 2)
            .sort(
                (a, b) =>
                    a.averageScore - b.averageScore ||
                    a.improvementDelta - b.improvementDelta,
            )
            .slice(0, limit);
    }

    /** Learners with strong improvement and high absolute scores. */
    async getHighPotentialUsers(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminHighPotentialUserDto[]> {
        const improvements = await this.computeImprovements(scope, filters);
        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);

        return improvements
            .filter(
                row =>
                    row.improvementDelta >= HIGH_POTENTIAL_IMPROVEMENT &&
                    row.currentAverage >= HIGH_POTENTIAL_SCORE,
            )
            .sort(
                (a, b) =>
                    b.improvementDelta - a.improvementDelta ||
                    b.currentAverage - a.currentAverage,
            )
            .slice(0, limit)
            .map(row => ({
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                branchName: row.branchName,
                averageScore: row.currentAverage,
                improvementDelta: row.improvementDelta,
                resultsCount: row.currentResultsCount,
            }));
    }

    /** Questions with the highest incorrect-answer rates. */
    async getChallengingQuestions(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminChallengingQuestionDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.resolveWindow(filters);
        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);

        const query = this.answerRepository
            .createQueryBuilder('answer')
            .innerJoin('answer.question', 'question')
            .innerJoin('question.test', 'test')
            .innerJoin('answer.organization', 'org')
            .leftJoin('answer.selectedOption', 'wrongOption')
            .where('org.id = :orgId', { orgId })
            .andWhere('answer.createdAt >= :start', { start: window.start })
            .andWhere('answer.createdAt < :end', { end: window.end })
            .andWhere('answer.isMarked = true')
            .select('question.questionId', 'questionId')
            .addSelect('question.questionText', 'questionText')
            .addSelect('test.testId', 'testId')
            .addSelect('test.title', 'testTitle')
            .addSelect('COUNT(answer.answerId)', 'totalAnswers')
            .addSelect(
                'SUM(CASE WHEN answer.isCorrect = false THEN 1 ELSE 0 END)',
                'incorrectCount',
            )
            .groupBy('question.questionId')
            .addGroupBy('question.questionText')
            .addGroupBy('test.testId')
            .addGroupBy('test.title')
            .having('COUNT(answer.answerId) >= 3')
            .orderBy('incorrectCount', 'DESC')
            .limit(limit);

        if (filters.branchId) {
            query
                .leftJoin('answer.branch', 'branch')
                .andWhere('branch.id = :branchId', {
                    branchId: filters.branchId,
                });
        }

        const rows = await query.getRawMany<{
            questionId: string;
            questionText: string;
            testId: string;
            testTitle: string;
            totalAnswers: string;
            incorrectCount: string;
        }>();

        const results: AdminChallengingQuestionDto[] = [];

        for (const row of rows) {
            const totalAnswers = Number(row.totalAnswers) || 0;
            const incorrectCount = Number(row.incorrectCount) || 0;

            const wrongOptionQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoin('answer.selectedOption', 'option')
                .innerJoin('answer.organization', 'org')
                .where('org.id = :orgId', { orgId })
                .andWhere('answer.questionId = :questionId', {
                    questionId: Number(row.questionId),
                })
                .andWhere('answer.isCorrect = false')
                .andWhere('answer.selectedOptionId IS NOT NULL')
                .andWhere('answer.createdAt >= :start', { start: window.start })
                .andWhere('answer.createdAt < :end', { end: window.end })
                .select('option.optionId', 'optionId')
                .addSelect('option.optionText', 'optionText')
                .addSelect('COUNT(*)', 'wrongCount')
                .groupBy('option.optionId')
                .addGroupBy('option.optionText')
                .orderBy('wrongCount', 'DESC')
                .limit(1);

            if (filters.branchId) {
                wrongOptionQuery
                    .leftJoin('answer.branch', 'branch')
                    .andWhere('branch.id = :branchId', {
                        branchId: filters.branchId,
                    });
            }

            const wrongOption = await wrongOptionQuery.getRawOne<{
                optionId: string;
                optionText: string;
            }>();

            results.push({
                questionId: Number(row.questionId),
                questionText: row.questionText,
                testId: Number(row.testId),
                testTitle: row.testTitle,
                totalAnswers,
                incorrectCount,
                incorrectRate:
                    totalAnswers > 0
                        ? this.round((incorrectCount / totalAnswers) * 100)
                        : 0,
                mostCommonWrongOptionId: wrongOption?.optionId
                    ? Number(wrongOption.optionId)
                    : null,
                mostCommonWrongOptionText: wrongOption?.optionText ?? null,
            });
        }

        return results.sort((a, b) => b.incorrectRate - a.incorrectRate);
    }

    /** Courses with the weakest knowledge outcomes. */
    async getSkillGaps(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminSkillGapDto[]> {
        const passRates = await this.getPassRates(scope, filters);
        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);

        return passRates
            .filter(row => row.entityType === 'course' && row.totalAttempts > 0)
            .map(row => {
                let gapSeverity: AdminSkillGapDto['gapSeverity'] = 'low';
                if (
                    row.averageScore <= LOW_SCORE_THRESHOLD ||
                    row.passRate <= HIGH_FAILURE_PASS_RATE
                ) {
                    gapSeverity = 'high';
                } else if (
                    row.averageScore <= 70 ||
                    row.passRate <= 75
                ) {
                    gapSeverity = 'medium';
                }

                return {
                    courseId: row.entityId,
                    courseTitle: row.title,
                    averageScore: row.averageScore,
                    passRate: row.passRate,
                    resultsCount: row.totalAttempts,
                    gapSeverity,
                };
            })
            .filter(row => row.gapSeverity !== 'low')
            .sort((a, b) => a.averageScore - b.averageScore)
            .slice(0, limit);
    }

    /** Auto-detected courses/tests needing more training attention. */
    async getKeyAreas(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminKeyAreaDto[]> {
        const [testRankings, skillGaps, challengingQuestions] =
            await Promise.all([
                this.getTestRankings(scope, filters),
                this.getSkillGaps(scope, {
                    ...filters,
                    limit: this.resolveLimit(filters.limit ?? 20),
                }),
                this.getChallengingQuestions(scope, {
                    ...filters,
                    limit: this.resolveLimit(filters.limit ?? 10),
                }),
            ]);

        const areas: AdminKeyAreaDto[] = [];

        skillGaps.forEach(gap => {
            const signals: string[] = [];
            if (gap.averageScore <= LOW_SCORE_THRESHOLD) {
                signals.push('Low average knowledge score');
            }
            if (gap.passRate <= HIGH_FAILURE_PASS_RATE) {
                signals.push('High failure rate');
            }
            if (gap.gapSeverity === 'high') {
                signals.push('Severe skill gap');
            }

            areas.push({
                areaType: 'course',
                entityId: gap.courseId,
                title: gap.courseTitle,
                averageScore: gap.averageScore,
                failureRate: this.round(100 - gap.passRate),
                signals,
                priorityScore: this.round(
                    (100 - gap.averageScore) * 0.6 +
                        (100 - gap.passRate) * 0.4,
                ),
            });
        });

        testRankings
            .filter(
                row =>
                    row.averageScore <= LOW_SCORE_THRESHOLD ||
                    row.passRate <= HIGH_FAILURE_PASS_RATE,
            )
            .forEach(row => {
                const signals: string[] = [];
                if (row.averageScore <= LOW_SCORE_THRESHOLD) {
                    signals.push('Low average knowledge score');
                }
                if (row.passRate <= HIGH_FAILURE_PASS_RATE) {
                    signals.push('High failure rate');
                }

                areas.push({
                    areaType: 'test',
                    entityId: row.testId,
                    title: row.testTitle,
                    averageScore: row.averageScore,
                    failureRate: this.round(100 - row.passRate),
                    signals,
                    priorityScore: this.round(
                        (100 - row.averageScore) * 0.5 +
                            (100 - row.passRate) * 0.5,
                    ),
                });
            });

        challengingQuestions.forEach(question => {
            areas.push({
                areaType: 'question',
                entityId: question.questionId,
                title: question.questionText.slice(0, 120),
                averageScore: this.round(100 - question.incorrectRate),
                failureRate: question.incorrectRate,
                signals: [
                    'Common incorrect answers',
                    `Test: ${question.testTitle}`,
                ],
                priorityScore: question.incorrectRate,
            });
        });

        const limit = this.resolveLimit(filters.limit ?? OVERVIEW_LIMIT);
        return areas
            .sort((a, b) => b.priorityScore - a.priorityScore)
            .slice(0, limit);
    }

    /** Training effectiveness over time (daily/weekly buckets by timeframe). */
    async getEffectivenessTrends(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<AdminEffectivenessTrendPointDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.resolveWindow(filters);
        // MySQL date bucketing (not Postgres TO_CHAR / DATE_TRUNC)
        const groupExpr =
            window.label === 'week'
                ? 'DATE(result.calculatedAt)'
                : 'YEARWEEK(result.calculatedAt, 1)';

        const rows = await this.buildScopedResultsQuery(orgId, filters.branchId)
            .andWhere('result.calculatedAt >= :start', { start: window.start })
            .andWhere('result.calculatedAt < :end', { end: window.end })
            .select(groupExpr, 'period')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .addSelect('COUNT(DISTINCT result.userId)', 'activeLearners')
            .groupBy(groupExpr)
            .orderBy(groupExpr, 'ASC')
            .getRawMany<{
                period: string;
                averageScore: string;
                resultsCount: string;
                passedCount: string;
                activeLearners: string;
            }>();

        return rows.map(row => {
            const resultsCount = Number(row.resultsCount) || 0;
            const passedCount = Number(row.passedCount) || 0;
            return {
                period: row.period,
                averageScore: this.round(Number(row.averageScore) || 0),
                passRate:
                    resultsCount > 0
                        ? this.round((passedCount / resultsCount) * 100)
                        : 0,
                resultsCount,
                activeLearners: Number(row.activeLearners) || 0,
            };
        });
    }

    // ─── Leaderboard helpers ───────────────────────────────────────────

    /** Every active learner in scope — the base for full org rankings. */
    private async getLearnerRoster(
        orgId: string,
        branchId?: string,
    ): Promise<
        Array<{
            userId: string;
            firstName: string;
            lastName: string;
            branchId: string | null;
            branchName: string | null;
            branchAlias: string | null;
        }>
    > {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .leftJoin('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .andWhere('user.status = :activeStatus', {
                activeStatus: UserStatus.ACTIVE,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('branch.id', 'branchId')
            .addSelect('branch.name', 'branchName')
            // Alias is the short branch code shown in narrow export columns.
            .addSelect('branch.alias', 'branchAlias')
            .orderBy('user.lastName', 'ASC')
            .addOrderBy('user.firstName', 'ASC')
            .limit(MAX_RANKING_ROWS);

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            branchId: string | null;
            branchName: string | null;
            branchAlias: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName,
            lastName: row.lastName,
            branchId: row.branchId ?? null,
            branchName: row.branchName ?? null,
            branchAlias: row.branchAlias ?? null,
        }));
    }

    /**
     * Active tests whose availability overlapped the selected month.
     * Scheduled exams must overlap [monthStart, monthEnd); unscheduled tests
     * are included if they already existed by month-end.
     */
    private async getTestsAvailableInMonth(
        orgId: string,
        branchId: string | undefined,
        monthStart: Date,
        monthEnd: Date,
    ): Promise<RelevantReportTest[]> {
        const query = this.testRepository
            .createQueryBuilder('test')
            .leftJoin('test.orgId', 'org')
            .leftJoin('test.course', 'course')
            .leftJoin('test.branchId', 'testBranch')
            .leftJoin('course.branchId', 'courseBranch')
            .where('org.id = :orgId', { orgId })
            .andWhere('test.isActive = :isActive', { isActive: true })
            .andWhere('test.createdAt < :monthEnd', { monthEnd })
            .andWhere(
                '(test.examStartDate IS NULL OR test.examStartDate < :monthEnd)',
                { monthEnd },
            )
            .andWhere(
                '(test.examEndDate IS NULL OR test.examEndDate >= :monthStart)',
                { monthStart },
            )
            .select('test.testId', 'testId')
            .addSelect('test.title', 'testTitle')
            .addSelect('course.title', 'courseTitle')
            .addSelect('testBranch.id', 'testBranchId')
            .addSelect('courseBranch.id', 'courseBranchId')
            .addSelect('test.examStartDate', 'examStartDate')
            .addSelect('test.examEndDate', 'examEndDate')
            .orderBy('test.title', 'ASC');

        if (branchId) {
            query.andWhere(
                '(testBranch.id = :branchId OR (testBranch.id IS NULL AND (courseBranch.id = :branchId OR courseBranch.id IS NULL)))',
                { branchId },
            );
        }

        const rows = await query.getRawMany<{
            testId: number | string;
            testTitle: string;
            courseTitle: string | null;
            testBranchId: string | null;
            courseBranchId: string | null;
            examStartDate: Date | null;
            examEndDate: Date | null;
        }>();

        return rows.map(row => ({
            testId: Number(row.testId),
            testTitle: row.testTitle,
            courseTitle: row.courseTitle ?? null,
            testBranchId: row.testBranchId ?? null,
            courseBranchId: row.courseBranchId ?? null,
            examStartDate: row.examStartDate ?? null,
            examEndDate: row.examEndDate ?? null,
        }));
    }

    /**
     * Best outcome per user+test using non-voided attempts started before month-end.
     * Submitted wins over incomplete; cancelled-only counts as none.
     */
    private async getAttemptOutcomesByUserAndTest(
        testIds: number[],
        monthEnd: Date,
    ): Promise<Map<string, AttemptOutcome>> {
        if (testIds.length === 0) {
            return new Map();
        }

        const rows = await this.testAttemptRepository
            .createQueryBuilder('attempt')
            .where('attempt.testId IN (:...testIds)', { testIds })
            .andWhere('attempt.voidedByResetId IS NULL')
            .andWhere('attempt.startTime < :monthEnd', { monthEnd })
            .andWhere('attempt.status != :cancelledStatus', {
                cancelledStatus: AttemptStatus.CANCELLED,
            })
            .select('attempt.userId', 'userId')
            .addSelect('attempt.testId', 'testId')
            .addSelect('attempt.status', 'status')
            .getRawMany<{
                userId: string;
                testId: number | string;
                status: AttemptStatus;
            }>();

        const outcomes = new Map<string, AttemptOutcome>();
        for (const row of rows) {
            const key = `${row.userId}:${Number(row.testId)}`;
            const current = outcomes.get(key) ?? 'none';
            if (row.status === AttemptStatus.SUBMITTED) {
                outcomes.set(key, 'submitted');
                continue;
            }
            if (
                current !== 'submitted' &&
                (row.status === AttemptStatus.IN_PROGRESS ||
                    row.status === AttemptStatus.EXPIRED)
            ) {
                outcomes.set(key, 'incomplete');
            }
        }

        return outcomes;
    }

    /** Branch-scoped tests only apply to learners in that branch. */
    private isTestExpectedForLearner(
        test: RelevantReportTest,
        learnerBranchId: string | null,
    ): boolean {
        const requiredBranch = test.testBranchId ?? test.courseBranchId;
        if (!requiredBranch) {
            return true;
        }
        return learnerBranchId === requiredBranch;
    }

    private mapTestsNotCompletedUser(
        learner: {
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
        },
        tests: readonly RelevantReportTest[],
    ): AdminTestsNotCompletedUserDto {
        return {
            userId: learner.userId,
            firstName: learner.firstName,
            lastName: learner.lastName,
            branchName: learner.branchName,
            missedTestCount: tests.length,
            missedTests: tests.map(test => ({
                testId: test.testId,
                testTitle: test.testTitle,
                courseTitle: test.courseTitle,
                examStartDate: test.examStartDate,
                examEndDate: test.examEndDate,
            })),
        };
    }

    private formatMonthLabel(yearMonth: string): string {
        const [year, month] = yearMonth.split('-').map(Number);
        return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-GB', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
        });
    }

    /** Cumulative leaderboard points per learner (drives current rank). */
    private async getLeaderboardPointsByUser(
        orgId: string,
        branchId?: string,
    ): Promise<Map<string, number>> {
        const query = this.leaderboardRepository
            .createQueryBuilder('l')
            .innerJoin('l.user', 'user')
            .leftJoin('l.orgId', 'org')
            .where('org.id = :orgId', { orgId })
            .select('user.id', 'userId')
            .addSelect('SUM(l.totalPoints)', 'totalPoints')
            .groupBy('user.id');

        if (branchId) {
            query
                .leftJoin('user.branchId', 'userBranch')
                .andWhere('userBranch.id = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            userId: string;
            totalPoints: string;
        }>();

        return new Map(
            rows.map(row => [row.userId, Math.round(Number(row.totalPoints) || 0)]),
        );
    }

    /** Completed / passed test counts per learner, optionally window-scoped. */
    private async getResultTotalsByUser(
        orgId: string,
        branchId?: string,
        start?: Date,
        end?: Date,
    ): Promise<Map<string, { testsCompleted: number; testsPassed: number }>> {
        const query = this.buildScopedResultsQuery(orgId, branchId)
            .innerJoin('result.user', 'user')
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('COUNT(result.resultId)', 'testsCompleted')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'testsPassed',
            )
            .groupBy('user.id');

        if (start) {
            query.andWhere('result.calculatedAt >= :start', { start });
        }
        if (end) {
            query.andWhere('result.calculatedAt < :end', { end });
        }

        const rows = await query.getRawMany<{
            userId: string;
            testsCompleted: string;
            testsPassed: string;
        }>();

        return new Map(
            rows.map(row => [
                row.userId,
                {
                    testsCompleted: Number(row.testsCompleted) || 0,
                    testsPassed: Number(row.testsPassed) || 0,
                },
            ]),
        );
    }

    /** Highest single test scores in the window, one entry per learner. */
    private async getTopScorers(
        orgId: string,
        branchId: string | undefined,
        start: Date,
        end: Date,
        limit: number,
    ): Promise<AdminTopScorerDto[]> {
        // Over-fetch so de-duplicating repeat high scorers still fills the list.
        const rows = await this.buildScopedResultsQuery(orgId, branchId)
            .innerJoin('result.user', 'user')
            .innerJoin('result.test', 'test')
            .leftJoin('result.course', 'course')
            .leftJoin('user.branchId', 'userBranch')
            .andWhere('result.calculatedAt >= :start', { start })
            .andWhere('result.calculatedAt < :end', { end })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('userBranch.name', 'branchName')
            .addSelect('userBranch.alias', 'branchAlias')
            .addSelect('test.testId', 'testId')
            .addSelect('test.title', 'testTitle')
            .addSelect('course.title', 'courseTitle')
            .addSelect('result.percentage', 'scorePercentage')
            .addSelect('result.calculatedAt', 'achievedAt')
            .orderBy('result.percentage', 'DESC')
            .addOrderBy('result.calculatedAt', 'DESC')
            .limit(limit * 5)
            .getRawMany<{
                userId: string;
                firstName: string;
                lastName: string;
                branchName: string | null;
                branchAlias: string | null;
                testId: string;
                testTitle: string;
                courseTitle: string | null;
                scorePercentage: string;
                achievedAt: Date | string;
            }>();

        const bestPerUser = new Map<string, AdminTopScorerDto>();
        rows.forEach(row => {
            if (bestPerUser.has(row.userId)) {
                return;
            }
            bestPerUser.set(row.userId, {
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                branchName: row.branchName ?? null,
                branchAlias: row.branchAlias ?? null,
                testId: Number(row.testId),
                testTitle: row.testTitle,
                courseTitle: row.courseTitle ?? null,
                scorePercentage: this.round(Number(row.scorePercentage) || 0),
                achievedAt: new Date(row.achievedAt),
            });
        });

        return Array.from(bestPerUser.values()).slice(0, limit);
    }

    /**
     * Assigns competition ranks (ties share a rank) across the org and again
     * within each branch. Learners with no activity still appear, ranked last.
     */
    private buildRankings(
        roster: Array<{
            userId: string;
            firstName: string;
            lastName: string;
            branchId: string | null;
            branchName: string | null;
            branchAlias: string | null;
        }>,
        pointsByUser: Map<string, number>,
        totalsByUser: Map<string, { testsCompleted: number; testsPassed: number }>,
    ): AdminRankingEntryDto[] {
        const entries: AdminRankingEntryDto[] = roster.map(learner => {
            const totals = totalsByUser.get(learner.userId);
            return {
                userId: learner.userId,
                firstName: learner.firstName,
                lastName: learner.lastName,
                branchId: learner.branchId,
                branchName: learner.branchName,
                branchAlias: learner.branchAlias,
                rank: 0,
                branchRank: 0,
                totalPoints: pointsByUser.get(learner.userId) ?? 0,
                testsCompleted: totals?.testsCompleted ?? 0,
                testsPassed: totals?.testsPassed ?? 0,
            };
        });

        const sorted = entries.sort((a, b) => this.compareRankable(a, b));
        this.assignRanks(sorted, 'rank');

        const byBranch = new Map<string, AdminRankingEntryDto[]>();
        sorted.forEach(entry => {
            const key = entry.branchId ?? 'unassigned';
            const bucket = byBranch.get(key) ?? [];
            bucket.push(entry);
            byBranch.set(key, bucket);
        });
        byBranch.forEach(bucket => {
            this.assignRanks(bucket, 'branchRank');
        });

        return sorted;
    }

    /** Groups ranked learners by branch and keeps each branch's top three. */
    private buildBranchTopPerformers(
        rankings: readonly AdminRankingEntryDto[],
    ): AdminBranchTopPerformersDto[] {
        const byBranch = new Map<string, AdminBranchTopPerformersDto>();

        rankings.forEach(entry => {
            if (!entry.branchId) {
                return;
            }
            const existing = byBranch.get(entry.branchId) ?? {
                branchId: entry.branchId,
                branchName: entry.branchName ?? 'Unnamed branch',
                branchAlias: entry.branchAlias,
                topPerformers: [],
            };
            if (existing.topPerformers.length < BRANCH_TOP_PERFORMER_COUNT) {
                existing.topPerformers.push(entry);
            }
            byBranch.set(entry.branchId, existing);
        });

        return Array.from(byBranch.values())
            .filter(branch => branch.topPerformers.length > 0)
            .sort((a, b) => a.branchName.localeCompare(b.branchName));
    }

    private summariseTestCompletion(
        totalsByUser: Map<string, { testsCompleted: number; testsPassed: number }>,
    ): AdminTestCompletionSummaryDto {
        let totalTestsCompleted = 0;
        let totalTestsPassed = 0;
        totalsByUser.forEach(totals => {
            totalTestsCompleted += totals.testsCompleted;
            totalTestsPassed += totals.testsPassed;
        });
        const participatingLearners = totalsByUser.size;

        return {
            totalTestsCompleted,
            totalTestsPassed,
            participatingLearners,
            averageTestsPerLearner:
                participatingLearners > 0
                    ? this.round(totalTestsCompleted / participatingLearners)
                    : 0,
        };
    }

    private compareRankable(
        a: AdminRankingEntryDto,
        b: AdminRankingEntryDto,
    ): number {
        return (
            b.totalPoints - a.totalPoints ||
            b.testsPassed - a.testsPassed ||
            b.testsCompleted - a.testsCompleted ||
            `${a.lastName} ${a.firstName}`.localeCompare(
                `${b.lastName} ${b.firstName}`,
            )
        );
    }

    /** Competition ranking: equal standings share a rank, the next one skips. */
    private assignRanks(
        sorted: AdminRankingEntryDto[],
        field: 'rank' | 'branchRank',
    ): void {
        let currentRank = 0;
        let previousKey: string | null = null;

        sorted.forEach((entry, index) => {
            const key = this.rankKey(entry);
            if (key !== previousKey) {
                currentRank = index + 1;
                previousKey = key;
            }
            entry[field] = currentRank;
        });
    }

    private rankKey(entry: AdminRankingEntryDto): string {
        return `${entry.totalPoints}|${entry.testsPassed}|${entry.testsCompleted}`;
    }

    // ─── Private helpers ───────────────────────────────────────────────

    private async getTestRankings(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto,
    ): Promise<AdminTestPassFailDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.resolveWindow(filters);

        const rows = await this.buildScopedResultsQuery(orgId, filters.branchId)
            .innerJoin('result.test', 'test')
            .leftJoin('result.course', 'course')
            .andWhere('result.calculatedAt >= :start', { start: window.start })
            .andWhere('result.calculatedAt < :end', { end: window.end })
            .select('test.testId', 'testId')
            .addSelect('test.title', 'testTitle')
            .addSelect('course.courseId', 'courseId')
            .addSelect('course.title', 'courseTitle')
            .addSelect('COUNT(result.resultId)', 'totalAttempts')
            .addSelect(
                'SUM(CASE WHEN result.passed = true THEN 1 ELSE 0 END)',
                'passedCount',
            )
            .addSelect(
                'SUM(CASE WHEN result.passed = false THEN 1 ELSE 0 END)',
                'failedCount',
            )
            .addSelect('AVG(result.percentage)', 'averageScore')
            .groupBy('test.testId')
            .addGroupBy('test.title')
            .addGroupBy('course.courseId')
            .addGroupBy('course.title')
            .having('COUNT(result.resultId) > 0')
            .getRawMany<{
                testId: string;
                testTitle: string;
                courseId: string | null;
                courseTitle: string | null;
                totalAttempts: string;
                passedCount: string;
                failedCount: string;
                averageScore: string;
            }>();

        return rows.map(row => {
            const totalAttempts = Number(row.totalAttempts) || 0;
            const passedCount = Number(row.passedCount) || 0;
            const failedCount = Number(row.failedCount) || 0;
            return {
                testId: Number(row.testId),
                testTitle: row.testTitle,
                courseId: row.courseId ? Number(row.courseId) : null,
                courseTitle: row.courseTitle ?? null,
                totalAttempts,
                passedCount,
                failedCount,
                passRate:
                    totalAttempts > 0
                        ? this.round((passedCount / totalAttempts) * 100)
                        : 0,
                averageScore: this.round(Number(row.averageScore) || 0),
            };
        });
    }

    private async computeImprovements(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto,
    ): Promise<AdminKnowledgeImprovementDto[]> {
        const orgId = this.requireOrg(scope);
        const window = this.resolveWindow(filters);

        const currentRows = await this.averageByUser(
            orgId,
            filters.branchId,
            window.start,
            window.end,
        );
        const previousRows = await this.averageByUser(
            orgId,
            filters.branchId,
            window.previousStart,
            window.previousEnd,
        );

        const previousMap = new Map(
            previousRows.map(row => [row.userId, row]),
        );

        return currentRows.map(current => {
            const previous = previousMap.get(current.userId);
            const previousAverage = previous?.averageScore ?? current.averageScore;
            return {
                userId: current.userId,
                firstName: current.firstName,
                lastName: current.lastName,
                branchName: current.branchName,
                previousAverage: this.round(previousAverage),
                currentAverage: this.round(current.averageScore),
                improvementDelta: this.round(
                    current.averageScore - previousAverage,
                ),
                currentResultsCount: current.resultsCount,
                previousResultsCount: previous?.resultsCount ?? 0,
            };
        });
    }

    private async averageByUser(
        orgId: string,
        branchId: string | undefined,
        start: Date,
        end: Date,
    ): Promise<
        Array<{
            userId: string;
            firstName: string;
            lastName: string;
            branchName: string | null;
            averageScore: number;
            resultsCount: number;
        }>
    > {
        const rows = await this.buildScopedResultsQuery(orgId, branchId)
            .innerJoin('result.user', 'user')
            .leftJoin('user.branchId', 'userBranch')
            .andWhere('result.calculatedAt >= :start', { start })
            .andWhere('result.calculatedAt < :end', { end })
            .andWhere('user.role = :learnerRole', {
                learnerRole: UserRole.USER,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('MAX(userBranch.name)', 'branchName')
            .addSelect('AVG(result.percentage)', 'averageScore')
            .addSelect('COUNT(result.resultId)', 'resultsCount')
            .groupBy('user.id')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .getRawMany<{
                userId: string;
                firstName: string;
                lastName: string;
                branchName: string | null;
                averageScore: string;
                resultsCount: string;
            }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName,
            lastName: row.lastName,
            branchName: row.branchName ?? null,
            averageScore: Number(row.averageScore) || 0,
            resultsCount: Number(row.resultsCount) || 0,
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

    private mapPerformer(row: {
        userId: string;
        firstName: string;
        lastName: string;
        branchName: string | null;
        averageScore: string;
        resultsCount: string;
        passedCount: string;
    }): AdminPerformerDto {
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
    }

    private requireOrg(scope: OrgBranchScope): string {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }
        return scope.orgId;
    }

    private resolveLimit(limit?: number): number {
        return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), 50);
    }

    private resolveWindow(filters: AdminReportFiltersDto): DateWindow {
        const label: AdminReportTimeframe = filters.timeframe ?? 'month';

        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                throw new BadRequestException(
                    'startDate and endDate must be valid ISO dates',
                );
            }
            if (end <= start) {
                throw new BadRequestException(
                    'endDate must be after startDate',
                );
            }
            const durationMs = end.getTime() - start.getTime();
            return {
                start,
                end,
                previousStart: new Date(start.getTime() - durationMs),
                previousEnd: start,
                label,
            };
        }

        const end = new Date();
        const start = new Date(end);
        if (label === 'week') {
            start.setUTCDate(start.getUTCDate() - 7);
        } else {
            start.setUTCMonth(start.getUTCMonth() - 1);
        }

        const durationMs = end.getTime() - start.getTime();
        return {
            start,
            end,
            previousStart: new Date(start.getTime() - durationMs),
            previousEnd: start,
            label,
        };
    }

    private currentYearMonth(): string {
        const now = new Date();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        return `${now.getUTCFullYear()}-${month}`;
    }

    private getMonthDateStrings(yearMonth: string): {
        monthStartDate: string;
        monthEndDate: string;
    } {
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
            throw new BadRequestException(
                'yearMonth must be in YYYY-MM format',
            );
        }
        const [year, month] = yearMonth.split('-').map(Number);
        if (month < 1 || month > 12) {
            throw new BadRequestException('yearMonth month must be 1-12');
        }
        const monthEnd = new Date(Date.UTC(year, month, 1));
        const pad = (value: number): string => String(value).padStart(2, '0');
        return {
            monthStartDate: `${year}-${pad(month)}-01`,
            monthEndDate: `${monthEnd.getUTCFullYear()}-${pad(
                monthEnd.getUTCMonth() + 1,
            )}-01`,
        };
    }

    private round(value: number): number {
        return Math.round(value * 10) / 10;
    }

    private minutesToHours(minutes: number): number {
        return this.round(minutes / MINUTES_PER_HOUR);
    }
}
