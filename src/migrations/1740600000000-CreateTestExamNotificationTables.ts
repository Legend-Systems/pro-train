import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Upcoming exam reminders: dedupe log + email type enum values.
 */
export class CreateTestExamNotificationTables1740600000000
    implements MigrationInterface
{
    name = 'CreateTestExamNotificationTables1740600000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`test_exam_notification\` (
                \`id\` varchar(36) NOT NULL,
                \`testId\` int NOT NULL,
                \`userId\` varchar(36) NOT NULL,
                \`orgId\` varchar(36) NOT NULL,
                \`notificationType\` enum('three_day', 'day_of') NOT NULL,
                \`status\` enum('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
                \`examDate\` datetime(6) NOT NULL,
                \`recipientEmail\` varchar(320) NOT NULL,
                \`communicationId\` varchar(36) NULL,
                \`errorMessage\` text NULL,
                \`sentAt\` timestamp NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`UQ_test_exam_notification_dedupe\` (\`testId\`, \`userId\`, \`notificationType\`),
                INDEX \`IDX_test_exam_notification_org\` (\`orgId\`),
                INDEX \`IDX_test_exam_notification_exam_date\` (\`examDate\`),
                INDEX \`IDX_test_exam_notification_status\` (\`status\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`communications\`
            CHANGE \`emailType\` \`emailType\`
            enum(
                'welcome',
                'welcome_organization',
                'welcome_branch',
                'welcome_user',
                'password_reset',
                'password_changed',
                'email_verification',
                'login_notification',
                'test_notification',
                'test_invitation',
                'test_activated',
                'test_created_notification',
                'results_summary',
                'course_enrollment',
                'course_created',
                'user_deactivated',
                'user_restored',
                'system_alert',
                'custom',
                'admin_report',
                'test_exam_reminder_3day',
                'test_exam_reminder_dayof'
            ) NOT NULL DEFAULT 'custom'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`communications\`
            CHANGE \`emailType\` \`emailType\`
            enum(
                'welcome',
                'welcome_organization',
                'welcome_branch',
                'welcome_user',
                'password_reset',
                'password_changed',
                'email_verification',
                'login_notification',
                'test_notification',
                'test_invitation',
                'test_activated',
                'test_created_notification',
                'results_summary',
                'course_enrollment',
                'course_created',
                'user_deactivated',
                'user_restored',
                'system_alert',
                'custom',
                'admin_report'
            ) NOT NULL DEFAULT 'custom'
        `);

        await queryRunner.query(`DROP TABLE \`test_exam_notification\``);
    }
}
