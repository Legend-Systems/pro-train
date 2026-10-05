import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists } from '../database/migration-utils';

/**
 * Audit table for learner assistance requests, plus the communications
 * emailType value used when the support email is stored.
 */
export class CreateAssistanceRequests1741700000000 implements MigrationInterface {
    name = 'CreateAssistanceRequests1741700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'assistance_requests'))) {
            await queryRunner.query(`
                CREATE TABLE \`assistance_requests\` (
                    \`id\` varchar(36) NOT NULL,
                    \`userId\` varchar(36) NOT NULL,
                    \`orgId\` varchar(36) NOT NULL,
                    \`branchId\` varchar(36) NULL,
                    \`source\` enum('web', 'mobile') NOT NULL,
                    \`contextType\` enum('course', 'test') NOT NULL,
                    \`courseId\` int NULL,
                    \`materialId\` int NULL,
                    \`testId\` int NULL,
                    \`message\` varchar(500) NULL,
                    \`emailStatus\` enum('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
                    \`whatsappStatus\` enum('pending', 'sent', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
                    \`communicationId\` varchar(36) NULL,
                    \`requestedAt\` datetime(6) NOT NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    INDEX \`IDX_assistance_requests_user\` (\`userId\`),
                    INDEX \`IDX_assistance_requests_org\` (\`orgId\`),
                    INDEX \`IDX_assistance_requests_requested_at\` (\`requestedAt\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB
            `);
        }

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
                'test_exam_reminder_dayof',
                'assistance_request'
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
                'admin_report',
                'test_exam_reminder_3day',
                'test_exam_reminder_dayof'
            ) NOT NULL DEFAULT 'custom'
        `);

        if (await tableExists(queryRunner, 'assistance_requests')) {
            await queryRunner.query('DROP TABLE `assistance_requests`');
        }
    }
}
