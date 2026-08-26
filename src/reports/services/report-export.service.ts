import { Injectable } from '@nestjs/common';
// pdfkit uses CommonJS (`module.exports = PDFDocument`); default import breaks at runtime
// without esModuleInterop — use `import = require` so `new PDFDocument()` works in Nest.
import PDFDocument = require('pdfkit');
import type {
    AdminOverviewReportDto,
    AdminRankingEntryDto,
} from '../dto/admin-insights.dto';
import {
    DEFAULT_REPORT_SECTIONS,
    isMotivationalSelection,
    ReportSection,
} from '../constants/report-sections.constant';

/** CSV attachment payload for admin report emails. */
export interface AdminReportCsvAttachment {
    filename: string;
    content: string;
    contentType: string;
    rowCount: number;
}

/** PDF attachment payload for admin report emails. */
export interface AdminReportPdfAttachment {
    filename: string;
    content: Buffer;
    contentType: string;
    pageCount: number;
}

/** Motivational copy blocks injected into the report email body. */
export interface AdminReportDigest {
    leaderboardLines: string[];
    risingStarsLines: string[];
    branchChampionLines: string[];
    celebrationHeadline: string;
}

/** Per-block visibility flags consumed by the admin report email template. */
export interface AdminReportEmailVisibility {
    showAverageKnowledgeScore: boolean;
    showOverallPassRate: boolean;
    showActiveLearners: boolean;
    showTrainingHours: boolean;
    showAttentionSummary: boolean;
    showTestCompletion: boolean;
}

/**
 * Person-row rendering mode.
 *
 * `motivational` reports celebrate participation, so rows carry rank and tests
 * completed instead of an average score that could expose a weak performer.
 */
interface PersonRowStyle {
    isMotivational: boolean;
    rankByUserId: Map<string, AdminRankingEntryDto>;
}

/** Y position past which a new PDF page is started before writing. */
const PDF_PAGE_BREAK_Y = 720;

/** Y position past which a list row starts a new page. */
const PDF_ROW_BREAK_Y = 740;

/** Rankings are chunked so a huge org does not produce an unreadable wall. */
const PDF_RANKING_PAGE_BREAK_Y = 745;

/**
 * Fixed column geometry for the PDF rankings table, in points.
 *
 * Header and body rows share these values so the two can never drift apart.
 * Widths add up to the A4 content width (595.28pt page less 48pt margins), so
 * the right-most column stays inside the margin.
 */
const RANKING_COLUMNS = {
    rank: { x: 48, width: 30 },
    firstName: { x: 78, width: 140 },
    lastName: { x: 218, width: 130 },
    branch: { x: 348, width: 135 },
    tests: { x: 483, width: 64 },
} as const;

/**
 * Builds CSV and PDF summaries from admin overview payloads.
 *
 * Every section is opt-in: callers pass the resolved `ReportSection` list so a
 * leaderboard-only report never renders diagnostic sections such as
 * "Needs support" or "Key areas needing training".
 */
@Injectable()
export class ReportExportService {
    /**
     * Flattens the selected sections into a multi-section CSV string.
     * Leaderboard rows intentionally omit average score and pass rate.
     */
    buildOverviewCsv(
        overview: AdminOverviewReportDto,
        sections: readonly ReportSection[] = DEFAULT_REPORT_SECTIONS,
    ): AdminReportCsvAttachment {
        const selected = new Set(sections);
        const style = this.buildPersonRowStyle(overview, sections);
        const lines: string[] = [];
        const stamp = new Date().toISOString().slice(0, 10);

        this.appendKpiCsv(lines, overview, selected);
        this.appendRankingsCsv(lines, overview, selected);
        this.appendBranchTopPerformersCsv(lines, overview, selected);
        this.appendTopScorersCsv(lines, overview, selected);
        this.appendPerformerCsv(lines, overview, selected, style);
        this.appendTestCsv(lines, overview, selected);
        this.appendTestsNotCompletedCsv(lines, overview, selected);
        this.appendAttemptsResultsBreakdownCsv(lines, overview, selected);
        this.appendKeyAreaCsv(lines, overview, selected);
        this.appendBranchComparisonCsv(lines, overview, selected);

        const content = lines.join('\n');
        const rowCount = lines.filter(
            line => line.length > 0 && !line.startsWith('Section,'),
        ).length;

        return {
            filename: `protrain-admin-report-${stamp}.csv`,
            content,
            contentType: 'text/csv; charset=utf-8',
            rowCount,
        };
    }

