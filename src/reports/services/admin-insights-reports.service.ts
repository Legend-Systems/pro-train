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
import { User, UserRole } from '../../user/entities/user.entity';
import {
    AdminAtRiskUserDto,
    AdminBranchComparisonDto,
    AdminChallengingQuestionDto,
    AdminEffectivenessTrendPointDto,
    AdminHighPotentialUserDto,
    AdminKeyAreaDto,
    AdminKnowledgeImprovementDto,
    AdminLeaderboardEntryDto,
    AdminOverviewReportDto,
    AdminPassRateDto,
    AdminPerformerDto,
    AdminReportFiltersDto,
    AdminReportSortOrder,
    AdminReportTimeframe,
    AdminSkillGapDto,
    AdminTestPassFailDto,
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

/** Date window derived from timeframe or explicit start/end. */
interface DateWindow {
    start: Date;
    end: Date;
    previousStart: Date;
    previousEnd: Date;
    label: AdminReportTimeframe;
}

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
