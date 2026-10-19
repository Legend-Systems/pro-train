import { MigrationInterface, QueryRunner } from 'typeorm';

import { columnExists, tableExists } from '../database/migration-utils';

/**
 * Admin-only personal exam window after a learner misses expectedDueDate.
 * Both columns stay NULL until an elevated admin explicitly reschedules.
 */
export class AddDigitalSkillsRescheduleDates1742200000000
    implements MigrationInterface
{
    name = 'AddDigitalSkillsRescheduleDates1742200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'digital_skills_assignments'))) {
            return;
        }

        if (
            !(await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'rescheduledStartDate',
            ))
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                ADD \`rescheduledStartDate\` datetime(6) NULL
            `);
        }

        if (
            !(await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'rescheduledExamEndDate',
            ))
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                ADD \`rescheduledExamEndDate\` datetime(6) NULL
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'digital_skills_assignments'))) {
            return;
        }

        if (
            await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'rescheduledExamEndDate',
            )
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                DROP COLUMN \`rescheduledExamEndDate\`
            `);
        }

        if (
            await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'rescheduledStartDate',
            )
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                DROP COLUMN \`rescheduledStartDate\`
            `);
        }
    }
}
