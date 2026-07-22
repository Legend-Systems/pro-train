import { Injectable } from '@nestjs/common';
import type { AdminOverviewReportDto } from '../dto/admin-insights.dto';

/** CSV attachment payload for admin report emails. */
export interface AdminReportCsvAttachment {
    filename: string;
    content: string;
    contentType: string;
    rowCount: number;
}

/**
 * Builds CSV summaries from admin overview payloads.
 * PDF generation is intentionally deferred (Phase 5).
 */
@Injectable()
export class ReportExportService {
    /**
     * Flattens overview KPIs and key lists into a multi-section CSV string.
     */
    buildOverviewCsv(overview: AdminOverviewReportDto): AdminReportCsvAttachment {
        const lines: string[] = [];
        const stamp = new Date().toISOString().slice(0, 10);

        lines.push('Section,Metric,Value');
        lines.push(
            this.row('KPIs', 'Average knowledge score', overview.kpis.averageKnowledgeScore),
        );
        lines.push(
            this.row('KPIs', 'Overall pass rate', overview.kpis.overallPassRate),
        );
        lines.push(this.row('KPIs', 'Total results', overview.kpis.totalResults));
        lines.push(
            this.row('KPIs', 'Active learners', overview.kpis.activeLearners),
        );
        lines.push(
            this.row('KPIs', 'Training hours', overview.kpis.totalTrainingHours),
        );
        lines.push(
            this.row('KPIs', 'At-risk users', overview.kpis.atRiskUserCount),
        );
        lines.push(
            this.row(
                'KPIs',
                'High-potential users',
                overview.kpis.highPotentialUserCount,
            ),
        );
        lines.push(this.row('KPIs', 'Key areas', overview.kpis.keyAreaCount));
        lines.push('');

        lines.push('Section,Name,Branch,AverageScore,PassRate,Results');
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
        lines.push('');

        lines.push('Section,Test,Course,Failed,Passed,PassRate,AverageScore');
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
        lines.push('');

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

        const content = lines.join('\n');
        const rowCount = lines.filter(line => line.length > 0 && !line.startsWith('Section,')).length;

        return {
            filename: `protrain-admin-report-${stamp}.csv`,
            content,
            contentType: 'text/csv; charset=utf-8',
            rowCount,
        };
    }

    private row(...cells: Array<string | number>): string {
        return cells.map(cell => this.escapeCsv(String(cell))).join(',');
    }

    private escapeCsv(value: string): string {
        if (/[",\n]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }
}
