import { MigrationInterface, QueryRunner } from 'typeorm';
import { columnExists, tableExists } from '../database/migration-utils';

/**
 * Idempotent localization schema:
 * - users.preferredLanguage
 * - translation sidecar tables
 * - test_attempts.locale
 */
export class CreateLocalizationSchema1741100000000
    implements MigrationInterface
{
    name = 'CreateLocalizationSchema1741100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await columnExists(queryRunner, 'users', 'preferredLanguage'))) {
            await queryRunner.query(`
                ALTER TABLE \`users\`
                ADD COLUMN \`preferredLanguage\` varchar(10) NULL
            `);
        }

        if (!(await tableExists(queryRunner, 'course_translations'))) {
            await queryRunner.query(`
                CREATE TABLE \`course_translations\` (
                    \`translationId\` int NOT NULL AUTO_INCREMENT,
                    \`courseId\` int NOT NULL,
                    \`locale\` varchar(10) NOT NULL,
                    \`title\` varchar(500) NULL,
                    \`description\` text NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`translationId\`),
                    UNIQUE KEY \`UQ_course_translations_course_locale\` (\`courseId\`, \`locale\`),
                    KEY \`IDX_course_translations_course\` (\`courseId\`),
                    CONSTRAINT \`FK_course_translations_course\`
                        FOREIGN KEY (\`courseId\`) REFERENCES \`courses\` (\`courseId\`)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        }

        if (!(await tableExists(queryRunner, 'test_translations'))) {
            await queryRunner.query(`
                CREATE TABLE \`test_translations\` (
                    \`translationId\` int NOT NULL AUTO_INCREMENT,
                    \`testId\` int NOT NULL,
                    \`locale\` varchar(10) NOT NULL,
                    \`title\` varchar(500) NULL,
                    \`description\` text NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`translationId\`),
                    UNIQUE KEY \`UQ_test_translations_test_locale\` (\`testId\`, \`locale\`),
                    KEY \`IDX_test_translations_test\` (\`testId\`),
                    CONSTRAINT \`FK_test_translations_test\`
                        FOREIGN KEY (\`testId\`) REFERENCES \`tests\` (\`testId\`)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        }

        if (!(await tableExists(queryRunner, 'question_translations'))) {
            await queryRunner.query(`
                CREATE TABLE \`question_translations\` (
                    \`translationId\` int NOT NULL AUTO_INCREMENT,
                    \`questionId\` int NOT NULL,
                    \`locale\` varchar(10) NOT NULL,
                    \`questionText\` text NULL,
                    \`explanation\` text NULL,
                    \`hint\` text NULL,
                    \`mediaInstructions\` text NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`translationId\`),
                    UNIQUE KEY \`UQ_question_translations_question_locale\` (\`questionId\`, \`locale\`),
                    KEY \`IDX_question_translations_question\` (\`questionId\`),
                    CONSTRAINT \`FK_question_translations_question\`
                        FOREIGN KEY (\`questionId\`) REFERENCES \`questions\` (\`questionId\`)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        }

        if (!(await tableExists(queryRunner, 'question_option_translations'))) {
            await queryRunner.query(`
                CREATE TABLE \`question_option_translations\` (
                    \`translationId\` int NOT NULL AUTO_INCREMENT,
                    \`optionId\` int NOT NULL,
                    \`locale\` varchar(10) NOT NULL,
                    \`optionText\` varchar(1000) NULL,
                    \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                    \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (\`translationId\`),
                    UNIQUE KEY \`UQ_option_translations_option_locale\` (\`optionId\`, \`locale\`),
                    KEY \`IDX_option_translations_option\` (\`optionId\`),
                    CONSTRAINT \`FK_option_translations_option\`
                        FOREIGN KEY (\`optionId\`) REFERENCES \`question_options\` (\`optionId\`)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
        }

        if (!(await columnExists(queryRunner, 'test_attempts', 'locale'))) {
            await queryRunner.query(`
                ALTER TABLE \`test_attempts\`
                ADD COLUMN \`locale\` varchar(10) NULL DEFAULT 'en'
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (await columnExists(queryRunner, 'test_attempts', 'locale')) {
            await queryRunner.query(`
                ALTER TABLE \`test_attempts\`
                DROP COLUMN \`locale\`
            `);
        }

        if (await tableExists(queryRunner, 'question_option_translations')) {
            await queryRunner.query(`
                DROP TABLE \`question_option_translations\`
            `);
        }

        if (await tableExists(queryRunner, 'question_translations')) {
            await queryRunner.query(`
                DROP TABLE \`question_translations\`
            `);
        }

        if (await tableExists(queryRunner, 'test_translations')) {
            await queryRunner.query(`
                DROP TABLE \`test_translations\`
            `);
        }

        if (await tableExists(queryRunner, 'course_translations')) {
            await queryRunner.query(`
                DROP TABLE \`course_translations\`
            `);
        }

        if (await columnExists(queryRunner, 'users', 'preferredLanguage')) {
            await queryRunner.query(`
                ALTER TABLE \`users\`
                DROP COLUMN \`preferredLanguage\`
            `);
        }
    }
}
