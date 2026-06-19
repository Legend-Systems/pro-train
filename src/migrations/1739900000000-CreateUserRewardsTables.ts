import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 migration — creates user_rewards aggregate and xp_transaction ledger.
 * Indexes support monthly rankings, audit history, and idempotent award deduplication.
 */
export class CreateUserRewardsTables1739900000000
    implements MigrationInterface
{
    name = 'CreateUserRewardsTables1739900000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`user_rewards\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` varchar(36) NOT NULL,
                \`orgId\` varchar(36) NOT NULL,
                \`branchId\` varchar(36) NULL,
                \`currentXP\` int NOT NULL DEFAULT 0,
                \`totalXP\` int NOT NULL DEFAULT 0,
                \`level\` int NOT NULL DEFAULT 1,
                \`rank\` varchar(20) NOT NULL DEFAULT 'ROOKIE',
                \`xpBreakdown\` json NOT NULL,
                \`challengeMonth\` varchar(7) NOT NULL,
                \`challengeMonthXP\` int NOT NULL DEFAULT 0,
                \`challengeMonthXpBreakdown\` json NOT NULL,
                \`monthlyChallengeHistory\` json NOT NULL DEFAULT ('[]'),
                \`lastActionAt\` timestamp NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`UQ_user_rewards_user_org\` (\`userId\`, \`orgId\`),
                INDEX \`IDX_user_rewards_user\` (\`userId\`),
                INDEX \`IDX_user_rewards_org_month_xp\` (\`orgId\`, \`challengeMonthXP\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`user_rewards\`
            ADD CONSTRAINT \`FK_user_rewards_user\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`user_rewards\`
            ADD CONSTRAINT \`FK_user_rewards_org\`
            FOREIGN KEY (\`orgId\`) REFERENCES \`organizations\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`user_rewards\`
            ADD CONSTRAINT \`FK_user_rewards_branch\`
            FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE \`xp_transaction\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userRewardsId\` int NOT NULL,
                \`action\` varchar(50) NOT NULL,
                \`xpAmount\` int NOT NULL,
                \`metadata\` json NOT NULL,
                \`idempotencyKey\` varchar(255) NULL,
                \`timestamp\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX \`IDX_xp_transaction_rewards_timestamp\` (\`userRewardsId\`, \`timestamp\`),
                UNIQUE INDEX \`IDX_xp_transaction_idempotency\` (\`userRewardsId\`, \`idempotencyKey\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`xp_transaction\`
            ADD CONSTRAINT \`FK_xp_transaction_user_rewards\`
            FOREIGN KEY (\`userRewardsId\`) REFERENCES \`user_rewards\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE \`xp_transaction\` DROP FOREIGN KEY \`FK_xp_transaction_user_rewards\``,
        );
        await queryRunner.query(`DROP TABLE \`xp_transaction\``);
        await queryRunner.query(
            `ALTER TABLE \`user_rewards\` DROP FOREIGN KEY \`FK_user_rewards_branch\``,
        );
        await queryRunner.query(
            `ALTER TABLE \`user_rewards\` DROP FOREIGN KEY \`FK_user_rewards_org\``,
        );
        await queryRunner.query(
            `ALTER TABLE \`user_rewards\` DROP FOREIGN KEY \`FK_user_rewards_user\``,
        );
        await queryRunner.query(`DROP TABLE \`user_rewards\``);
    }
}
