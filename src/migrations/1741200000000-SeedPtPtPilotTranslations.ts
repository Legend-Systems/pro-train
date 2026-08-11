import { MigrationInterface, QueryRunner } from 'typeorm';
import { tableExists } from '../database/migration-utils';
import {
    revertPtPtTranslations,
    seedPtPtTranslations,
} from '../database/seed-pt-pt-translations';

const LOCALE = 'pt-PT';

/**
 * Seeds European Portuguese translations for all localized content and
 * enables pt-PT on org id 2. Idempotent — upserts existing rows.
 */
export class SeedPtPtPilotTranslations1741200000000
    implements MigrationInterface
{
    name = 'SeedPtPtPilotTranslations1741200000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'course_translations'))) {
            return;
        }

        await seedPtPtTranslations(queryRunner);

        // Enable pt-PT for pilot org (id = 2) when whiteLabelingConfig JSON exists.
        await queryRunner.query(
            `
            UPDATE \`organizations\`
            SET \`whiteLabelingConfig\` = JSON_SET(
                COALESCE(\`whiteLabelingConfig\`, JSON_OBJECT()),
                '$.localization.supportedLanguages',
                JSON_ARRAY('en', 'pt-PT'),
                '$.localization.defaultLanguage',
                'en',
                '$.localization.allowUserLanguageChange',
                true,
                '$.dashboard.features.languageSelector',
                true
            )
            WHERE \`id\` = '2'
            `,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await tableExists(queryRunner, 'course_translations'))) {
            return;
        }

        await revertPtPtTranslations(queryRunner);
    }
}
