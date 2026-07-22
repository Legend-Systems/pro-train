import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import { CommunicationsService } from '../../communications/communications.service';
import { User } from '../../user/entities/user.entity';
import {
    CreateReportScheduleDto,
    GenerateAdminReportDto,
    GenerateAdminReportResultDto,
    ReportRunResponseDto,
    ReportScheduleResponseDto,
    SetReportScheduleActiveDto,
    UpdateReportScheduleDto,
} from '../dto/report-schedule.dto';
import { AdminReportFiltersDto } from '../dto/admin-insights.dto';
import {
    ReportSchedule,
    ReportScheduleFrequency,
} from '../entities/report-schedule.entity';
import { ReportRun, ReportRunStatus } from '../entities/report-run.entity';
import { AdminInsightsReportsService } from './admin-insights-reports.service';
import { ReportExportService } from './report-export.service';

/** Minutes between cron ticks — used when aligning nextRunAt. */
const CRON_LOOKAHEAD_MS = 15 * 60 * 1000;

/**
 * CRUD + execution for admin report schedules.
 * Inactive schedules never queue emails.
 */
@Injectable()
export class ReportScheduleService {
    private readonly logger = new Logger(ReportScheduleService.name);

    constructor(
        @InjectRepository(ReportSchedule)
        private readonly scheduleRepository: Repository<ReportSchedule>,
        @InjectRepository(ReportRun)
        private readonly runRepository: Repository<ReportRun>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly adminInsightsReportsService: AdminInsightsReportsService,
        private readonly reportExportService: ReportExportService,
        private readonly communicationsService: CommunicationsService,
    ) {}

    async create(
        scope: OrgBranchScope,
        dto: CreateReportScheduleDto,
    ): Promise<ReportScheduleResponseDto> {
        const orgId = this.requireOrg(scope);
        this.assertHasRecipients(dto);

        const schedule = this.scheduleRepository.create({
            orgId,
            createdByUserId: scope.userId,
            name: dto.name,
            reportTypes: dto.reportTypes,
            filters: dto.filters ?? null,
            frequency: dto.frequency,
            dayOfWeek:
                dto.frequency === ReportScheduleFrequency.WEEKLY
                    ? (dto.dayOfWeek ?? 1)
                    : null,
            dayOfMonth:
                dto.frequency === ReportScheduleFrequency.MONTHLY
                    ? (dto.dayOfMonth ?? 1)
                    : null,
            timeUtc: dto.timeUtc,
            timezone: dto.timezone ?? 'UTC',
            recipientUserIds: dto.recipientUserIds ?? null,
            recipientEmails: dto.recipientEmails ?? null,
            recipientRoles: dto.recipientRoles ?? null,
            includeCsv: dto.includeCsv ?? true,
            includePdf: dto.includePdf ?? false,
            includeMotivationalLeaderboard:
                dto.includeMotivationalLeaderboard ?? false,
            isActive: dto.isActive ?? true,
            nextRunAt: this.computeNextRunAt({
                frequency: dto.frequency,
                dayOfWeek: dto.dayOfWeek ?? 1,
                dayOfMonth: dto.dayOfMonth ?? 1,
                timeUtc: dto.timeUtc,
                from: new Date(),
            }),
        });

        const saved = await this.scheduleRepository.save(schedule);
        return this.toScheduleDto(saved);
    }

    async findAll(scope: OrgBranchScope): Promise<ReportScheduleResponseDto[]> {
        const orgId = this.requireOrg(scope);
        const rows = await this.scheduleRepository.find({
            where: { orgId },
            order: { createdAt: 'DESC' },
        });
        return rows.map(row => this.toScheduleDto(row));
    }

    async findOne(
        scope: OrgBranchScope,
        id: string,
    ): Promise<ReportScheduleResponseDto> {
        return this.toScheduleDto(await this.getOwnedSchedule(scope, id));
    }

