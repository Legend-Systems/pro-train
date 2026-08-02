import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flexible report content selection: a high-level preset plus an explicit
 * section list so schedules can include exactly the data an org wants.
 */
export class AddReportScheduleContentSelection1740800000000
    implements MigrationInterface
{
    name = 'AddReportScheduleContentSelection1740800000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            ADD \`reportPreset\` enum('leaderboard','admin','custom')
            NOT NULL DEFAULT 'admin'
        `);

        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            ADD \`sections\` json NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            DROP COLUMN \`sections\`
        `);

        await queryRunner.query(`
            ALTER TABLE \`report_schedule\`
            DROP COLUMN \`reportPreset\`
        `);
    }
}
