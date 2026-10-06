import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists, tableExists } from '../database/migration-utils';

/**
 * Adds course-open and training-manual download tables, and counters on
 * existing material views so admins can see repeat engagement.
 */
export class AddMaterialEngagementTracking1741800000000
    implements MigrationInterface
{
    name = 'AddMaterialEngagementTracking1741800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, 'course_material_view', 'lastViewedAt'))) {
            await queryRunner.query(`
                ALTER TABLE \`course_material_view\`
                ADD \`lastViewedAt\` datetime NULL,
                ADD \`openCount\` int NOT NULL DEFAULT 0,
                ADD \`downloadCount\` int NOT NULL DEFAULT 0
            `);
            await queryRunner.query(`
                UPDATE \`course_material_view\`
                SET \`lastViewedAt\` = \`viewedAt\`, \`openCount\` = 1
                WHERE \`openCount\` = 0 AND \`downloadCount\` = 0
            `);
        }

        if (!(await tableExists(queryRunner, 'course_module_views'))) {
            await queryRunner.query(`
                CREATE TABLE \`course_module_views\` (
                    \`id\` int NOT NULL AUTO_INCREMENT,
                    \`userId\` varchar(36) NOT NULL,
                    \`courseId\` int NOT NULL,
                    \`orgId\` varchar(36) NOT NULL,
                    \`firstViewedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`lastViewedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`viewCount\` int NOT NULL DEFAULT 1,
                    INDEX \`IDX_course_module_view_org\` (\`orgId\`),
                    UNIQUE INDEX \`UQ_course_module_view_user_course\` (\`userId\`, \`courseId\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB
            `);
        }

        if (!(await tableExists(queryRunner, 'training_manual_downloads'))) {
            await queryRunner.query(`
                CREATE TABLE \`training_manual_downloads\` (
                    \`id\` int NOT NULL AUTO_INCREMENT,
                    \`userId\` varchar(36) NOT NULL,
                    \`orgId\` varchar(36) NOT NULL,
                    \`manualKey\` varchar(80) NOT NULL,
                    \`firstDownloadedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`lastDownloadedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    \`downloadCount\` int NOT NULL DEFAULT 1,
                    INDEX \`IDX_training_manual_org\` (\`orgId\`),
                    UNIQUE INDEX \`UQ_training_manual_user_key\` (\`userId\`, \`manualKey\`),
                    PRIMARY KEY (\`id\`)
                ) ENGINE=InnoDB
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'training_manual_downloads')) {
            await queryRunner.query('DROP TABLE `training_manual_downloads`');
        }
        if (await tableExists(queryRunner, 'course_module_views')) {
            await queryRunner.query('DROP TABLE `course_module_views`');
        }
        if (await columnExists(queryRunner, 'course_material_view', 'openCount')) {
            await queryRunner.query(`
                ALTER TABLE \`course_material_view\`
                DROP COLUMN \`downloadCount\`,
                DROP COLUMN \`openCount\`,
                DROP COLUMN \`lastViewedAt\`
            `);
        }
    }
}
