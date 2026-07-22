import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { AdminOverviewReportDto } from '../dto/admin-insights.dto';

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

/**
 * Builds CSV and PDF summaries from admin overview payloads.
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
     * Builds a multi-page PDF summary suitable for email attachment.
     */
    async buildOverviewPdf(
        overview: AdminOverviewReportDto,
        reportTitle = 'ProTrain Admin Report',
    ): Promise<AdminReportPdfAttachment> {
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

        doc.fillColor('#413DFB')
            .fontSize(20)
            .text(reportTitle, { align: 'left' });
        doc.moveDown(0.4);
        doc.fillColor('#6b7280')
            .fontSize(10)
            .text(
                `Timeframe: ${overview.timeframe}  ·  Generated: ${overview.generatedAt.toISOString()}`,
            );
        doc.moveDown(1);

        this.writePdfHeading(doc, 'Key performance indicators');
        this.writePdfKpiGrid(doc, [
            ['Avg knowledge score', `${overview.kpis.averageKnowledgeScore}%`],
            ['Pass rate', `${overview.kpis.overallPassRate}%`],
            ['Active learners', String(overview.kpis.activeLearners)],
            ['Training hours', `${overview.kpis.totalTrainingHours}h`],
            ['At-risk users', String(overview.kpis.atRiskUserCount)],
            [
                'High-potential users',
                String(overview.kpis.highPotentialUserCount),
            ],
            ['Key areas', String(overview.kpis.keyAreaCount)],
            ['Total results', String(overview.kpis.totalResults)],
        ]);

        this.writePdfHeading(doc, 'Top performers');
        this.writePdfPeopleList(
            doc,
            overview.topPerformers.slice(0, 10).map(p => ({
                name: `${p.firstName} ${p.lastName}`,
                detail: `${p.branchName ?? 'No branch'} · ${p.averageScore}% · pass ${p.passRate}%`,
            })),
        );

        this.writePdfHeading(doc, 'Needs support');
        this.writePdfPeopleList(
            doc,
            overview.worstPerformers.slice(0, 8).map(p => ({
                name: `${p.firstName} ${p.lastName}`,
                detail: `${p.branchName ?? 'No branch'} · ${p.averageScore}% · pass ${p.passRate}%`,
            })),
        );

        this.writePdfHeading(doc, 'Key areas needing training');
        this.writePdfPeopleList(
            doc,
            overview.keyAreas.slice(0, 10).map(area => ({
                name: area.title,
                detail: `${area.areaType} · failure ${area.failureRate}% · avg ${area.averageScore}%`,
            })),
        );

        this.writePdfHeading(doc, 'Branch comparison');
        this.writePdfPeopleList(
            doc,
            overview.branchComparison.slice(0, 12).map(b => ({
                name: b.branchName,
                detail: `avg ${b.averageScore}% · pass ${b.passRate}% · ${b.totalHours}h · ${b.activeLearners} learners`,
            })),
        );

        this.writePdfHeading(doc, 'High-potential shout-outs');
        this.writePdfPeopleList(
            doc,
            overview.highPotentialUsers.slice(0, 8).map(p => ({
                name: `${p.firstName} ${p.lastName}`,
                detail: `${p.branchName ?? 'No branch'} · ${p.averageScore}% · Δ ${p.improvementDelta >= 0 ? '+' : ''}${p.improvementDelta}`,
            })),
        );

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
     * Builds richer motivational digest lines for email templates.
     */
    buildMotivationalDigest(overview: AdminOverviewReportDto): {
        leaderboardLines: string[];
        risingStarsLines: string[];
        branchChampionLines: string[];
        celebrationHeadline: string;
    } {
        const leaderboardLines = overview.topPerformers
            .slice(0, 8)
            .map((person, index) => {
                const branch = person.branchName
                    ? ` · ${person.branchName}`
                    : '';
                return `${index + 1}. ${person.firstName} ${person.lastName}${branch} — ${person.averageScore}% (pass ${person.passRate}%)`;
            });

        const risingStarsLines = overview.highPotentialUsers
            .slice(0, 5)
            .map(person => {
                const delta =
                    person.improvementDelta >= 0
                        ? `+${person.improvementDelta}`
                        : String(person.improvementDelta);
                return `${person.firstName} ${person.lastName} — ${person.averageScore}% (improvement ${delta})`;
            });

        const sortedBranches = [...overview.branchComparison].sort(
            (a, b) => b.averageScore - a.averageScore,
        );
        const branchChampionLines = sortedBranches.slice(0, 3).map(branch => {
            return `${branch.branchName} — avg ${branch.averageScore}% · pass ${branch.passRate}% · ${branch.activeLearners} learners`;
        });

        const topName = overview.topPerformers[0]
            ? `${overview.topPerformers[0].firstName} ${overview.topPerformers[0].lastName}`
            : null;
        const celebrationHeadline = topName
            ? `Celebrate ${topName} and this period’s learning champions`
            : 'Celebrate this period’s learning champions';

        return {
            leaderboardLines,
            risingStarsLines,
            branchChampionLines,
            celebrationHeadline,
        };
    }

    private writePdfHeading(
        doc: PDFKit.PDFDocument,
        title: string,
    ): void {
        doc.moveDown(0.6);
        if (doc.y > 720) {
            doc.addPage();
        }
        doc.fillColor('#111827').fontSize(13).text(title);
        doc.moveDown(0.3);
        doc
            .strokeColor('#ede9fe')
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
    ): void {
        if (rows.length === 0) {
            doc.fontSize(10).fillColor('#6b7280').text('No data for this period.');
            return;
        }
        rows.forEach(row => {
            if (doc.y > 740) {
                doc.addPage();
            }
            doc.fontSize(10)
                .fillColor('#111827')
                .text(row.name, { continued: false });
            doc.fontSize(9)
                .fillColor('#6b7280')
                .text(row.detail);
            doc.moveDown(0.25);
        });
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
