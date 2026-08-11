import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists } from '../database/migration-utils';
import {
    revertPtPtTranslations,
    seedPtPtTranslations,
} from '../database/seed-pt-pt-translations';

/**
 * Backfills European Portuguese translations for all courses, tests, questions,
 * and question options. Upserts rows so it also corrects partial pilot seeds.
 */
export class BackfillAllPtPtTranslations1741300000000
    implements MigrationInterface
{
    name = 'BackfillAllPtPtTranslations1741300000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'course_translations'))) {
            return;
        }

        await seedPtPtTranslations(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'course_translations'))) {
            return;
        }

        await revertPtPtTranslations(queryRunner);
    }
}
