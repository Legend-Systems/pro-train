import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Method 1 — organization-wide courses & tests via NULL branchId.
 *
 * Active courses and their related tests, questions, options, and materials
 * are set to branchId = NULL so every branch in the organization can view them
 * once the backend branch-visibility query changes are deployed.
 *
 * Column notes (TypeORM relation naming):
 * - courses, tests, questions, question_options → `branchIdId`
 * - course_materials → `branchId` (@JoinColumn({ name: 'branchId' }))
 *
 * Idempotent: only rows that still carry a branch id are updated.
 *
 * Runs each statement outside a single long transaction (`transaction = false`)
 * to avoid lock wait timeouts when other sessions hold row/table locks (e.g. an
 * open MySQL Workbench transaction or a running dev server).
 *
 * Before running: close open Workbench transactions (ROLLBACK), stop `yarn start:dev`.
 */
export class MakeActiveCoursesOrgWide1741100000000
    implements MigrationInterface
{
    name = 'MakeActiveCoursesOrgWide1741100000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Give the migration more time if another session briefly holds locks.
        await queryRunner.query(`SET SESSION innodb_lock_wait_timeout = 300`);

        // Child rows first — courses may already be org-wide (branchIdId IS NULL).
        // Courses are updated last so a brief lock on `courses` does not block joins.

        // 1. Tests under org-wide active courses — sync branch scope to parent.
        await queryRunner.query(`
            UPDATE \`tests\` t
            INNER JOIN \`courses\` c ON c.\`courseId\` = t.\`courseId\`
            SET t.\`branchIdId\` = NULL,
                t.\`updatedAt\` = CURRENT_TIMESTAMP(6)
            WHERE c.\`status\` = 'active'
              AND c.\`branchIdId\` IS NULL
              AND t.\`branchIdId\` IS NOT NULL
        `);

        // 2. Questions on those tests.
        await queryRunner.query(`
            UPDATE \`questions\` q
            INNER JOIN \`tests\` t ON t.\`testId\` = q.\`testId\`
            INNER JOIN \`courses\` c ON c.\`courseId\` = t.\`courseId\`
            SET q.\`branchIdId\` = NULL,
                q.\`updatedAt\` = CURRENT_TIMESTAMP(6)
            WHERE c.\`status\` = 'active'
              AND c.\`branchIdId\` IS NULL
              AND q.\`branchIdId\` IS NOT NULL
        `);

        // 3. Question options — table name is question_options (not questions_options).
        await queryRunner.query(`
            UPDATE \`question_options\` qo
            INNER JOIN \`questions\` q ON q.\`questionId\` = qo.\`questionId\`
            INNER JOIN \`tests\` t ON t.\`testId\` = q.\`testId\`
            INNER JOIN \`courses\` c ON c.\`courseId\` = t.\`courseId\`
            SET qo.\`branchIdId\` = NULL,
                qo.\`updatedAt\` = CURRENT_TIMESTAMP(6)
            WHERE c.\`status\` = 'active'
              AND c.\`branchIdId\` IS NULL
              AND qo.\`branchIdId\` IS NOT NULL
        `);

        // 4. Course materials — FK column is `branchId`, not branchIdId.
        await queryRunner.query(`
            UPDATE \`course_materials\` cm
            INNER JOIN \`courses\` c ON c.\`courseId\` = cm.\`courseId\`
            SET cm.\`branchId\` = NULL,
                cm.\`updatedAt\` = CURRENT_TIMESTAMP(6)
            WHERE c.\`status\` = 'active'
              AND c.\`branchIdId\` IS NULL
              AND cm.\`branchId\` IS NOT NULL
        `);

        // 5. Active courses become org-wide (may already be NULL — 0 rows is fine).
        await queryRunner.query(`
            UPDATE \`courses\`
            SET \`branchIdId\` = NULL,
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            WHERE \`status\` = 'active'
              AND \`branchIdId\` IS NOT NULL
        `);
    }

    /**
     * Data migration — original branch ids are not stored; revert is a no-op.
     * Restore from a database backup if org-wide visibility must be undone.
     */
    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Intentionally empty.
    }
}
