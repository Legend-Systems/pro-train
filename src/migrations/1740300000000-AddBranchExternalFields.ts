import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds external-system branch fields (ref, geo, soft-delete, structured address). */
export class AddBranchExternalFields1740300000000 implements MigrationInterface {
    name = 'AddBranchExternalFields1740300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`branches\`
            ADD COLUMN \`ref\` varchar(255) NULL,
            ADD COLUMN \`website\` varchar(2048) NULL,
            ADD COLUMN \`isDeleted\` tinyint NOT NULL DEFAULT 0,
            ADD COLUMN \`deletedAt\` timestamp NULL,
            ADD COLUMN \`alias\` varchar(255) NULL,
            ADD COLUMN \`country\` varchar(100) NULL,
            ADD COLUMN \`longitude\` decimal(10, 7) NULL,
            ADD COLUMN \`latitude\` decimal(10, 7) NULL
        `);

        await queryRunner.query(`
            UPDATE \`branches\`
            SET \`address\` = JSON_QUOTE(\`address\`)
            WHERE \`address\` IS NOT NULL
              AND JSON_VALID(\`address\`) = 0
        `);

        await queryRunner.query(`
            ALTER TABLE \`branches\`
            MODIFY COLUMN \`address\` json NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`branches\`
            MODIFY COLUMN \`address\` varchar(500) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE \`branches\`
            DROP COLUMN \`latitude\`,
            DROP COLUMN \`longitude\`,
            DROP COLUMN \`country\`,
            DROP COLUMN \`alias\`,
            DROP COLUMN \`deletedAt\`,
            DROP COLUMN \`isDeleted\`,
            DROP COLUMN \`website\`,
            DROP COLUMN \`ref\`
        `);
    }
}
