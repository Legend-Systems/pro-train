import { MigrationInterface, QueryRunner } from 'typeorm';

import { tableExists } from '../database/migration-utils';

/**
 * Per-learner Digital Skills training-plan rows (weak skill → module + check).
 */
export class CreateDigitalSkillsAssignments1742000000000
    implements MigrationInterface
{
    name = 'CreateDigitalSkillsAssignments1742000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'digital_skills_assignments')) {
            return;
        }

        await queryRunner.query(`
            CREATE TABLE \`digital_skills_assignments\` (
                \`assignmentId\` int NOT NULL AUTO_INCREMENT,
                \`userId\` varchar(36) NOT NULL,
                \`skillKey\` varchar(80) NOT NULL,
                \`skillTitle\` varchar(255) NOT NULL,
                \`skillGroup\` varchar(80) NOT NULL,
                \`level\` int NOT NULL,
                \`materialId\` int NULL,
                \`testId\` int NULL,
                \`assignedFromResultId\` int NOT NULL,
                \`assignedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`orgId\` varchar(36) NOT NULL,
                INDEX \`IDX_DIGITAL_SKILLS_ASSIGNMENT_USER\` (\`userId\`),
                UNIQUE INDEX \`UQ_DIGITAL_SKILLS_ASSIGNMENT_USER_SKILL\` (\`userId\`, \`skillKey\`),
                PRIMARY KEY (\`assignmentId\`)
            ) ENGINE=InnoDB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await tableExists(queryRunner, 'digital_skills_assignments')) {
            await queryRunner.query('DROP TABLE `digital_skills_assignments`');
        }
    }
}
