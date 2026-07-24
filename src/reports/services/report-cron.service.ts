import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { ReportScheduleService } from './report-schedule.service';

/**
 * Processes due admin report schedules every 15 minutes.
 * Only active schedules (`isActive = true`) are delivered.
 */
@Injectable()
export class ReportCronService {
    private readonly logger = new Logger(ReportCronService.name);

    constructor(
        private readonly reportScheduleService: ReportScheduleService,
    ) {}

    @Cron('*/15 * * * *')
    async processDueReportSchedules(): Promise<void> {
        try {
            const processed =
                await this.reportScheduleService.processDueSchedules();
            if (processed > 0) {
                this.logger.log(
                    `Admin report cron delivered ${processed} schedule(s)`,
                );
            }
        } catch (error) {
            this.logger.error(
                'Admin report schedule cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