    /**
     * Builds a multi-page PDF containing only the selected sections.
     */
    async buildOverviewPdf(
        overview: AdminOverviewReportDto,
        reportTitle = 'ProTrain Admin Report',
        sections: readonly ReportSection[] = DEFAULT_REPORT_SECTIONS,
    ): Promise<AdminReportPdfAttachment> {
        const selected = new Set(sections);
        const style = this.buildPersonRowStyle(overview, sections);
        const stamp = new Date().toISOString().slice(0, 10);
        const doc = new PDFDocument({
            margin: 48,
            size: 'A4',
            info: {
                Title: reportTitle,
                Author: 'ProTrain',
                Subject: `Admin training insights (${overview.timeframe})`,
            },
        });

        const chunks: Buffer[] = [];
        let pageCount = 1;

        doc.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });
        doc.on('pageAdded', () => {
            pageCount += 1;
        });

        const done = new Promise<Buffer>((resolve, reject) => {
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
        });

        this.writePdfTitle(doc, reportTitle, overview);
        this.writePdfKpiSection(doc, overview, selected);
        this.writePdfCompletionSection(doc, overview, selected);
        this.writePdfTopScorersSection(doc, overview, selected);
        this.writePdfBranchTopPerformersSection(doc, overview, selected);
        this.writePdfRankingsSection(doc, overview, selected);
        this.writePdfTopPerformersSection(doc, overview, selected, style);
        this.writePdfHighPotentialSection(doc, overview, selected, style);
        this.writePdfBranchComparisonSection(doc, overview, selected);
        this.writePdfTestSections(doc, overview, selected);
        this.writePdfTestsNotCompletedSection(doc, overview, selected);
        this.writePdfAttemptsResultsBreakdownSection(doc, overview, selected);
        this.writePdfNeedsSupportSection(doc, overview, selected);
        this.writePdfKeyAreasSection(doc, overview, selected);

        doc.end();
        const content = await done;

        return {
            filename: `protrain-admin-report-${stamp}.pdf`,
            content,
            contentType: 'application/pdf',
            pageCount,
        };
    }

    /**
     * Builds motivational digest lines for the email body.
     * Leaderboard lines use rank + tests completed rather than scores.
     */
    buildMotivationalDigest(
        overview: AdminOverviewReportDto,
        sections: readonly ReportSection[] = DEFAULT_REPORT_SECTIONS,
    ): AdminReportDigest {
        const selected = new Set(sections);

        const leaderboardLines = selected.has(ReportSection.LEADERBOARD_RANKINGS)
            ? (overview.fullRankings ?? []).slice(0, 8).map(entry => {
                  const branch =
                      entry.branchAlias ?? entry.branchName
                          ? ` · ${this.branchLabel(entry)}`
                          : '';
                  return `#${entry.rank} ${entry.firstName} ${entry.lastName}${branch} — ${entry.testsCompleted} tests completed, ${entry.testsPassed} passed`;
              })
            : [];

        const risingStarsLines = selected.has(ReportSection.HIGH_POTENTIAL_USERS)
            ? overview.highPotentialUsers.slice(0, 5).map(person => {
                  const delta =
                      person.improvementDelta >= 0
                          ? `+${person.improvementDelta}`
                          : String(person.improvementDelta);
                  return `${person.firstName} ${person.lastName} — improvement ${delta}`;
              })
            : [];

        const branchChampionLines = selected.has(
            ReportSection.BRANCH_TOP_PERFORMERS,
        )
            ? (overview.branchTopPerformers ?? []).slice(0, 6).map(branch => {
                  const names = branch.topPerformers
                      .map(
                          person =>
                              `${person.firstName} ${person.lastName} (#${person.branchRank})`,
                      )
                      .join(', ');
                  return `${this.branchLabel(branch)} — ${names}`;
              })
            : [];

        return {
            leaderboardLines,
            risingStarsLines,
            branchChampionLines,
            celebrationHeadline: this.buildCelebrationHeadline(
                overview,
                selected,
            ),
        };
    }

    /**
     * Maps selected sections onto email-template visibility flags so the
     * emailed summary matches the attached PDF/CSV exactly.
     */
    buildEmailVisibility(
        sections: readonly ReportSection[] = DEFAULT_REPORT_SECTIONS,
    ): AdminReportEmailVisibility {
        const selected = new Set(sections);
        const hasOverview = selected.has(ReportSection.ADMIN_OVERVIEW);

        return {
            showAverageKnowledgeScore:
                hasOverview &&
                selected.has(ReportSection.KPI_AVERAGE_KNOWLEDGE_SCORE),
            showOverallPassRate:
                hasOverview && selected.has(ReportSection.KPI_OVERALL_PASS_RATE),
            showActiveLearners:
                hasOverview && selected.has(ReportSection.KPI_ACTIVE_LEARNERS),
            showTrainingHours:
                hasOverview && selected.has(ReportSection.KPI_TRAINING_HOURS),
            showAttentionSummary:
                selected.has(ReportSection.KPI_AT_RISK_USERS) ||
                selected.has(ReportSection.KPI_KEY_AREAS),
            showTestCompletion: selected.has(ReportSection.TEST_COMPLETION),
        };
    }

    // ─── CSV sections ──────────────────────────────────────────────────

    private appendKpiCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.ADMIN_OVERVIEW)) {
            return;
        }

        const kpiRows: Array<[ReportSection, string, number]> = [
            [
                ReportSection.KPI_AVERAGE_KNOWLEDGE_SCORE,
                'Average knowledge score',
                overview.kpis.averageKnowledgeScore,
            ],
            [
                ReportSection.KPI_OVERALL_PASS_RATE,
                'Overall pass rate',
                overview.kpis.overallPassRate,
            ],
            [
                ReportSection.KPI_TOTAL_RESULTS,
                'Total results',
                overview.kpis.totalResults,
            ],
            [
                ReportSection.KPI_ACTIVE_LEARNERS,
                'Active learners',
                overview.kpis.activeLearners,
            ],
            [
                ReportSection.KPI_TRAINING_HOURS,
                'Training hours',
                overview.kpis.totalTrainingHours,
            ],
            [
                ReportSection.KPI_AT_RISK_USERS,
                'At-risk users',
                overview.kpis.atRiskUserCount,
            ],
            [
                ReportSection.KPI_HIGH_POTENTIAL_USERS,
                'High-potential users',
                overview.kpis.highPotentialUserCount,
            ],
            [
                ReportSection.KPI_KEY_AREAS,
                'Key areas',
                overview.kpis.keyAreaCount,
            ],
        ].filter(([section]) =>
            selected.has(section as ReportSection),
        ) as Array<[ReportSection, string, number]>;

        if (kpiRows.length === 0) {
            return;
        }

        lines.push('Section,Metric,Value');
        kpiRows.forEach(([, label, value]) => {
            lines.push(this.row('KPIs', label, value));
        });

        if (
            selected.has(ReportSection.TEST_COMPLETION) &&
            overview.testCompletion
        ) {
            lines.push(
                this.row(
                    'KPIs',
                    'Tests completed this period',
                    overview.testCompletion.totalTestsCompleted,
                ),
            );
            lines.push(
                this.row(
                    'KPIs',
                    'Tests passed this period',
                    overview.testCompletion.totalTestsPassed,
                ),
            );
            lines.push(
                this.row(
                    'KPIs',
                    'Average tests per learner',
                    overview.testCompletion.averageTestsPerLearner,
                ),
            );
        }

        lines.push('');
    }

    private appendRankingsCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        const rankings = overview.fullRankings ?? [];
        if (
            !selected.has(ReportSection.LEADERBOARD_RANKINGS) ||
            rankings.length === 0
        ) {
            return;
        }

        // Rank-focused columns only — no average score or pass rate.
        lines.push(
            'Section,Rank,Name,Surname,Branch,BranchRank,Points,TestsCompleted,TestsPassed',
        );
        rankings.forEach(entry => {
            lines.push(
                this.row(
                    'Full rankings',
                    entry.rank,
                    entry.firstName,
                    entry.lastName,
                    this.branchLabel(entry),
                    entry.branchRank,
                    entry.totalPoints,
                    entry.testsCompleted,
                    entry.testsPassed,
                ),
            );
        });
        lines.push('');
    }

    private appendBranchTopPerformersCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        const branches = overview.branchTopPerformers ?? [];
        if (
            !selected.has(ReportSection.BRANCH_TOP_PERFORMERS) ||
            branches.length === 0
        ) {
            return;
        }

        lines.push(
            'Section,Branch,BranchRank,Name,Surname,Points,TestsCompleted,TestsPassed',
        );
        branches.forEach(branch => {
            branch.topPerformers.forEach(person => {
                lines.push(
                    this.row(
                        'Branch top 3',
                        this.branchLabel(branch),
                        person.branchRank,
                        person.firstName,
                        person.lastName,
                        person.totalPoints,
                        person.testsCompleted,
                        person.testsPassed,
                    ),
                );
            });
        });
        lines.push('');
    }

    private appendTopScorersCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        const topScorers = overview.topScorers ?? [];
        if (!selected.has(ReportSection.TOP_SCORERS) || topScorers.length === 0) {
            return;
        }

        lines.push('Section,Name,Surname,Branch,Test,Course,HighestScore');
        topScorers.forEach(scorer => {
            lines.push(
                this.row(
                    'Highest test scores',
                    scorer.firstName,
                    scorer.lastName,
                    this.branchLabel(scorer),
                    scorer.testTitle,
                    scorer.courseTitle ?? '',
                    scorer.scorePercentage,
                ),
            );
        });
        lines.push('');
    }

    private appendPerformerCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
        style: PersonRowStyle,
    ): void {
        const showTop = selected.has(ReportSection.TOP_PERFORMERS);
        const showSupport = selected.has(ReportSection.NEEDS_SUPPORT);
        const showAtRisk = selected.has(ReportSection.AT_RISK_USERS);
        const showHighPotential = selected.has(ReportSection.HIGH_POTENTIAL_USERS);

        if (!showTop && !showSupport && !showAtRisk && !showHighPotential) {
            return;
        }

        if (style.isMotivational) {
            this.appendMotivationalPerformerCsv(lines, overview, selected, style);
            return;
        }

        lines.push('Section,Name,Branch,AverageScore,PassRate,Results');
        if (showTop) {
            overview.topPerformers.forEach(p => {
                lines.push(
                    this.row(
                        'Top performers',
                        `${p.firstName} ${p.lastName}`,
                        p.branchName ?? '',
                        p.averageScore,
                        p.passRate,
                        p.resultsCount,
                    ),
                );
            });
        }
        if (showHighPotential) {
            overview.highPotentialUsers.forEach(p => {
                lines.push(
                    this.row(
                        'High potential',
                        `${p.firstName} ${p.lastName}`,
                        p.branchName ?? '',
                        p.averageScore,
                        p.improvementDelta,
                        p.resultsCount,
                    ),
                );
            });
        }
        if (showSupport) {
            overview.worstPerformers.forEach(p => {
                lines.push(
                    this.row(
                        'Needs support',
                        `${p.firstName} ${p.lastName}`,
                        p.branchName ?? '',
                        p.averageScore,
                        p.passRate,
                        p.resultsCount,
                    ),
                );
            });
        }
        if (showAtRisk) {
            overview.atRiskUsers.forEach(p => {
                lines.push(
                    this.row(
                        'At risk',
                        `${p.firstName} ${p.lastName}`,
                        p.branchName ?? '',
                        p.averageScore,
                        p.improvementDelta,
                        p.resultsCount,
                    ),
                );
            });
        }
        lines.push('');
    }

    /**
     * Recognition rows for leaderboard reports: rank, branch and tests only.
     * Diagnostic groups never reach here — they are stripped from the selection.
     */
    private appendMotivationalPerformerCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
        style: PersonRowStyle,
    ): void {
        lines.push(
            'Section,Rank,Name,Surname,Branch,TestsCompleted,TestsPassed',
        );

        const append = (
            section: string,
            people: ReadonlyArray<{
                userId: string;
                firstName: string;
                lastName: string;
                branchName?: string | null;
            }>,
        ): void => {
            people.forEach(person => {
                const ranking = style.rankByUserId.get(person.userId);
                lines.push(
                    this.row(
                        section,
                        ranking?.rank ?? '',
                        person.firstName,
                        person.lastName,
                        this.branchLabel(ranking ?? person),
                        ranking?.testsCompleted ?? 0,
                        ranking?.testsPassed ?? 0,
                    ),
                );
            });
        };

        if (selected.has(ReportSection.TOP_PERFORMERS)) {
            append('Top performers', overview.topPerformers);
        }
        if (selected.has(ReportSection.HIGH_POTENTIAL_USERS)) {
            append('High potential', overview.highPotentialUsers);
        }
        lines.push('');
    }

    private appendTestCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        const showFailed = selected.has(ReportSection.MOST_FAILED_TESTS);
        const showPassed = selected.has(ReportSection.MOST_PASSED_TESTS);
        if (!showFailed && !showPassed) {
            return;
        }

        lines.push('Section,Test,Course,Failed,Passed,PassRate,AverageScore');
        if (showPassed) {
            overview.mostPassedTests.forEach(t => {
                lines.push(
                    this.row(
                        'Most passed tests',
                        t.testTitle,
                        t.courseTitle ?? '',
                        t.failedCount,
                        t.passedCount,
                        t.passRate,
                        t.averageScore,
                    ),
                );
            });
        }
        if (showFailed) {
            overview.mostFailedTests.forEach(t => {
                lines.push(
                    this.row(
                        'Most failed tests',
                        t.testTitle,
                        t.courseTitle ?? '',
                        t.failedCount,
                        t.passedCount,
                        t.passRate,
                        t.averageScore,
                    ),
                );
            });
        }
        lines.push('');
    }

    /**
     * Two CSV blocks for the selected calendar month:
     * users who never started, then users who started but did not submit.
     */
    private appendTestsNotCompletedCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.TESTS_NOT_COMPLETED)) {
            return;
        }

        const report = overview.testsNotCompleted;
        const monthLabel = report?.monthLabel ?? 'Unknown month';

        this.appendTestsNotCompletedCsvGroup(
            lines,
            `Users who made no attempts (${monthLabel})`,
            report?.usersWithNoAttempts ?? [],
            monthLabel,
        );
        this.appendTestsNotCompletedCsvGroup(
            lines,
            `Users who did not complete attempts (${monthLabel})`,
            report?.usersWithIncompleteAttempts ?? [],
            monthLabel,
        );
    }

    private appendTestsNotCompletedCsvGroup(
        lines: string[],
        sectionName: string,
        users: ReadonlyArray<{
            firstName: string;
            lastName: string;
            branchName: string | null;
            missedTestCount: number;
            missedTests: ReadonlyArray<{
                testTitle: string;
                courseTitle: string | null;
                examStartDate: Date | null;
                examEndDate: Date | null;
            }>;
        }>,
        monthLabel: string,
    ): void {
        lines.push(
            'Section,Month,Name,Surname,Branch,TestTitle,Course,ExamStart,ExamEnd,MissedTestCount',
        );

        if (users.length === 0) {
            lines.push(
                this.row(sectionName, monthLabel, '', '', '', '', '', '', '', 0),
            );
            lines.push('');
            return;
        }

        users.forEach(user => {
            user.missedTests.forEach(test => {
                lines.push(
                    this.row(
                        sectionName,
                        monthLabel,
                        user.firstName,
                        user.lastName,
                        user.branchName ?? '',
                        test.testTitle,
                        test.courseTitle ?? '',
                        this.formatOptionalDate(test.examStartDate),
                        this.formatOptionalDate(test.examEndDate),
                        user.missedTestCount,
                    ),
                );
            });
        });
        lines.push('');
    }

    /**
     * Three CSV blocks for the attempts/results breakdown:
     * 1. Learner header (name, branch, overall stats)
     * 2. Per-test summary (counts, average, improvement)
     * 3. Individual results and incomplete attempts
     */
    private appendAttemptsResultsBreakdownCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.TEST_ATTEMPTS_RESULTS_BREAKDOWN)) {
            return;
        }

        const report = overview.attemptsResultsBreakdown;
        const learners = report?.learners ?? [];

        lines.push(
            'Section,Name,Surname,Branch,TestsParticipated,TotalAttempts,TotalResults,Passed,Failed,OverallPassRate,OverallAverageScore',
        );
        if (learners.length === 0) {
            lines.push(
                this.row(
                    'Test attempts & results — learners',
                    '',
                    '',
                    '',
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                ),
            );
        } else {
            learners.forEach(learner => {
                lines.push(
                    this.row(
                        'Test attempts & results — learners',
                        learner.firstName,
                        learner.lastName,
                        learner.branchName ?? '',
                        learner.testsParticipated,
                        learner.totalAttempts,
                        learner.totalResults,
                        learner.passedCount,
                        learner.failedCount,
                        learner.overallPassRate,
                        learner.overallAverageScore,
                    ),
                );
            });
        }
        lines.push('');

        lines.push(
            'Section,Name,Surname,Branch,TestTitle,Course,TotalAttempts,TotalResults,Passed,Failed,AverageScore,BestScore,WorstScore,FirstScore,LastScore,ScoreDelta,AttemptsToPass,ImprovementTrend,HoursBetweenFirstAndLast',
        );
        if (learners.length === 0) {
            lines.push(
                this.row(
                    'Test attempts & results — tests',
                    '',
                    '',
                    '',
                    '',
                    '',
                    0,
                    0,
                    0,
                    0,
                    0,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ),
            );
        } else {
            learners.forEach(learner => {
                learner.tests.forEach(test => {
                    lines.push(
                        this.row(
                            'Test attempts & results — tests',
                            learner.firstName,
                            learner.lastName,
                            learner.branchName ?? '',
                            test.testTitle,
                            test.courseTitle ?? '',
                            test.totalAttempts,
                            test.totalResults,
                            test.passedCount,
                            test.failedCount,
                            test.averageScore,
                            test.bestScore ?? '',
                            test.worstScore ?? '',
                            test.firstScore ?? '',
                            test.lastScore ?? '',
                            test.scoreDelta ?? '',
                            test.attemptsToPass ?? '',
                            this.trendLabel(test.improvementTrend),
                            test.hoursBetweenFirstAndLast ?? '',
                        ),
                    );
                });
            });
        }
        lines.push('');

        lines.push(
            'Section,Name,Surname,Branch,TestTitle,Kind,AttemptNumber,Score,Percentage,Outcome,DateTime,MaxScore,ProgressPercentage',
        );
        if (learners.length === 0) {
            lines.push(
                this.row(
                    'Test attempts & results — detail',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                ),
            );
            lines.push('');
            return;
        }

        learners.forEach(learner => {
            learner.tests.forEach(test => {
                test.results.forEach(result => {
                    lines.push(
                        this.row(
                            'Test attempts & results — detail',
                            learner.firstName,
                            learner.lastName,
                            learner.branchName ?? '',
                            test.testTitle,
                            'Result',
                            result.attemptNumber,
                            result.score,
                            result.percentage,
                            result.passed ? 'Passed' : 'Failed',
                            this.formatDateTimeUtc(result.submittedAt),
                            result.maxScore,
                            '',
                        ),
                    );
                });
                test.incompleteAttempts.forEach(attempt => {
                    lines.push(
                        this.row(
                            'Test attempts & results — detail',
                            learner.firstName,
                            learner.lastName,
                            learner.branchName ?? '',
                            test.testTitle,
                            'Incomplete attempt',
                            attempt.attemptNumber,
                            '',
                            '',
                            attempt.status === 'expired'
                                ? 'Expired'
                                : 'In progress',
                            this.formatDateTimeUtc(attempt.startTime),
                            '',
                            attempt.progressPercentage,
                        ),
                    );
                });
            });
        });
        lines.push('');
    }

    private appendKeyAreaCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.KEY_AREAS)) {
            return;
        }

        lines.push('Section,Title,Type,FailureRate,AverageScore,Signals');
        overview.keyAreas.forEach(area => {
            lines.push(
                this.row(
                    'Key areas',
                    area.title,
                    area.areaType,
                    area.failureRate,
                    area.averageScore,
                    area.signals.join('; '),
                ),
            );
        });
        lines.push('');
    }

    private appendBranchComparisonCsv(
        lines: string[],
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.BRANCH_COMPARISON)) {
            return;
        }

        lines.push('Section,Branch,AverageScore,PassRate,Hours,Learners');
        overview.branchComparison.forEach(b => {
            lines.push(
                this.row(
                    'Branch comparison',
                    b.branchName,
                    b.averageScore,
                    b.passRate,
                    b.totalHours,
                    b.activeLearners,
                ),
            );
        });
    }

    // ─── PDF sections ──────────────────────────────────────────────────

    private writePdfTitle(
        doc: PDFKit.PDFDocument,
        reportTitle: string,
        overview: AdminOverviewReportDto,
    ): void {
        doc.fillColor('#413DFB').fontSize(20).text(reportTitle, { align: 'left' });
        doc.moveDown(0.4);
        const monthSuffix = overview.testsNotCompleted?.monthLabel
            ? `  ·  Month: ${overview.testsNotCompleted.monthLabel}`
            : '';
        doc.fillColor('#6b7280')
            .fontSize(10)
            .text(
                `Timeframe: ${overview.timeframe}${monthSuffix}  ·  Generated: ${overview.generatedAt.toISOString()}`,
            );
        doc.moveDown(1);
    }

    private writePdfKpiSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.ADMIN_OVERVIEW)) {
            return;
        }

        const items: Array<[string, string]> = [];
        const push = (
            section: ReportSection,
            label: string,
            value: string,
        ): void => {
            if (selected.has(section)) {
                items.push([label, value]);
            }
        };

        push(
            ReportSection.KPI_AVERAGE_KNOWLEDGE_SCORE,
            'Avg knowledge score',
            `${overview.kpis.averageKnowledgeScore}%`,
        );
        push(
            ReportSection.KPI_OVERALL_PASS_RATE,
            'Pass rate',
            `${overview.kpis.overallPassRate}%`,
        );
        push(
            ReportSection.KPI_ACTIVE_LEARNERS,
            'Active learners',
            String(overview.kpis.activeLearners),
        );
        push(
            ReportSection.KPI_TRAINING_HOURS,
            'Training hours',
            `${overview.kpis.totalTrainingHours}h`,
        );
        push(
            ReportSection.KPI_AT_RISK_USERS,
            'At-risk users',
            String(overview.kpis.atRiskUserCount),
        );
        push(
            ReportSection.KPI_HIGH_POTENTIAL_USERS,
            'High-potential users',
            String(overview.kpis.highPotentialUserCount),
        );
        push(
            ReportSection.KPI_KEY_AREAS,
            'Key areas',
            String(overview.kpis.keyAreaCount),
        );
        push(
            ReportSection.KPI_TOTAL_RESULTS,
            'Total results',
            String(overview.kpis.totalResults),
        );

        if (items.length === 0) {
            return;
        }

        this.writePdfHeading(doc, 'Key performance indicators');
        this.writePdfKpiGrid(doc, items);
    }

    private writePdfCompletionSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (
            !selected.has(ReportSection.TEST_COMPLETION) ||
            !overview.testCompletion
        ) {
            return;
        }

        const completion = overview.testCompletion;
        this.writePdfHeading(doc, 'Training activity this period');
        this.writePdfKpiGrid(doc, [
            ['Tests completed', String(completion.totalTestsCompleted)],
            ['Tests passed', String(completion.totalTestsPassed)],
            ['Learners taking part', String(completion.participatingLearners)],
            [
                'Average tests per learner',
                String(completion.averageTestsPerLearner),
            ],
        ]);
    }

    private writePdfTopScorersSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.TOP_SCORERS)) {
            return;
        }

        this.writePdfHeading(doc, 'Highest test scores');
        this.writePdfPeopleList(
            doc,
            (overview.topScorers ?? []).map(scorer => ({
                name: `${scorer.firstName} ${scorer.lastName} — ${scorer.scorePercentage}%`,
                detail: `${scorer.testTitle}${scorer.courseTitle ? ` · ${scorer.courseTitle}` : ''} · ${this.branchLabel(scorer)}`,
            })),
            'No test scores recorded for this period yet.',
        );
    }

    private writePdfBranchTopPerformersSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.BRANCH_TOP_PERFORMERS)) {
            return;
        }

        const branches = overview.branchTopPerformers ?? [];
        this.writePdfHeading(doc, 'Top 3 per branch');

        if (branches.length === 0) {
            doc.fontSize(10)
                .fillColor('#6b7280')
                .text('No branch rankings available yet.');
            return;
        }

        branches.forEach(branch => {
            if (doc.y > PDF_ROW_BREAK_Y) {
                doc.addPage();
            }
            doc.fontSize(11)
                .fillColor('#413DFB')
                .text(this.branchLabel(branch));
            branch.topPerformers.forEach(person => {
                if (doc.y > PDF_ROW_BREAK_Y) {
                    doc.addPage();
                }
                doc.fontSize(10)
                    .fillColor('#111827')
                    .text(
                        `  #${person.branchRank}  ${person.firstName} ${person.lastName}`,
                    );
                doc.fontSize(9)
                    .fillColor('#6b7280')
                    .text(
                        `      ${person.testsCompleted} tests completed · ${person.testsPassed} passed`,
                    );
            });
            doc.moveDown(0.4);
        });
    }

    private writePdfRankingsSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.LEADERBOARD_RANKINGS)) {
            return;
        }

        const rankings = overview.fullRankings ?? [];
        this.writePdfHeading(doc, 'Full rankings');

        if (rankings.length === 0) {
            doc.fontSize(10)
                .fillColor('#6b7280')
                .text('No learners are ranked yet.');
            return;
        }

        this.writeRankingTableHeader(doc);
        rankings.forEach(entry => {
            if (doc.y > PDF_RANKING_PAGE_BREAK_Y) {
                doc.addPage();
                this.writeRankingTableHeader(doc);
            }
            this.writeRankingRow(doc, entry);
        });
    }

    private writePdfTopPerformersSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
        style: PersonRowStyle,
    ): void {
        if (!selected.has(ReportSection.TOP_PERFORMERS)) {
            return;
        }

        this.writePdfHeading(doc, 'Top performers');
        this.writePdfPeopleList(
            doc,
            overview.topPerformers.slice(0, 10).map(p => ({
                name: `${p.firstName} ${p.lastName}`,
                detail: style.isMotivational
                    ? this.motivationalDetail(p, style)
                    : `${p.branchName ?? 'No branch'} · ${p.averageScore}% · pass ${p.passRate}%`,
            })),
        );
    }

    private writePdfHighPotentialSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
        style: PersonRowStyle,
    ): void {
        if (!selected.has(ReportSection.HIGH_POTENTIAL_USERS)) {
            return;
        }

        this.writePdfHeading(doc, 'High-potential shout-outs');
        this.writePdfPeopleList(
            doc,
            overview.highPotentialUsers.slice(0, 8).map(p => ({
                name: `${p.firstName} ${p.lastName}`,
                detail: style.isMotivational
                    ? this.motivationalDetail(p, style)
                    : `${p.branchName ?? 'No branch'} · improvement ${p.improvementDelta >= 0 ? '+' : ''}${p.improvementDelta}`,
            })),
        );
    }

    private writePdfBranchComparisonSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.BRANCH_COMPARISON)) {
            return;
        }

        this.writePdfHeading(doc, 'Branch comparison');
        this.writePdfPeopleList(
            doc,
            overview.branchComparison.slice(0, 12).map(b => ({
                name: b.branchName,
                detail: `avg ${b.averageScore}% · pass ${b.passRate}% · ${b.totalHours}h · ${b.activeLearners} learners`,
            })),
        );
    }

    private writePdfTestSections(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (selected.has(ReportSection.MOST_PASSED_TESTS)) {
            this.writePdfHeading(doc, 'Most passed tests');
            this.writePdfPeopleList(
                doc,
                overview.mostPassedTests.slice(0, 10).map(t => ({
                    name: t.testTitle,
                    detail: `${t.courseTitle ?? 'Unassigned course'} · ${t.passedCount} passed · pass ${t.passRate}%`,
                })),
            );
        }

        if (selected.has(ReportSection.MOST_FAILED_TESTS)) {
            this.writePdfHeading(doc, 'Most failed tests');
            this.writePdfPeopleList(
                doc,
                overview.mostFailedTests.slice(0, 10).map(t => ({
                    name: t.testTitle,
                    detail: `${t.courseTitle ?? 'Unassigned course'} · ${t.failedCount} failed · pass ${t.passRate}%`,
                })),
            );
        }
    }

    /**
     * PDF counterpart of the tests-not-completed metric: two labelled groups
     * for the selected month, each listing name, surname, branch, and titles.
     */
    private writePdfTestsNotCompletedSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.TESTS_NOT_COMPLETED)) {
            return;
        }

        const report = overview.testsNotCompleted;
        const monthLabel = report?.monthLabel ?? 'Unknown month';

        this.writePdfHeading(
            doc,
            `Tests not completed (Month: ${monthLabel})`,
        );
        this.writePdfTestsNotCompletedGroup(
            doc,
            'Users who made no attempts',
            report?.usersWithNoAttempts ?? [],
        );
        this.writePdfTestsNotCompletedGroup(
            doc,
            'Users who did not complete their attempts (expired / in progress)',
            report?.usersWithIncompleteAttempts ?? [],
        );
    }

    private writePdfTestsNotCompletedGroup(
        doc: PDFKit.PDFDocument,
        heading: string,
        users: ReadonlyArray<{
            firstName: string;
            lastName: string;
            branchName: string | null;
            missedTests: ReadonlyArray<{ testTitle: string }>;
        }>,
    ): void {
        if (doc.y > PDF_PAGE_BREAK_Y) {
            doc.addPage();
        }
        doc.fillColor('#413DFB').fontSize(11).text(heading);
        doc.moveDown(0.35);

        if (users.length === 0) {
            doc.fontSize(10)
                .fillColor('#6b7280')
                .text('No learners in this group for the selected month.');
            doc.moveDown(0.6);
            return;
        }

        users.forEach(user => {
            if (doc.y > PDF_ROW_BREAK_Y) {
                doc.addPage();
            }
            const branch = user.branchName ?? 'No branch';
            doc.fontSize(10)
                .fillColor('#111827')
                .text(`${user.firstName} ${user.lastName} | ${branch}`);
            user.missedTests.forEach(test => {
                if (doc.y > PDF_ROW_BREAK_Y) {
                    doc.addPage();
                }
                doc.fontSize(9)
                    .fillColor('#6b7280')
                    .text(`  ${test.testTitle}`);
            });
            doc.moveDown(0.35);
        });
        doc.moveDown(0.3);
    }

    /**
     * Nested PDF layout: learner header, then each test with counts and
     * every individual result (score, pass/fail, date/time).
     */
    private writePdfAttemptsResultsBreakdownSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.TEST_ATTEMPTS_RESULTS_BREAKDOWN)) {
            return;
        }

        this.writePdfHeading(doc, 'Test attempts & results breakdown');
        const learners = overview.attemptsResultsBreakdown?.learners ?? [];

        if (learners.length === 0) {
            doc.fontSize(10)
                .fillColor('#6b7280')
                .text(
                    'No learners with attempts or results in the selected window.',
                );
            doc.moveDown(0.6);
            return;
        }

        learners.forEach(learner => {
            if (doc.y > PDF_PAGE_BREAK_Y) {
                doc.addPage();
            }
            const branch = learner.branchName ?? 'No branch';
            doc.fontSize(11)
                .fillColor('#111827')
                .text(
                    `${learner.firstName} ${learner.lastName} | ${branch}`,
                );
            doc.fontSize(8)
                .fillColor('#6b7280')
                .text(
                    `Tests: ${learner.testsParticipated}  ·  Attempts: ${learner.totalAttempts}  ·  Results: ${learner.totalResults}  ·  Passed: ${learner.passedCount}  ·  Failed: ${learner.failedCount}  ·  Pass rate: ${learner.overallPassRate}%  ·  Avg: ${learner.overallAverageScore}%`,
                );
            doc.moveDown(0.2);

            learner.tests.forEach(test => {
                if (doc.y > PDF_ROW_BREAK_Y) {
                    doc.addPage();
                }
                doc.fontSize(10)
                    .fillColor('#413DFB')
                    .text(test.testTitle);
                const insightParts = [
                    `Attempts: ${test.totalAttempts}`,
                    `Results: ${test.totalResults}`,
                    `Passed: ${test.passedCount}`,
                    `Failed: ${test.failedCount}`,
                    `Avg: ${test.averageScore}%`,
                ];
                if (test.attemptsToPass !== null) {
                    insightParts.push(
                        `Attempts to pass: ${test.attemptsToPass}`,
                    );
                }
                if (test.scoreDelta !== null) {
                    insightParts.push(
                        `Delta: ${test.scoreDelta > 0 ? '+' : ''}${test.scoreDelta}pp`,
                    );
                }
                insightParts.push(this.trendLabel(test.improvementTrend));
                doc.fontSize(8)
                    .fillColor('#6b7280')
                    .text(insightParts.join('  ·  '));

                test.results.forEach((result, index) => {
                    if (doc.y > PDF_ROW_BREAK_Y) {
                        doc.addPage();
                    }
                    const outcome = result.passed ? 'Passed' : 'Failed';
                    doc.fontSize(9)
                        .fillColor('#111827')
                        .text(
                            `  Result ${index + 1} – ${result.percentage}% (${outcome}) – ${this.formatDateTimeUtc(result.submittedAt)}`,
                        );
                });
                test.incompleteAttempts.forEach(attempt => {
                    if (doc.y > PDF_ROW_BREAK_Y) {
                        doc.addPage();
                    }
                    const statusLabel =
                        attempt.status === 'expired'
                            ? 'Expired'
                            : 'In progress';
                    doc.fontSize(9)
                        .fillColor('#6b7280')
                        .text(
                            `  Attempt ${attempt.attemptNumber} – ${statusLabel} – ${this.formatDateTimeUtc(attempt.startTime)}`,
                        );
                });
                doc.moveDown(0.25);
            });
            doc.moveDown(0.35);
        });
        doc.moveDown(0.2);
    }

    private writePdfNeedsSupportSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (selected.has(ReportSection.NEEDS_SUPPORT)) {
            this.writePdfHeading(doc, 'Needs support');
            this.writePdfPeopleList(
                doc,
                overview.worstPerformers.slice(0, 8).map(p => ({
                    name: `${p.firstName} ${p.lastName}`,
                    detail: `${p.branchName ?? 'No branch'} · ${p.averageScore}% · pass ${p.passRate}%`,
                })),
            );
        }

        if (selected.has(ReportSection.AT_RISK_USERS)) {
            this.writePdfHeading(doc, 'At-risk learners');
            this.writePdfPeopleList(
                doc,
                overview.atRiskUsers.slice(0, 8).map(p => ({
                    name: `${p.firstName} ${p.lastName}`,
                    detail: `${p.branchName ?? 'No branch'} · ${p.riskReasons.join(' · ')}`,
                })),
            );
        }
    }

    private writePdfKeyAreasSection(
        doc: PDFKit.PDFDocument,
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): void {
        if (!selected.has(ReportSection.KEY_AREAS)) {
            return;
        }

        this.writePdfHeading(doc, 'Key areas needing training');
        this.writePdfPeopleList(
            doc,
            overview.keyAreas.slice(0, 10).map(area => ({
                name: area.title,
                detail: `${area.areaType} · failure ${area.failureRate}% · avg ${area.averageScore}%`,
            })),
        );
    }

    // ─── PDF primitives ────────────────────────────────────────────────

    private writeRankingTableHeader(doc: PDFKit.PDFDocument): void {
        const y = doc.y;
        doc.fontSize(9).fillColor('#6b7280');
        this.writeRankingCell(doc, '#', RANKING_COLUMNS.rank, y);
        this.writeRankingCell(doc, 'Name', RANKING_COLUMNS.firstName, y);
        this.writeRankingCell(doc, 'Surname', RANKING_COLUMNS.lastName, y);
        this.writeRankingCell(doc, 'Branch', RANKING_COLUMNS.branch, y);
        this.writeRankingCell(doc, 'Tests', RANKING_COLUMNS.tests, y, 'right');
        doc.moveDown(0.4);
        doc.strokeColor('#ede9fe')
            .moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .stroke();
        doc.moveDown(0.3);
    }

    private writeRankingRow(
        doc: PDFKit.PDFDocument,
        entry: AdminRankingEntryDto,
    ): void {
        const y = doc.y;
        doc.fontSize(9.5).fillColor('#111827');
        this.writeRankingCell(doc, `#${entry.rank}`, RANKING_COLUMNS.rank, y);
        this.writeRankingCell(doc, entry.firstName, RANKING_COLUMNS.firstName, y);
        this.writeRankingCell(doc, entry.lastName, RANKING_COLUMNS.lastName, y);
        doc.fillColor('#6b7280');
        this.writeRankingCell(
            doc,
            this.branchLabel(entry),
            RANKING_COLUMNS.branch,
            y,
        );
        doc.fillColor('#111827');
        this.writeRankingCell(
            doc,
            `${entry.testsPassed}/${entry.testsCompleted}`,
            RANKING_COLUMNS.tests,
            y,
            'right',
        );
        doc.moveDown(0.35);
    }

    /**
     * Writes one fixed-width table cell on a single line.
     *
     * The value is truncated to the measured column width before drawing, so a
     * long value (a branch with no alias, say) cannot wrap and push the row
     * into the one below it.
     */
    private writeRankingCell(
        doc: PDFKit.PDFDocument,
        value: string,
        column: { x: number; width: number },
        y: number,
        align: 'left' | 'right' = 'left',
    ): void {
        doc.text(this.truncateToWidth(doc, value, column.width), column.x, y, {
            width: column.width,
            align,
            lineBreak: false,
        });
    }

    /** Trims a string until it fits `width`, marking the cut with an ellipsis. */
    private truncateToWidth(
        doc: PDFKit.PDFDocument,
        value: string,
        width: number,
    ): string {
        if (doc.widthOfString(value) <= width) {
            return value;
        }

        let truncated = value;
        while (
            truncated.length > 1 &&
            doc.widthOfString(`${truncated}…`) > width
        ) {
            truncated = truncated.slice(0, -1);
        }
        return `${truncated.trimEnd()}…`;
    }

    /**
     * Decides how person rows are rendered and indexes the rankings so any
     * section can show a learner's rank and test totals without re-querying.
     */
    private buildPersonRowStyle(
        overview: AdminOverviewReportDto,
        sections: readonly ReportSection[],
    ): PersonRowStyle {
        return {
            isMotivational: isMotivationalSelection(sections),
            rankByUserId: new Map(
                (overview.fullRankings ?? []).map(entry => [entry.userId, entry]),
            ),
        };
    }

    /**
     * Compact branch label for exports.
     *
     * Full branch names (e.g. "TZANEEN - BRADEIRENSE INTERNATIONAL TRADING
     * (PTY) LTD") wrap over several lines and collide with neighbouring rows in
     * the fixed-width PDF rankings table, so the short alias wins wherever it
     * exists. Falls back to the full name for branches with no alias set.
     */
    private branchLabel(source: {
        branchAlias?: string | null;
        branchName?: string | null;
    }): string {
        return source.branchAlias ?? source.branchName ?? 'No branch';
    }

    /** Rank + branch + tests, with no score that could embarrass a learner. */
    private motivationalDetail(
        person: { userId: string; branchName?: string | null },
        style: PersonRowStyle,
    ): string {
        const ranking = style.rankByUserId.get(person.userId);
        if (!ranking) {
            return this.branchLabel(person);
        }
        return `Rank #${ranking.rank} · ${this.branchLabel(ranking)} · ${ranking.testsPassed}/${ranking.testsCompleted} tests passed`;
    }

    private writePdfHeading(doc: PDFKit.PDFDocument, title: string): void {
        doc.moveDown(0.6);
        if (doc.y > PDF_PAGE_BREAK_Y) {
            doc.addPage();
        }
        doc.fillColor('#111827').fontSize(13).text(title, doc.page.margins.left);
        doc.moveDown(0.3);
        doc.strokeColor('#ede9fe')
            .moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .stroke();
        doc.moveDown(0.5);
    }

    private writePdfKpiGrid(
        doc: PDFKit.PDFDocument,
        items: Array<[string, string]>,
    ): void {
        doc.fontSize(10).fillColor('#374151');
        items.forEach(([label, value]) => {
            doc.text(`${label}: `, { continued: true, width: 480 })
                .fillColor('#111827')
                .text(value);
            doc.fillColor('#374151');
        });
    }

    private writePdfPeopleList(
        doc: PDFKit.PDFDocument,
        rows: Array<{ name: string; detail: string }>,
        emptyMessage = 'No data for this period.',
    ): void {
        if (rows.length === 0) {
            doc.fontSize(10).fillColor('#6b7280').text(emptyMessage);
            return;
        }
        rows.forEach(row => {
            if (doc.y > PDF_ROW_BREAK_Y) {
                doc.addPage();
            }
            doc.fontSize(10)
                .fillColor('#111827')
                .text(row.name, { continued: false });
            doc.fontSize(9).fillColor('#6b7280').text(row.detail);
            doc.moveDown(0.25);
        });
    }

    // ─── Shared helpers ────────────────────────────────────────────────

    private buildCelebrationHeadline(
        overview: AdminOverviewReportDto,
        selected: Set<ReportSection>,
    ): string {
        const leader = selected.has(ReportSection.LEADERBOARD_RANKINGS)
            ? overview.fullRankings?.[0]
            : undefined;
        if (leader) {
            return `Celebrate ${leader.firstName} ${leader.lastName} and this period’s learning champions`;
        }

        const topPerformer = selected.has(ReportSection.TOP_PERFORMERS)
            ? overview.topPerformers[0]
            : undefined;
        if (topPerformer) {
            return `Celebrate ${topPerformer.firstName} ${topPerformer.lastName} and this period’s learning champions`;
        }

        return 'Celebrate this period’s learning champions';
    }

    private row(...cells: Array<string | number>): string {
        return cells.map(cell => this.escapeCsv(String(cell))).join(',');
    }

    private formatOptionalDate(value: Date | string | null | undefined): string {
        if (!value) {
            return '';
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return date.toISOString().slice(0, 10);
    }

    /** UTC date and time for result/attempt rows (`2026-08-12 09:14`). */
    private formatDateTimeUtc(value: Date | string): string {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const hours = String(date.getUTCHours()).padStart(2, '0');
        const minutes = String(date.getUTCMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    private trendLabel(trend: string): string {
        if (trend === 'improving') {
            return 'Improving';
        }
        if (trend === 'declining') {
            return 'Declining';
        }
        if (trend === 'stable') {
            return 'Stable';
        }
        return 'Insufficient data';
    }

    private escapeCsv(value: string): string {
        if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
