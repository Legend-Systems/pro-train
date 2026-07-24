import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5: optional PDF attachment flag on report schedules.
 */
export class AddReportScheduleIncludePdf1740500000000
    implements MigrationInterface
{
    name = 'AddReportScheduleIncludePdf1740500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            ADD \`includePdf\` tinyint NOT NULL DEFAULT 0
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            DROP COLUMN \`includePdf\`
        `);
    }
}
