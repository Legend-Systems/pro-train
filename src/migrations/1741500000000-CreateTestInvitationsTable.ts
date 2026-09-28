import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists } from '../database/migration-utils';

/**
 * Creates `test_invitations`, which the exam-reminder cron reads when resolving
 * assignees. The entity shipped without a migration, so production queries fail
 * with "Table 'trainpro.test_invitations' doesn't exist".
 */
export class CreateTestInvitationsTable1741500000000
    implements MigrationInterface
{
    name = 'CreateTestInvitationsTable1741500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'test_invitations')) {
            return;
        }

        await queryRunner.query(`
            CREATE TABLE \`test_invitations\` (
                \`invitationId\` varchar(36) NOT NULL,
                \`testId\` int NOT NULL,
                \`userId\` varchar(36) NOT NULL,
                \`invitedBy\` varchar(36) NOT NULL,
                \`status\` enum(
                    'pending',
                    'accepted',
                    'declined',
                    'expired',
                    'completed'
                ) NOT NULL DEFAULT 'pending',
                \`message\` text NULL,
                \`expiresAt\` timestamp NULL,
                \`respondedAt\` timestamp NULL,
                \`responseNotes\` text NULL,
                \`invitedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`orgId\` varchar(36) NOT NULL,
                \`branchId\` varchar(36) NULL,
                UNIQUE INDEX \`UQ_test_invitations_test_user\` (\`testId\`, \`userId\`),
                INDEX \`IDX_test_invitations_testId\` (\`testId\`),
                INDEX \`IDX_test_invitations_userId\` (\`userId\`),
                INDEX \`IDX_test_invitations_invitedBy\` (\`invitedBy\`),
                INDEX \`IDX_TEST_INVITATION_STATUS\` (\`status\`),
                INDEX \`IDX_TEST_INVITATION_EXPIRES\` (\`expiresAt\`),
                INDEX \`IDX_test_invitations_orgId\` (\`orgId\`),
                INDEX \`IDX_test_invitations_branchId\` (\`branchId\`),
                PRIMARY KEY (\`invitationId\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`test_invitations\`
            ADD CONSTRAINT \`FK_test_invitations_test\`
            FOREIGN KEY (\`testId\`) REFERENCES \`tests\`(\`testId\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_invitations\`
            ADD CONSTRAINT \`FK_test_invitations_user\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_invitations\`
            ADD CONSTRAINT \`FK_test_invitations_inviter\`
            FOREIGN KEY (\`invitedBy\`) REFERENCES \`users\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_invitations\`
            ADD CONSTRAINT \`FK_test_invitations_org\`
            FOREIGN KEY (\`orgId\`) REFERENCES \`organizations\`(\`id\`)
            ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`test_invitations\`
            ADD CONSTRAINT \`FK_test_invitations_branch\`
            FOREIGN KEY (\`branchId\`) REFERENCES \`branches\`(\`id\`)
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'test_invitations')) {
            await queryRunner.query('DROP TABLE `test_invitations`');
        }
    }
}
