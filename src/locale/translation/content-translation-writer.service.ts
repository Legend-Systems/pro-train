import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseTranslation } from '../entities/course-translation.entity';
import { TestTranslation } from '../entities/test-translation.entity';
import { QuestionTranslation } from '../entities/question-translation.entity';
import { QuestionOptionTranslation } from '../entities/question-option-translation.entity';
import { TRANSLATION_TARGET_LOCALE } from './translation.constants';
import type {
    CourseTranslationFields,
    OptionTranslationFields,
    QuestionTranslationFields,
    TestTranslationFields,
} from './content-translation.types';
import { isEmptyTranslationText } from './translation-text.util';

/**
 * Idempotent upserts into the four pt-PT sidecar tables.
 * Mirrors `seed-pt-pt-translations.ts` so runtime writes stay consistent with migrations.
 */
@Injectable()
export class ContentTranslationWriterService {
    constructor(
        @InjectRepository(CourseTranslation)
        private readonly courseTranslationRepository: Repository<CourseTranslation>,
        @InjectRepository(TestTranslation)
        private readonly testTranslationRepository: Repository<TestTranslation>,
        @InjectRepository(QuestionTranslation)
        private readonly questionTranslationRepository: Repository<QuestionTranslation>,
        @InjectRepository(QuestionOptionTranslation)
        private readonly optionTranslationRepository: Repository<QuestionOptionTranslation>,
    ) {}

    async upsertCourseTranslation(
        courseId: number,
        fields: CourseTranslationFields,
    ): Promise<void> {
        await this.courseTranslationRepository.query(
            `
            INSERT INTO \`course_translations\`
                (\`courseId\`, \`locale\`, \`title\`, \`description\`)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                \`title\` = VALUES(\`title\`),
                \`description\` = VALUES(\`description\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            [
                courseId,
                TRANSLATION_TARGET_LOCALE,
                this.toNullable(fields.title),
                this.toNullable(fields.description),
            ],
        );
    }

    async upsertTestTranslation(
        testId: number,
        fields: TestTranslationFields,
    ): Promise<void> {
        await this.testTranslationRepository.query(
            `
            INSERT INTO \`test_translations\`
                (\`testId\`, \`locale\`, \`title\`, \`description\`)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                \`title\` = VALUES(\`title\`),
                \`description\` = VALUES(\`description\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            [
                testId,
                TRANSLATION_TARGET_LOCALE,
                this.toNullable(fields.title),
                this.toNullable(fields.description),
            ],
        );
    }

    async upsertQuestionTranslation(
        questionId: number,
        fields: QuestionTranslationFields,
    ): Promise<void> {
        await this.questionTranslationRepository.query(
            `
            INSERT INTO \`question_translations\`
                (\`questionId\`, \`locale\`, \`questionText\`, \`explanation\`, \`hint\`, \`mediaInstructions\`)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                \`questionText\` = VALUES(\`questionText\`),
                \`explanation\` = VALUES(\`explanation\`),
                \`hint\` = VALUES(\`hint\`),
                \`mediaInstructions\` = VALUES(\`mediaInstructions\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            [
                questionId,
                TRANSLATION_TARGET_LOCALE,
                this.toNullable(fields.questionText),
                this.toNullable(fields.explanation),
                this.toNullable(fields.hint),
                this.toNullable(fields.mediaInstructions),
            ],
        );
    }

    async upsertOptionTranslation(
        optionId: number,
        fields: OptionTranslationFields,
    ): Promise<void> {
        await this.optionTranslationRepository.query(
            `
            INSERT INTO \`question_option_translations\`
                (\`optionId\`, \`locale\`, \`optionText\`)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
                \`optionText\` = VALUES(\`optionText\`),
                \`updatedAt\` = CURRENT_TIMESTAMP(6)
            `,
            [
                optionId,
                TRANSLATION_TARGET_LOCALE,
                this.toNullable(fields.optionText),
            ],
        );
    }

    async findCourseTranslation(
        courseId: number,
    ): Promise<CourseTranslation | null> {
        return this.courseTranslationRepository.findOne({
            where: { courseId, locale: TRANSLATION_TARGET_LOCALE },
        });
    }

    async findTestTranslation(testId: number): Promise<TestTranslation | null> {
        return this.testTranslationRepository.findOne({
            where: { testId, locale: TRANSLATION_TARGET_LOCALE },
        });
    }

    async findQuestionTranslation(
        questionId: number,
    ): Promise<QuestionTranslation | null> {
        return this.questionTranslationRepository.findOne({
            where: { questionId, locale: TRANSLATION_TARGET_LOCALE },
        });
    }

    async findOptionTranslation(
        optionId: number,
    ): Promise<QuestionOptionTranslation | null> {
        return this.optionTranslationRepository.findOne({
            where: { optionId, locale: TRANSLATION_TARGET_LOCALE },
        });
    }

    /** Maps empty English to SQL NULL so we never persist blank translations. */
    private toNullable(value: string | null | undefined): string | null {
        return isEmptyTranslationText(value) ? null : value!.trim();
    }
}
