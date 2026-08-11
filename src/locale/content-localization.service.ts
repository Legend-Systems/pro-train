import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DEFAULT_LOCALE } from './locale.constants';
import { CourseTranslation } from './entities/course-translation.entity';
import { TestTranslation } from './entities/test-translation.entity';
import { QuestionTranslation } from './entities/question-translation.entity';
import { QuestionOptionTranslation } from './entities/question-option-translation.entity';

/** Applies a translated string when present, otherwise keeps the base value. */
function coalesceTranslation(
    base: string | null | undefined,
    translated: string | null | undefined,
): string | undefined {
    const value = translated?.trim();
    return value && value.length > 0 ? value : base ?? undefined;
}

@Injectable()
export class ContentLocalizationService {
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

    shouldLocalize(locale: string | undefined): boolean {
        return !!locale && locale !== DEFAULT_LOCALE;
    }

    async loadCourseTranslation(
        courseId: number,
        locale: string,
    ): Promise<CourseTranslation | null> {
        if (!this.shouldLocalize(locale)) {
            return null;
        }

        return this.courseTranslationRepository.findOne({
            where: { courseId, locale },
        });
    }

    async loadTestTranslation(
        testId: number,
        locale: string,
    ): Promise<TestTranslation | null> {
        if (!this.shouldLocalize(locale)) {
            return null;
        }

        return this.testTranslationRepository.findOne({
            where: { testId, locale },
        });
    }

    async loadQuestionTranslations(
        questionIds: readonly number[],
        locale: string,
    ): Promise<Map<number, QuestionTranslation>> {
        const map = new Map<number, QuestionTranslation>();
        if (!this.shouldLocalize(locale) || questionIds.length === 0) {
            return map;
        }

        const rows = await this.questionTranslationRepository.find({
            where: { questionId: In([...questionIds]), locale },
        });

        for (const row of rows) {
            map.set(row.questionId, row);
        }

        return map;
    }

    async loadOptionTranslations(
        optionIds: readonly number[],
        locale: string,
    ): Promise<Map<number, QuestionOptionTranslation>> {
        const map = new Map<number, QuestionOptionTranslation>();
        if (!this.shouldLocalize(locale) || optionIds.length === 0) {
            return map;
        }

        const rows = await this.optionTranslationRepository.find({
            where: { optionId: In([...optionIds]), locale },
        });

        for (const row of rows) {
            map.set(row.optionId, row);
        }

        return map;
    }

    applyCourseFields<T extends { title?: string; description?: string }>(
        course: T,
        translation: CourseTranslation | null,
    ): T {
        if (!translation) {
            return course;
        }

        return {
            ...course,
            title: coalesceTranslation(course.title, translation.title) ?? course.title,
            description:
                coalesceTranslation(course.description, translation.description) ??
                course.description,
        };
    }

    applyTestFields<T extends { title?: string; description?: string }>(
        test: T,
        translation: TestTranslation | null,
    ): T {
        if (!translation) {
            return test;
        }

        return {
            ...test,
            title: coalesceTranslation(test.title, translation.title) ?? test.title,
            description:
                coalesceTranslation(test.description, translation.description) ??
                test.description,
        };
    }

    applyQuestionFields<
        T extends {
            questionId: number;
            questionText?: string;
            explanation?: string;
            hint?: string;
            mediaInstructions?: string;
            options?: Array<{
                optionId: number;
                optionText?: string;
                [key: string]: unknown;
            }>;
        },
    >(
        question: T,
        questionTranslation: QuestionTranslation | undefined,
        optionTranslations: Map<number, QuestionOptionTranslation>,
    ): T {
        const localizedQuestion = questionTranslation
            ? {
                  ...question,
                  questionText:
                      coalesceTranslation(
                          question.questionText,
                          questionTranslation.questionText,
                      ) ?? question.questionText,
                  explanation:
                      coalesceTranslation(
                          question.explanation,
                          questionTranslation.explanation,
                      ) ?? question.explanation,
                  hint:
                      coalesceTranslation(question.hint, questionTranslation.hint) ??
                      question.hint,
                  mediaInstructions:
                      coalesceTranslation(
                          question.mediaInstructions,
                          questionTranslation.mediaInstructions,
                      ) ?? question.mediaInstructions,
              }
            : question;

        if (!localizedQuestion.options?.length) {
            return localizedQuestion;
        }

        return {
            ...localizedQuestion,
            options: localizedQuestion.options.map((option) => {
                const optionTranslation = optionTranslations.get(option.optionId);
                if (!optionTranslation) {
                    return option;
                }

                return {
                    ...option,
                    optionText:
                        coalesceTranslation(
                            option.optionText,
                            optionTranslation.optionText,
                        ) ?? option.optionText,
                };
            }),
        };
    }
}
