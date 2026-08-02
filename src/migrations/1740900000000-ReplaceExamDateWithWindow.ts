import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the single `examDate` column on `tests` with an availability window:
 * `examStartDate` / `examEndDate`. Existing rows keep the same calendar day for
 * both boundaries so previously scheduled exams remain available on that day.
 */
export class ReplaceExamDateWithWindow1740900000000
    implements MigrationInterface
{
    name = 'ReplaceExamDateWithWindow1740900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`tests\`
            ADD \`examStartDate\` datetime(6) NULL
        `);
        await queryRunner.query(`
            ALTER TABLE \`tests\`
            ADD \`examEndDate\` datetime(6) NULL
        `);

        // Preserve existing schedules: a one-day exam becomes a one-day window.
        await queryRunner.query(`
            UPDATE \`tests\`
            SET
                \`examStartDate\` = \`examDate\`,
                \`examEndDate\` = \`examDate\`
            WHERE \`examDate\` IS NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE \`tests\`
            DROP COLUMN \`examDate\`
        `);

        await queryRunner.query(`
            CREATE INDEX \`IDX_tests_examStartDate\` ON \`tests\` (\`examStartDate\`)
        `);
        await queryRunner.query(`
            CREATE INDEX \`IDX_tests_examEndDate\` ON \`tests\` (\`examEndDate\`)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX \`IDX_tests_examEndDate\` ON \`tests\`
        `);
        await queryRunner.query(`
            DROP INDEX \`IDX_tests_examStartDate\` ON \`tests\`
        `);

        await queryRunner.query(`
            ALTER TABLE \`tests\`
            ADD \`examDate\` datetime(6) NULL
        `);

        // Collapse the window back to its start day (or end if start was null).
        await queryRunner.query(`
            UPDATE \`tests\`
            SET \`examDate\` = COALESCE(\`examStartDate\`, \`examEndDate\`)
            WHERE \`examStartDate\` IS NOT NULL OR \`examEndDate\` IS NOT NULL
        `);

        await queryRunner.query(`
            ALTER TABLE \`tests\`
            DROP COLUMN \`examEndDate\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`tests\`
            DROP COLUMN \`examStartDate\`
        `);
    }
}