    async update(
        scope: OrgBranchScope,
        id: string,
        dto: UpdateReportScheduleDto,
    ): Promise<ReportScheduleResponseDto> {
        const schedule = await this.getOwnedSchedule(scope, id);
        const merged = { ...schedule, ...dto };

        if (
            dto.recipientUserIds !== undefined ||
            dto.recipientEmails !== undefined ||
            dto.recipientRoles !== undefined
        ) {
            this.assertHasRecipients({
                recipientUserIds:
                    dto.recipientUserIds ?? schedule.recipientUserIds ?? undefined,
                recipientEmails:
                    dto.recipientEmails ?? schedule.recipientEmails ?? undefined,
                recipientRoles:
                    dto.recipientRoles ?? schedule.recipientRoles ?? undefined,
            });
        }

        if (dto.frequency || dto.dayOfWeek !== undefined || dto.dayOfMonth !== undefined || dto.timeUtc) {
            schedule.nextRunAt = this.computeNextRunAt({
                frequency: merged.frequency,
                dayOfWeek: merged.dayOfWeek ?? 1,
                dayOfMonth: merged.dayOfMonth ?? 1,
                timeUtc: merged.timeUtc,
                from: new Date(),
            });
        }

        Object.assign(schedule, {
            name: dto.name ?? schedule.name,
            reportTypes: dto.reportTypes ?? schedule.reportTypes,
            filters: dto.filters !== undefined ? dto.filters : schedule.filters,
            frequency: dto.frequency ?? schedule.frequency,
            dayOfWeek:
                dto.dayOfWeek !== undefined ? dto.dayOfWeek : schedule.dayOfWeek,
            dayOfMonth:
                dto.dayOfMonth !== undefined
                    ? dto.dayOfMonth
                    : schedule.dayOfMonth,
            timeUtc: dto.timeUtc ?? schedule.timeUtc,
            timezone: dto.timezone ?? schedule.timezone,
            recipientUserIds:
                dto.recipientUserIds !== undefined
                    ? dto.recipientUserIds
                    : schedule.recipientUserIds,
            recipientEmails:
                dto.recipientEmails !== undefined
                    ? dto.recipientEmails
                    : schedule.recipientEmails,
            recipientRoles:
                dto.recipientRoles !== undefined
                    ? dto.recipientRoles
                    : schedule.recipientRoles,
            includeCsv:
                dto.includeCsv !== undefined
                    ? dto.includeCsv
                    : schedule.includeCsv,
            includePdf:
                dto.includePdf !== undefined
                    ? dto.includePdf
                    : schedule.includePdf,
            includeMotivationalLeaderboard:
                dto.includeMotivationalLeaderboard !== undefined
                    ? dto.includeMotivationalLeaderboard
                    : schedule.includeMotivationalLeaderboard,
            isActive:
                dto.isActive !== undefined ? dto.isActive : schedule.isActive,
        });

        const saved = await this.scheduleRepository.save(schedule);
        return this.toScheduleDto(saved);
    }

    /**
     * Activates or deactivates a schedule.
     * Inactive schedules are ignored by cron and never send emails.
     */
    async setActive(
        scope: OrgBranchScope,
        id: string,
        dto: SetReportScheduleActiveDto,
    ): Promise<ReportScheduleResponseDto> {
        const schedule = await this.getOwnedSchedule(scope, id);
        schedule.isActive = dto.isActive;
        if (dto.isActive) {
            schedule.nextRunAt = this.computeNextRunAt({
                frequency: schedule.frequency,
                dayOfWeek: schedule.dayOfWeek ?? 1,
                dayOfMonth: schedule.dayOfMonth ?? 1,
                timeUtc: schedule.timeUtc,
                from: new Date(),
            });
        }
        const saved = await this.scheduleRepository.save(schedule);
        this.logger.log(
            `Schedule ${id} set isActive=${dto.isActive} for org ${schedule.orgId}`,
        );
        return this.toScheduleDto(saved);
    }

    async remove(scope: OrgBranchScope, id: string): Promise<void> {
        const schedule = await this.getOwnedSchedule(scope, id);
        await this.scheduleRepository.remove(schedule);
    }

    async listRuns(
        scope: OrgBranchScope,
        scheduleId?: string,
    ): Promise<ReportRunResponseDto[]> {
        const orgId = this.requireOrg(scope);
        const where = scheduleId
            ? { orgId, scheduleId }
            : { orgId };
        const rows = await this.runRepository.find({
            where,
            order: { startedAt: 'DESC' },
            take: 50,
        });
        return rows.map(row => this.toRunDto(row));
    }

