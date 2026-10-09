import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists } from '../database/migration-utils';

/**
 * Stores the staff job roles on `users.role`.
 * The column is widened to varchar so an existing MySQL enum can accept
 * administrative_staff, senior_managers, warehouse_staff, and drivers.
 */
export class AddStaffUserRoles1741900000000 implements MigrationInterface {
    name = 'AddStaffUserRoles1741900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, 'users', 'role'))) {
            return;
        }

        await queryRunner.query(`
            ALTER TABLE \`users\`
            MODIFY COLUMN \`role\` varchar(32) NULL DEFAULT 'user'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, 'users', 'role'))) {
            return;
        }

        await queryRunner.query(`
            UPDATE \`users\`
            SET \`role\` = 'user'
            WHERE \`role\` IN (
                'administrative_staff',
                'senior_managers',
                'warehouse_staff',
                'drivers'
            )
        `);

        await queryRunner.query(`
            ALTER TABLE \`users\`
            MODIFY COLUMN \`role\` enum(
                'master_admin',
                'owner',
                'admin',
                'user'
            ) NULL DEFAULT 'user'
        `);
    }
}
