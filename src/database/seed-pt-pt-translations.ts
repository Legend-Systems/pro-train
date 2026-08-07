import * as path from 'path';
import type { QueryRunner } from 'typeorm';

/** European Portuguese translation payload for content seed migrations. */
export interface PtPtTranslationSeed {
    locale: string;
    courses: Record<
        string,
        {
            title: string;
            description: string;
        }
    >;
    tests: Record<
        string,
        {
            title: string;
            description: string;
        }
    >;
    questions: Record<
        string,
        {
            questionText: string;
            explanation: string | null;
            hint: string | null;
            mediaInstructions: string | null;
        }
    >;
    options: Record<
        string,
        {
            optionText: string;
        }
    >;
}

const BATCH_SIZE = 50;

function loadTranslationSeed(): PtPtTranslationSeed {
    const seedPath = path.join(
        __dirname,
        '../migrations/data/pt-pt-translations.json',
    );

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(seedPath) as PtPtTranslationSeed;
}

function chunk<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];

    for (let index = 0; index < items.length; index += size) {
        batches.push(items.slice(index, index + size));
    }

    return batches;
}

/**
 * Upserts all pt-PT course, test, question, and option translations from the
 * bundled seed JSON. Idempotent — updates rows that already exist.
 */
export async function seedPtPtTranslations(
    queryRunner: QueryRunner,
): Promise<void> {
    const seed = loadTranslationSeed();
    const locale = seed.locale;

    const courseRows = Object.entries(seed.courses).map(([courseId, row]) => [
        Number(courseId),
        locale,
        row.title,
        row.description,
    ]);

    for (const batch of chunk(courseRows, BATCH_SIZE)) {
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const params = batch.flat();

        await queryRunner.query(
            `
            INSERT INTO \`course_translations\`
                (\`courseId\`, \`locale\`, \`title\`, \`description\`)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                \`title\` = VALUES(\`title\`),
                \`description\` = VALUES(\`description\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            params,
        );
    }

    const testRows = Object.entries(seed.tests).map(([testId, row]) => [
        Number(testId),
        locale,
        row.title,
        row.description,
    ]);

    for (const batch of chunk(testRows, BATCH_SIZE)) {
        const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
        const params = batch.flat();

        await queryRunner.query(
            `
            INSERT INTO \`test_translations\`
                (\`testId\`, \`locale\`, \`title\`, \`description\`)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                \`title\` = VALUES(\`title\`),
                \`description\` = VALUES(\`description\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            params,
        );
    }

    const questionRows = Object.entries(seed.questions).map(
        ([questionId, row]) => [
            Number(questionId),
            locale,
            row.questionText,
            row.explanation,
            row.hint,
            row.mediaInstructions,
        ],
    );

    for (const batch of chunk(questionRows, BATCH_SIZE)) {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const params = batch.flat();

        await queryRunner.query(
            `
            INSERT INTO \`question_translations\`
                (\`questionId\`, \`locale\`, \`questionText\`, \`explanation\`, \`hint\`, \`mediaInstructions\`)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                \`questionText\` = VALUES(\`questionText\`),
                \`explanation\` = VALUES(\`explanation\`),
                \`hint\` = VALUES(\`hint\`),
                \`mediaInstructions\` = VALUES(\`mediaInstructions\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            params,
        );
    }

    const optionRows = Object.entries(seed.options).map(([optionId, row]) => [
        Number(optionId),
        locale,
        row.optionText,
    ]);

    for (const batch of chunk(optionRows, BATCH_SIZE)) {
        const placeholders = batch.map(() => '(?, ?, ?)').join(', ');
        const params = batch.flat();

        await queryRunner.query(
            `
            INSERT INTO \`question_option_translations\`
                (\`optionId\`, \`locale\`, \`optionText\`)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE
                \`optionText\` = VALUES(\`optionText\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            params,
        );
    }
}

/** Removes pt-PT rows seeded from the bundled translation JSON. */
export async function revertPtPtTranslations(
    queryRunner: QueryRunner,
): Promise<void> {
    const seed = loadTranslationSeed();
    const locale = seed.locale;

    const optionIds = Object.keys(seed.options).map(Number);
    const questionIds = Object.keys(seed.questions).map(Number);
    const testIds = Object.keys(seed.tests).map(Number);
    const courseIds = Object.keys(seed.courses).map(Number);

    for (const batch of chunk(optionIds, BATCH_SIZE)) {
        await queryRunner.query(
            `
            DELETE FROM \`question_option_translations\`
            WHERE \`locale\` = ? AND \`optionId\` IN (${batch.map(() => '?').join(', ')})
            `,
            [locale, ...batch],
        );
    }

    for (const batch of chunk(questionIds, BATCH_SIZE)) {
        await queryRunner.query(
            `
            DELETE FROM \`question_translations\`
            WHERE \`locale\` = ? AND \`questionId\` IN (${batch.map(() => '?').join(', ')})
            `,
            [locale, ...batch],
        );
    }

    for (const batch of chunk(testIds, BATCH_SIZE)) {
        await queryRunner.query(
            `
            DELETE FROM \`test_translations\`
            WHERE \`locale\` = ? AND \`testId\` IN (${batch.map(() => '?').join(', ')})
            `,
            [locale, ...batch],
        );
    }

    for (const batch of chunk(courseIds, BATCH_SIZE)) {
        await queryRunner.query(
            `
            DELETE FROM \`course_translations\`
            WHERE \`locale\` = ? AND \`courseId\` IN (${batch.map(() => '?').join(', ')})
            `,
            [locale, ...batch],
        );
    }
}