    /** On-demand generate / optional email with CSV/PDF attachment. */
    async generateOnDemand(
        scope: OrgBranchScope,
        dto: GenerateAdminReportDto,
    ): Promise<GenerateAdminReportResultDto> {
        const orgId = this.requireOrg(scope);
        return this.executeDelivery({
            orgId,
            scope,
            scheduleId: null,
            filters: (dto.filters as AdminReportFiltersDto) ?? {},
            includeCsv: dto.includeCsv ?? true,
            includePdf: dto.includePdf ?? false,
            includeMotivationalLeaderboard:
                dto.includeMotivationalLeaderboard ?? false,
            sendEmail: dto.sendEmail ?? false,
            recipientUserIds: dto.recipientUserIds,
            recipientEmails: dto.recipientEmails,
            recipientRoles: undefined,
            scheduleName: 'On-demand admin report',
        });
    }

    /** Preview = overview payload (no email). */
    async preview(
        scope: OrgBranchScope,
        filters: AdminReportFiltersDto = {},
    ): Promise<unknown> {
        return this.adminInsightsReportsService.getOverview(scope, filters);
    }

    /** Cron entry: process due active schedules only. */
    async processDueSchedules(): Promise<number> {
        const now = new Date();
        const due = await this.scheduleRepository.find({
            where: {
                isActive: true,
                nextRunAt: LessThanOrEqual(now),
            },
            take: 50,
        });

        let processed = 0;
        for (const schedule of due) {
            if (!schedule.isActive) {
                continue;
            }
            try {
                await this.executeDelivery({
                    orgId: schedule.orgId,
                    scope: {
                        orgId: schedule.orgId,
                        userId: schedule.createdByUserId,
                    },
                    scheduleId: schedule.id,
                    filters:
                        (schedule.filters as AdminReportFiltersDto) ?? {},
                    includeCsv: schedule.includeCsv,
                    includePdf: schedule.includePdf,
                    includeMotivationalLeaderboard:
                        schedule.includeMotivationalLeaderboard,
                    sendEmail: true,
                    recipientUserIds: schedule.recipientUserIds ?? undefined,
                    recipientEmails: schedule.recipientEmails ?? undefined,
                    recipientRoles: schedule.recipientRoles ?? undefined,
                    scheduleName: schedule.name,
                });

                schedule.lastRunAt = new Date();
                schedule.nextRunAt = this.computeNextRunAt({
                    frequency: schedule.frequency,
                    dayOfWeek: schedule.dayOfWeek ?? 1,
                    dayOfMonth: schedule.dayOfMonth ?? 1,
                    timeUtc: schedule.timeUtc,
                    from: new Date(Date.now() + CRON_LOOKAHEAD_MS),
                });
                await this.scheduleRepository.save(schedule);
                processed += 1;
            } catch (error) {
                this.logger.error(
                    `Failed processing schedule ${schedule.id}`,
                    error instanceof Error ? error.stack : String(error),
                );
            }
        }

        return processed;
    }

