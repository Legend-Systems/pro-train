import { MigrationInterface, QueryRunner } from 'typeorm';

import { columnExists, tableExists } from '../database/migration-utils';

/**
 * Stores the day a learner is expected to finish booked Digital Skills checks.
 */
export class AddDigitalSkillsBookingDates1742100000000
    implements MigrationInterface
{
    name = 'AddDigitalSkillsBookingDates1742100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'digital_skills_assignments'))) {
            return;
        }

        if (
            !(await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'expectedDueDate',
            ))
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                ADD \`expectedDueDate\` datetime(6) NULL
            `);
        }

        if (
            !(await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'bookingNotifiedAt',
            ))
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                ADD \`bookingNotifiedAt\` datetime(6) NULL
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
                'bookingNotifiedAt',
            )
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                DROP COLUMN \`bookingNotifiedAt\`
            `);
        }

        if (
            await columnExists(
                queryRunner,
                'digital_skills_assignments',
                'expectedDueDate',
            )
        ) {
            await queryRunner.query(`
                ALTER TABLE \`digital_skills_assignments\`
                DROP COLUMN \`expectedDueDate\`
            `);
        }
    }
}
