import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin reset of a learner's test attempts.
 *
 * Creates the append-only `test_attempt_resets` audit table and adds the
 * `voidedByResetId` watermark to `test_attempts` and `results`. A NULL
 * watermark means the row is live and visible to the learner; a non-null value
 * names the reset that voided it, which every learner-facing read path filters
 * on. Nothing is destroyed, so administrators keep the full history.
 */
export class AddTestAttemptResets1741000000000 implements MigrationInterface {
    name = 'AddTestAttemptResets1741000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`test_attempt_resets\` (
                \`resetId\` int NOT NULL AUTO_INCREMENT,
                \`testId\` int NOT NULL,
                \`userId\` varchar(36) NOT NULL,
                \`resetByUserId\` varchar(36) NOT NULL,
                \`reason\` varchar(500) NULL,
                \`attemptsVoided\` int NOT NULL DEFAULT 0,
                \`resultsVoided\` int NOT NULL DEFAULT 0,
                \`resetAt\` timestamp NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`orgId\` varchar(36) NOT NULL,
                \`branchId\` varchar(36) NULL,
                INDEX \`IDX_TEST_ATTEMPT_RESET_TEST\` (\`testId\`),
                INDEX \`IDX_TEST_ATTEMPT_RESET_USER\` (\`userId\`),
                INDEX \`IDX_TEST_ATTEMPT_RESET_TEST_USER\` (\`testId\`, \`userId\`),
                INDEX \`IDX_TEST_ATTEMPT_RESET_RESET_AT\` (\`resetAt\`),
                PRIMARY KEY (\`resetId\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            ADD CONSTRAINT \`FK_test_attempt_resets_test\`
            FOREIGN KEY (\`testId\`) REFERENCES \`tests\`(\`testId\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            ADD CONSTRAINT \`FK_test_attempt_resets_user\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            ADD CONSTRAINT \`FK_test_attempt_resets_reset_by_user\`
            FOREIGN KEY (\`resetByUserId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            ADD CONSTRAINT \`FK_test_attempt_resets_org\`
            FOREIGN KEY (\`orgId\`) REFERENCES \`organizations\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            ADD CONSTRAINT \`FK_test_attempt_resets_branch\`
            FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`test_attempts\`
            ADD \`voidedByResetId\` int NULL
        `);
        await queryRunner.query(`
            CREATE INDEX \`IDX_TEST_ATTEMPT_VOIDED_BY_RESET\`
            ON \`test_attempts\` (\`voidedByResetId\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempts\`
            ADD CONSTRAINT \`FK_test_attempts_voided_by_reset\`
            FOREIGN KEY (\`voidedByResetId\`) REFERENCES \`test_attempt_resets\`(\`resetId\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`results\`
            ADD \`voidedByResetId\` int NULL
        `);
        await queryRunner.query(`
            CREATE INDEX \`IDX_RESULT_VOIDED_BY_RESET\`
            ON \`results\` (\`voidedByResetId\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`results\`
            ADD CONSTRAINT \`FK_results_voided_by_reset\`
            FOREIGN KEY (\`voidedByResetId\`) REFERENCES \`test_attempt_resets\`(\`resetId\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`results\`
            DROP FOREIGN KEY \`FK_results_voided_by_reset\`
        `);
        await queryRunner.query(`
            DROP INDEX \`IDX_RESULT_VOIDED_BY_RESET\` ON \`results\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`results\`
            DROP COLUMN \`voidedByResetId\`
        `);

        await queryRunner.query(`
            ALTER TABLE \`test_attempts\`
            DROP FOREIGN KEY \`FK_test_attempts_voided_by_reset\`
        `);
        await queryRunner.query(`
            DROP INDEX \`IDX_TEST_ATTEMPT_VOIDED_BY_RESET\` ON \`test_attempts\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempts\`
            DROP COLUMN \`voidedByResetId\`
        `);

        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            DROP FOREIGN KEY \`FK_test_attempt_resets_branch\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            DROP FOREIGN KEY \`FK_test_attempt_resets_org\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            DROP FOREIGN KEY \`FK_test_attempt_resets_reset_by_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            DROP FOREIGN KEY \`FK_test_attempt_resets_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_attempt_resets\`
            DROP FOREIGN KEY \`FK_test_attempt_resets_test\`
        `);
        await queryRunner.query(`DROP TABLE \`test_attempt_resets\``);
    }
}
