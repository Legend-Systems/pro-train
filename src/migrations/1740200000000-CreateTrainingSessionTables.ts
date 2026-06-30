import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Training hours Phase 1 — session ledger and monthly rollup tables.
 */
export class CreateTrainingSessionTables1740200000000
    implements MigrationInterface
{
    name = 'CreateTrainingSessionTables1740200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`training_session\` (
                \`id\` varchar(36) NOT NULL,
                \`userId\` varchar(36) NOT NULL,
                \`orgId\` varchar(36) NOT NULL,
                \`branchId\` varchar(36) NULL,
                \`sessionType\` enum('test_attempt', 'course_material') NOT NULL,
                \`sourceId\` varchar(64) NOT NULL,
                \`courseId\` int NULL,
                \`startedAt\` timestamp NOT NULL,
                \`endedAt\` timestamp NOT NULL,
                \`durationMinutes\` int NOT NULL DEFAULT 0,
                \`activityDate\` date NOT NULL,
                \`metadata\` json NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                INDEX \`IDX_training_session_user\` (\`userId\`),
                INDEX \`IDX_training_session_org_date\` (\`orgId\`, \`activityDate\`),
                UNIQUE INDEX \`UQ_training_session_type_source\` (\`sessionType\`, \`sourceId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`training_session\`
            ADD CONSTRAINT \`FK_training_session_user\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`training_session\`
            ADD CONSTRAINT \`FK_training_session_org\`
            FOREIGN KEY (\`orgId\`) REFERENCES \`organizations\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`training_session\`
            ADD CONSTRAINT \`FK_training_session_branch\`
            FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE \`user_training_hours_monthly\` (
                \`id\` varchar(36) NOT NULL,
                \`userId\` varchar(36) NOT NULL,
                \`orgId\` varchar(36) NOT NULL,
                \`branchId\` varchar(36) NULL,
                \`yearMonth\` varchar(7) NOT NULL,
                \`totalMinutes\` int NOT NULL DEFAULT 0,
                \`sessionCount\` int NOT NULL DEFAULT 0,
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                INDEX \`IDX_user_training_hours_monthly_org_month\` (\`orgId\`, \`yearMonth\`),
                UNIQUE INDEX \`UQ_user_training_hours_monthly_user_org_month\` (\`userId\`, \`orgId\`, \`yearMonth\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE IF EXISTS \`user_training_hours_monthly\``,
        );
        await queryRunner.query(`DROP TABLE IF EXISTS \`training_session\``);
    }
}
