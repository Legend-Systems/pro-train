import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds optional GCS public URL columns for course and test card thumbnails. */
export class AddCourseAndTestThumbnails1740100000000
    implements MigrationInterface
{
    name = 'AddCourseAndTestThumbnails1740100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`courses\`
            ADD COLUMN \`course_thumbnail\` varchar(2048) NULL
        `);

        await queryRunner.query(`
            ALTER TABLE \`tests\`
            ADD COLUMN \`test_thumbnail\` varchar(2048) NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`tests\`
            DROP COLUMN \`test_thumbnail\`
        `);

        await queryRunner.query(`
            ALTER TABLE \`courses\`
            DROP COLUMN \`course_thumbnail\`
        `);
    }
}
