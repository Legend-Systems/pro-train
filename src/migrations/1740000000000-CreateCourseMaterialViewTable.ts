import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 4 migration — course material view tracking for XP engagement awards. */
export class CreateCourseMaterialViewTable1740000000000
    implements MigrationInterface
{
    name = 'CreateCourseMaterialViewTable1740000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`course_material_view\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` varchar(36) NOT NULL,
                \`materialId\` int NOT NULL,
                \`courseId\` int NOT NULL,
                \`viewedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                UNIQUE INDEX \`UQ_material_view_user_material\` (\`userId\`, \`materialId\`),
                INDEX \`IDX_material_view_course\` (\`courseId\`),
                INDEX \`IDX_material_view_user\` (\`userId\`),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `);

        await queryRunner.query(`
            ALTER TABLE \`course_material_view\`
            ADD CONSTRAINT \`FK_material_view_user\`
            FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`course_material_view\`
            ADD CONSTRAINT \`FK_material_view_material\`
            FOREIGN KEY (\`materialId\`) REFERENCES \`course_materials\`(\`materialId\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE \`course_material_view\`
            ADD CONSTRAINT \`FK_material_view_course\`
            FOREIGN KEY (\`courseId\`) REFERENCES \`courses\`(\`courseId\`)
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE \`course_material_view\` DROP FOREIGN KEY \`FK_material_view_course\``,
        );
        await queryRunner.query(
            `ALTER TABLE \`course_material_view\` DROP FOREIGN KEY \`FK_material_view_material\``,
        );
        await queryRunner.query(
            `ALTER TABLE \`course_material_view\` DROP FOREIGN KEY \`FK_material_view_user\``,
        );
        await queryRunner.query(`DROP TABLE \`course_material_view\``);
    }
}
