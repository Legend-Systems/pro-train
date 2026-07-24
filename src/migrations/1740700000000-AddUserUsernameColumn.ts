import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds optional unique username for legacy CSV import and login aliases. */
export class AddUserUsernameColumn1740700000000 implements MigrationInterface {
    name = 'AddUserUsernameColumn1740700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`users\`
            ADD COLUMN \`username\` varchar(255) NULL
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX \`IDX_USER_USERNAME\` ON \`users\` (\`username\`)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX \`IDX_USER_USERNAME\` ON \`users\`
        `);

        await queryRunner.query(`
            ALTER TABLE \`users\`
            DROP COLUMN \`username\`
        `);
    }
}