    private async executeDelivery(params: {
        orgId: string;
        scope: OrgBranchScope;
        scheduleId: string | null;
        filters: AdminReportFiltersDto;
        includeCsv: boolean;
        includePdf: boolean;
        includeMotivationalLeaderboard: boolean;
        sendEmail: boolean;
        recipientUserIds?: string[];
        recipientEmails?: string[];
        recipientRoles?: string[];
        scheduleName: string;
    }): Promise<GenerateAdminReportResultDto> {
        const run = this.runRepository.create({
            scheduleId: params.scheduleId,
            orgId: params.orgId,
            status: ReportRunStatus.RUNNING,
            startedAt: new Date(),
            recipientCount: 0,
        });
        await this.runRepository.save(run);

        try {
            const overview = await this.adminInsightsReportsService.getOverview(
                params.scope,
                params.filters,
            );

            let csvContent: string | undefined;
            let csvRowCount: number | undefined;
            let csvFilename: string | undefined;
            let pdfAttachment:
                | {
                      filename: string;
                      content: Buffer;
                      contentType: string;
                  }
                | undefined;

            if (params.includeCsv) {
                const csv = this.reportExportService.buildOverviewCsv(overview);
                csvContent = csv.content;
                csvRowCount = csv.rowCount;
                csvFilename = csv.filename;
            }

            if (params.includePdf) {
                const pdf = await this.reportExportService.buildOverviewPdf(
                    overview,
                    params.scheduleName,
                );
                pdfAttachment = {
                    filename: pdf.filename,
                    content: pdf.content,
                    contentType: pdf.contentType,
                };
            }

            let emailsQueued = 0;
            if (params.sendEmail) {
                const recipients = await this.resolveRecipients({
                    orgId: params.orgId,
                    recipientUserIds: params.recipientUserIds,
                    recipientEmails: params.recipientEmails,
                    recipientRoles: params.recipientRoles,
                });

                if (recipients.length === 0) {
                    throw new BadRequestException(
                        'No recipients resolved for report delivery',
                    );
                }

                const digest = params.includeMotivationalLeaderboard
                    ? this.reportExportService.buildMotivationalDigest(overview)
                    : {
                          leaderboardLines: [] as string[],
                          risingStarsLines: [] as string[],
                          branchChampionLines: [] as string[],
                          celebrationHeadline: '',
                      };

                for (const recipient of recipients) {
                    await this.communicationsService.sendAdminReportEmail({
                        recipientEmail: recipient.email,
                        recipientName: recipient.name,
                        organizationId: params.orgId,
                        reportTitle: params.scheduleName,
                        timeframe: overview.timeframe,
                        generatedAt: overview.generatedAt.toISOString(),
                        averageKnowledgeScore:
                            overview.kpis.averageKnowledgeScore,
                        overallPassRate: overview.kpis.overallPassRate,
                        activeLearners: overview.kpis.activeLearners,
                        totalTrainingHours: overview.kpis.totalTrainingHours,
                        atRiskUserCount: overview.kpis.atRiskUserCount,
                        highPotentialUserCount:
                            overview.kpis.highPotentialUserCount,
                        keyAreaCount: overview.kpis.keyAreaCount,
                        topPerformersSummary: overview.topPerformers
                            .slice(0, 5)
                            .map(
                                p =>
                                    `${p.firstName} ${p.lastName} (${p.averageScore}%)`,
                            ),
                        keyAreasSummary: overview.keyAreas
                            .slice(0, 5)
                            .map(a => a.title),
                        celebrationHeadline: digest.celebrationHeadline,
                        leaderboardLines: digest.leaderboardLines,
                        risingStarsLines: digest.risingStarsLines,
                        branchChampionLines: digest.branchChampionLines,
                        csvAttachment:
                            csvContent && csvFilename
                                ? {
                                      filename: csvFilename,
                                      content: Buffer.from(csvContent, 'utf8'),
                                      contentType: 'text/csv',
                                  }
                                : undefined,
                        pdfAttachment,
                    });
                    emailsQueued += 1;
                }

                run.recipientCount = emailsQueued;
            }

            run.status = ReportRunStatus.SUCCESS;
            run.finishedAt = new Date();
            run.csvRowCount = csvRowCount ?? null;
            run.metadata = {
                timeframe: overview.timeframe,
                emailsQueued,
                includeCsv: params.includeCsv,
                includePdf: params.includePdf,
                includeMotivationalLeaderboard:
                    params.includeMotivationalLeaderboard,
            };
            await this.runRepository.save(run);

            return {
                run: this.toRunDto(run),
                csv: csvContent,
                pdfGenerated: Boolean(pdfAttachment),
                overview,
                emailsQueued,
            };
        } catch (error) {
            run.status = ReportRunStatus.FAILED;
            run.finishedAt = new Date();
            run.errorMessage =
                error instanceof Error ? error.message : String(error);
            await this.runRepository.save(run);
            throw error;
        }
    }

    private async resolveRecipients(params: {
        orgId: string;
        recipientUserIds?: string[];
        recipientEmails?: string[];
        recipientRoles?: string[];
    }): Promise<Array<{ email: string; name: string }>> {
        const byEmail = new Map<string, string>();

        (params.recipientEmails ?? []).forEach(email => {
            byEmail.set(email.toLowerCase(), email.split('@')[0]);
        });

        const userIds = params.recipientUserIds ?? [];
        if (userIds.length > 0) {
            const orgUsers = await this.userRepository
                .createQueryBuilder('user')
                .leftJoin('user.orgId', 'org')
                .where('user.id IN (:...userIds)', { userIds })
                .andWhere('org.id = :orgId', { orgId: params.orgId })
                .getMany();

            orgUsers.forEach(user => {
                if (user.email) {
                    byEmail.set(
                        user.email.toLowerCase(),
                        `${user.firstName} ${user.lastName}`.trim(),
                    );
                }
            });
        }

        const roles = (params.recipientRoles ?? []).filter(Boolean);
        if (roles.length > 0) {
            const roleUsers = await this.userRepository
                .createQueryBuilder('user')
                .leftJoin('user.orgId', 'org')
                .where('org.id = :orgId', { orgId: params.orgId })
                .andWhere('user.role IN (:...roles)', { roles })
                .andWhere('user.status = :activeStatus', {
                    activeStatus: 'active',
                })
                .getMany();

            roleUsers.forEach(user => {
                if (user.email) {
                    byEmail.set(
                        user.email.toLowerCase(),
                        `${user.firstName} ${user.lastName}`.trim(),
                    );
                }
            });
        }

        return Array.from(byEmail.entries()).map(([email, name]) => ({
            email,
            name: name || email,
        }));
    }

