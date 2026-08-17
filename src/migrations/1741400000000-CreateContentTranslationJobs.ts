import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists } from '../database/migration-utils';

/**
 * Job table for automatic pt-PT translation observability and admin retry.
 */
export class CreateContentTranslationJobs1741400000000
    implements MigrationInterface
{
    name = 'CreateContentTranslationJobs1741400000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'content_translation_jobs')) {
            return;
        }

        await queryRunner.query(`
            CREATE TABLE \`content_translation_jobs\` (
                \`jobId\` int NOT NULL AUTO_INCREMENT,
                \`entityType\` varchar(20) NOT NULL,
                \`entityId\` int NOT NULL,
                \`locale\` varchar(10) NOT NULL,
                \`status\` varchar(20) NOT NULL DEFAULT 'pending',
                \`lastError\` text NULL,
                \`sourceContentHash\` varchar(64) NULL,
                \`charactersTranslated\` int NOT NULL DEFAULT 0,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`jobId\`),
                UNIQUE KEY \`UQ_content_translation_jobs_entity_locale\` (\`entityType\`, \`entityId\`, \`locale\`),
                KEY \`IDX_content_translation_jobs_status\` (\`status\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'content_translation_jobs')) {
            await queryRunner.query(
                'DROP TABLE `content_translation_jobs`',
            );
        }
    }
}
