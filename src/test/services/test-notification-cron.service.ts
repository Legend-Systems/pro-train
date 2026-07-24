import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { TestNotificationService } from './test-notification.service';

/**
 * Daily examDate reminder runner (07:00 UTC).
 * Sends 3-day and day-of emails for active tests.
 */
@Injectable()
export class TestNotificationCronService {
    private readonly logger = new Logger(TestNotificationCronService.name);

    constructor(
        private readonly testNotificationService: TestNotificationService,
    ) {}

    @Cron('0 7 * * *')
    async processExamRemindersCron(): Promise<void> {
        try {
            const result =
                await this.testNotificationService.processUpcomingExamReminders();
            this.logger.log(
                `Exam reminder cron finished: queued=${result.emailsQueued}, failed=${result.failed}, skipped=${result.skipped}`,
            );
        } catch (error) {
            this.logger.error(
                'Exam reminder cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