    private computeNextRunAt(params: {
        frequency: ReportScheduleFrequency;
        dayOfWeek: number;
        dayOfMonth: number;
        timeUtc: string;
        from: Date;
    }): Date {
        const [hourStr, minuteStr] = params.timeUtc.split(':');
        const hour = Number(hourStr);
        const minute = Number(minuteStr);
        if (
            Number.isNaN(hour) ||
            Number.isNaN(minute) ||
            hour < 0 ||
            hour > 23 ||
            minute < 0 ||
            minute > 59
        ) {
            throw new BadRequestException('timeUtc must be a valid HH:mm');
        }

        const cursor = new Date(params.from);
        cursor.setUTCSeconds(0, 0);

        for (let i = 0; i < 400; i += 1) {
            const candidate = new Date(cursor);
            candidate.setUTCHours(hour, minute, 0, 0);

            if (candidate <= params.from) {
                cursor.setUTCDate(cursor.getUTCDate() + 1);
                continue;
            }

            if (params.frequency === ReportScheduleFrequency.WEEKLY) {
                if (candidate.getUTCDay() === params.dayOfWeek) {
                    return candidate;
                }
            } else if (candidate.getUTCDate() === params.dayOfMonth) {
                return candidate;
            }

            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        throw new BadRequestException('Unable to compute next run time');
    }

    private assertHasRecipients(dto: {
        recipientUserIds?: string[] | null;
        recipientEmails?: string[] | null;
        recipientRoles?: string[] | null;
    }): void {
        const hasUsers = (dto.recipientUserIds?.length ?? 0) > 0;
        const hasEmails = (dto.recipientEmails?.length ?? 0) > 0;
        const hasRoles = (dto.recipientRoles?.length ?? 0) > 0;
        if (!hasUsers && !hasEmails && !hasRoles) {
            throw new BadRequestException(
                'At least one recipient (user, email, or role) is required',
            );
        }
    }

    private async getOwnedSchedule(
        scope: OrgBranchScope,
        id: string,
    ): Promise<ReportSchedule> {
        const orgId = this.requireOrg(scope);
        const schedule = await this.scheduleRepository.findOne({
            where: { id, orgId },
        });
        if (!schedule) {
            throw new NotFoundException(`Report schedule ${id} not found`);
        }
        return schedule;
    }

    private requireOrg(scope: OrgBranchScope): string {
        if (!scope.orgId) {
            throw new BadRequestException('Organization context required');
        }
        return scope.orgId;
    }

    private toScheduleDto(row: ReportSchedule): ReportScheduleResponseDto {
        return {
            id: row.id,
            orgId: row.orgId,
            createdByUserId: row.createdByUserId,
            name: row.name,
            reportTypes: row.reportTypes,
            filters: row.filters ?? null,
            frequency: row.frequency,
            dayOfWeek: row.dayOfWeek ?? null,
            dayOfMonth: row.dayOfMonth ?? null,
            timeUtc: row.timeUtc,
            timezone: row.timezone,
            recipientUserIds: row.recipientUserIds ?? null,
            recipientEmails: row.recipientEmails ?? null,
            recipientRoles: row.recipientRoles ?? null,
            includeCsv: row.includeCsv,
            includePdf: row.includePdf,
            includeMotivationalLeaderboard: row.includeMotivationalLeaderboard,
            isActive: row.isActive,
            lastRunAt: row.lastRunAt ?? null,
            nextRunAt: row.nextRunAt ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        };
    }

    private toRunDto(row: ReportRun): ReportRunResponseDto {
        return {
            id: row.id,
            scheduleId: row.scheduleId ?? null,
            orgId: row.orgId,
            status: row.status,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt ?? null,
            errorMessage: row.errorMessage ?? null,
            recipientCount: row.recipientCount,
            csvRowCount: row.csvRowCount ?? null,
            metadata: row.metadata ?? null,
        };
    }
}
