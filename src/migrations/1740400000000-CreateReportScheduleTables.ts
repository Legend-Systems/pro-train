import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin report scheduling — schedule definitions and execution log.
 * Also extends communications.emailType with admin_report.
 */
export class CreateReportScheduleTables1740400000000
    implements MigrationInterface
{
    name = 'CreateReportScheduleTables1740400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`report_schedule\` (
                \`id\` varchar(36) NOT NULL,
                \`orgId\` varchar(36) NOT NULL,
                \`createdByUserId\` varchar(36) NOT NULL,
                \`name\` varchar(160) NOT NULL,
                \`reportTypes\` json NOT NULL,
                \`filters\` json NULL,
                \`frequency\` enum('weekly', 'monthly') NOT NULL DEFAULT 'weekly',
                \`dayOfWeek\` int NULL,
                \`dayOfMonth\` int NULL,
                \`timeUtc\` varchar(5) NOT NULL DEFAULT '08:00',
                \`timezone\` varchar(64) NOT NULL DEFAULT 'UTC',
                \`recipientUserIds\` json NULL,
                \`recipientEmails\` json NULL,
                \`recipientRoles\` json NULL,
                \`includeCsv\` tinyint NOT NULL DEFAULT 1,
                \`includeMotivationalLeaderboard\` tinyint NOT NULL DEFAULT 0,
                \`isActive\` tinyint NOT NULL DEFAULT 1,
                \`lastRunAt\` timestamp NULL,
                \`nextRunAt\` timestamp NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`IDX_report_schedule_orgId\` (\`orgId\`),
                INDEX \`IDX_report_schedule_org_active\` (\`orgId\`, \`isActive\`),
                INDEX \`IDX_report_schedule_next_run\` (\`nextRunAt\`, \`isActive\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            ADD CONSTRAINT \`FK_report_schedule_org\`
            FOREIGN KEY (\`orgId\`) REFERENCES \`organizations\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            ADD CONSTRAINT \`FK_report_schedule_created_by\`
            FOREIGN KEY (\`createdByUserId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE \`report_run\` (
                \`id\` varchar(36) NOT NULL,
                \`scheduleId\` varchar(36) NULL,
                \`orgId\` varchar(36) NOT NULL,
                \`status\` enum('pending', 'running', 'success', 'failed') NOT NULL DEFAULT 'pending',
                \`startedAt\` timestamp NOT NULL,
                \`finishedAt\` timestamp NULL,
                \`errorMessage\` text NULL,
                \`recipientCount\` int NOT NULL DEFAULT 0,
                \`csvRowCount\` int NULL,
                \`metadata\` json NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX \`IDX_report_run_schedule\` (\`scheduleId\`),
                INDEX \`IDX_report_run_orgId\` (\`orgId\`),
                INDEX \`IDX_report_run_org_started\` (\`orgId\`, \`startedAt\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`report_run\`
            ADD CONSTRAINT \`FK_report_run_schedule\`
            FOREIGN KEY (\`scheduleId\`) REFERENCES \`report_schedule\`(\`id\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`communications\`
            MODIFY COLUMN \`emailType\` enum(
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`communications\`
            MODIFY COLUMN \`emailType\` enum(
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
                'custom'
            ) NOT NULL DEFAULT 'custom'
        `);

        await queryRunner.query(`DROP TABLE IF EXISTS \`report_run\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`report_schedule\``);
    }
}
