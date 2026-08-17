import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Course } from '../../course/entities/course.entity';
import { Test } from '../../test/entities/test.entity';
import { Question } from '../../questions/entities/question.entity';
import { QuestionOption } from '../../questions_options/entities/questions_option.entity';
import { MachineTranslationService } from './machine-translation.service';
import { ContentTranslationWriterService } from './content-translation-writer.service';
import { ContentTranslationJobService } from './content-translation-job.service';
import {
    CONTENT_TRANSLATED_EVENTS,
    TRANSLATION_TARGET_LOCALE,
    type TranslationEntityType,
} from './translation.constants';
import type {
    CourseChangedFields,
    CourseTranslationFields,
    OptionChangedFields,
    OptionTranslationFields,
    QuestionChangedFields,
    QuestionTranslationFields,
    TestChangedFields,
    TestTranslationFields,
    TranslationStatusResponse,
} from './content-translation.types';
import {
    countCharacters,
    hashTranslationSource,
    isEmptyTranslationText,
} from './translation-text.util';
import { formatTranslationProviderError } from './translation-error.util';

interface TranslateFieldRequest {
    readonly key: string;
    readonly source: string;
}

/**
 * Loads English source rows, translates changed fields to pt-PT, and upserts
 * sidecar tables. Failures never roll back the original English save.
 */
@Injectable()
export class ContentTranslationOrchestratorService {
    private readonly logger = new Logger(
        ContentTranslationOrchestratorService.name,
    );

    constructor(
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(QuestionOption)
        private readonly optionRepository: Repository<QuestionOption>,
        private readonly machineTranslationService: MachineTranslationService,
        private readonly writer: ContentTranslationWriterService,
        private readonly jobService: ContentTranslationJobService,
        private readonly configService: ConfigService,
        private readonly eventEmitter: EventEmitter2,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    isEnabled(): boolean {
        const raw = this.configService.get<string>(
            'CONTENT_AUTO_TRANSLATION_ENABLED',
            'false',
        );
        return raw.toLowerCase() === 'true' || raw === '1';
    }

    async translateCourse(
        courseId: number,
        options: {
            readonly force?: boolean;
            readonly changedFields?: CourseChangedFields;
            readonly orgId?: string;
            readonly branchId?: string;
        } = {},
    ): Promise<void> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
        });
        if (!course) {
            throw new NotFoundException(`Course ${courseId} not found`);
        }

        const source: CourseTranslationFields = {
            title: course.title,
            description: course.description,
        };
        const hash = hashTranslationSource({
            title: source.title,
            description: source.description,
        });

        await this.runEntityTranslation({
            entityType: 'course',
            entityId: courseId,
            hash,
            force: options.force,
            fields: this.pickChangedFields(source, options.changedFields),
            persist: async (translated) => {
                const existing =
                    await this.writer.findCourseTranslation(courseId);
                await this.writer.upsertCourseTranslation(courseId, {
                    title:
                        translated.title ??
                        existing?.title ??
                        source.title,
                    description:
                        translated.description ??
                        existing?.description ??
                        source.description,
                });
            },
        });

        await this.invalidateCourseCache(
            courseId,
            options.orgId,
            options.branchId,
        );
        this.eventEmitter.emit(CONTENT_TRANSLATED_EVENTS.COURSE, { courseId });
    }

    async translateTest(
        testId: number,
        options: {
            readonly force?: boolean;
            readonly includeQuestions?: boolean;
            readonly changedFields?: TestChangedFields;
            readonly orgId?: string;
            readonly branchId?: string;
            readonly courseId?: number;
        } = {},
    ): Promise<void> {
        const test = await this.testRepository.findOne({ where: { testId } });
        if (!test) {
            throw new NotFoundException(`Test ${testId} not found`);
        }

        const source: TestTranslationFields = {
            title: test.title,
            description: test.description,
        };
        const hash = hashTranslationSource({
            title: source.title,
            description: source.description,
        });

        await this.runEntityTranslation({
            entityType: 'test',
            entityId: testId,
            hash,
            force: options.force,
            fields: this.pickChangedFields(source, options.changedFields),
            persist: async (translated) => {
                const existing = await this.writer.findTestTranslation(testId);
                await this.writer.upsertTestTranslation(testId, {
                    title:
                        translated.title ?? existing?.title ?? source.title,
                    description:
                        translated.description ??
                        existing?.description ??
                        source.description,
                });
            },
        });

        if (options.includeQuestions) {
            const questions = await this.questionRepository.find({
                where: { testId },
            });
            for (const question of questions) {
                await this.translateQuestion(question.questionId, {
                    force: options.force,
                    includeOptions: true,
                    orgId: options.orgId,
                    branchId: options.branchId,
                });
            }
        }

        await this.invalidateTestCache(
            testId,
            options.courseId ?? test.courseId,
            options.orgId,
            options.branchId,
        );
        this.eventEmitter.emit(CONTENT_TRANSLATED_EVENTS.TEST, { testId });
    }

    async translateQuestion(
        questionId: number,
        options: {
            readonly force?: boolean;
            readonly includeOptions?: boolean;
            readonly changedFields?: QuestionChangedFields;
            readonly orgId?: string;
            readonly branchId?: string;
        } = {},
    ): Promise<void> {
        const question = await this.questionRepository.findOne({
            where: { questionId },
        });
        if (!question) {
            throw new NotFoundException(`Question ${questionId} not found`);
        }

        const source: QuestionTranslationFields = {
            questionText: question.questionText,
            explanation: question.explanation,
            hint: question.hint,
            mediaInstructions: question.mediaInstructions,
        };
        const hash = hashTranslationSource({
            questionText: source.questionText,
            explanation: source.explanation,
            hint: source.hint,
            mediaInstructions: source.mediaInstructions,
        });

        await this.runEntityTranslation({
            entityType: 'question',
            entityId: questionId,
            hash,
            force: options.force,
            fields: this.pickChangedFields(source, options.changedFields),
            persist: async (translated) => {
                const existing =
                    await this.writer.findQuestionTranslation(questionId);
                await this.writer.upsertQuestionTranslation(questionId, {
                    questionText:
                        translated.questionText ??
                        existing?.questionText ??
                        source.questionText,
                    explanation:
                        translated.explanation ??
                        existing?.explanation ??
                        source.explanation,
                    hint: translated.hint ?? existing?.hint ?? source.hint,
                    mediaInstructions:
                        translated.mediaInstructions ??
                        existing?.mediaInstructions ??
                        source.mediaInstructions,
                });
            },
        });

        const includeOptions = options.includeOptions ?? false;
        if (includeOptions) {
            const optionsRows = await this.optionRepository.find({
                where: { questionId },
            });
            for (const option of optionsRows) {
                await this.translateOption(option.optionId, {
                    force: options.force,
                    orgId: options.orgId,
                    branchId: options.branchId,
                });
            }
        }

        await this.invalidateQuestionCache(
            questionId,
            question.testId,
            options.orgId,
            options.branchId,
        );
        this.eventEmitter.emit(CONTENT_TRANSLATED_EVENTS.QUESTION, {
            questionId,
        });
    }

    async translateOption(
        optionId: number,
        options: {
            readonly force?: boolean;
            readonly changedFields?: OptionChangedFields;
            readonly orgId?: string;
            readonly branchId?: string;
        } = {},
    ): Promise<void> {
        const option = await this.optionRepository.findOne({
            where: { optionId },
        });
        if (!option) {
            throw new NotFoundException(`Question option ${optionId} not found`);
        }

        const source: OptionTranslationFields = {
            optionText: option.optionText,
        };
        const hash = hashTranslationSource({ optionText: source.optionText });

        await this.runEntityTranslation({
            entityType: 'option',
            entityId: optionId,
            hash,
            force: options.force,
            fields: this.pickChangedFields(source, options.changedFields),
            persist: async (translated) => {
                const existing =
                    await this.writer.findOptionTranslation(optionId);
                await this.writer.upsertOptionTranslation(optionId, {
                    optionText:
                        translated.optionText ??
                        existing?.optionText ??
                        source.optionText,
                });
            },
        });

        await this.invalidateOptionCache(
            optionId,
            option.questionId,
            options.orgId,
            options.branchId,
        );
        this.eventEmitter.emit(CONTENT_TRANSLATED_EVENTS.OPTION, { optionId });
    }

    async getStatus(
        entityType: TranslationEntityType,
        entityId: number,
    ): Promise<TranslationStatusResponse> {
        const job = await this.jobService.findLatest(entityType, entityId);
        const missingFields = await this.collectMissingFields(
            entityType,
            entityId,
        );

        return {
            entityType,
            entityId,
            locale: TRANSLATION_TARGET_LOCALE,
            hasTranslation: missingFields.length === 0,
            missingFields,
            job,
        };
    }

    async retry(
        entityType: TranslationEntityType,
        entityId: number,
    ): Promise<TranslationStatusResponse> {
        switch (entityType) {
            case 'course':
                await this.translateCourse(entityId, { force: true });
                break;
            case 'test':
                await this.translateTest(entityId, {
                    force: true,
                    includeQuestions: true,
                });
                break;
            case 'question':
                await this.translateQuestion(entityId, {
                    force: true,
                    includeOptions: true,
                });
                break;
            case 'option':
                await this.translateOption(entityId, { force: true });
                break;
            default:
                throw new NotFoundException(
                    `Unsupported translation entity type: ${entityType}`,
                );
        }

        return this.getStatus(entityType, entityId);
    }

    private async runEntityTranslation(params: {
        readonly entityType: TranslationEntityType;
        readonly entityId: number;
        readonly hash: string;
        readonly force?: boolean;
        readonly fields: object;
        readonly persist: (
            translated: Record<string, string | null>,
        ) => Promise<void>;
    }): Promise<void> {
        const fieldMap = params.fields as Record<
            string,
            string | null | undefined
        >;
        const requests: TranslateFieldRequest[] = Object.entries(fieldMap)
            .filter(([, value]) => !isEmptyTranslationText(value))
            .map(([key, value]) => ({
                key,
                source: value!.trim(),
            }));

        if (requests.length === 0) {
            this.logger.log(
                `translation.skipped entity=${params.entityType} id=${params.entityId} reason=empty-fields`,
            );
            await this.jobService.markSkipped(
                params.entityType,
                params.entityId,
                params.hash,
            );
            return;
        }

        if (!params.force) {
            const existing = await this.jobService.findLatest(
                params.entityType,
                params.entityId,
            );
            if (
                existing?.status === 'completed' &&
                existing.sourceContentHash === params.hash
            ) {
                this.logger.log(
                    `translation.skipped entity=${params.entityType} id=${params.entityId} reason=unchanged-hash`,
                );
                await this.jobService.markSkipped(
                    params.entityType,
                    params.entityId,
                    params.hash,
                );
                return;
            }
        }

        await this.jobService.markPending(
            params.entityType,
            params.entityId,
            params.hash,
        );

        const startedAt = Date.now();
        this.logger.log(
            `translation.started entity=${params.entityType} id=${params.entityId} fields=${requests.length} chars=${countCharacters(requests.map((item) => item.source))}`,
        );

        try {
            const translatedValues =
                await this.machineTranslationService.translateTexts(
                    requests.map((item) => item.source),
                );
            const translated: Record<string, string | null> = {};
            requests.forEach((item, index) => {
                translated[item.key] = translatedValues[index] ?? item.source;
            });

            await params.persist(translated);
            await this.jobService.markCompleted(
                params.entityType,
                params.entityId,
                {
                    sourceContentHash: params.hash,
                    charactersTranslated: countCharacters(
                        requests.map((item) => item.source),
                    ),
                },
            );

            this.logger.log(
                `translation.completed entity=${params.entityType} id=${params.entityId} fields=${requests.length} durationMs=${Date.now() - startedAt}`,
            );
        } catch (error) {
            const message = formatTranslationProviderError(error);
            this.logger.error(
                `translation.failed entity=${params.entityType} id=${params.entityId} durationMs=${Date.now() - startedAt} error=${message}`,
            );
            await this.jobService.markFailed(
                params.entityType,
                params.entityId,
                message,
                params.hash,
            );
            throw error;
        }
    }

    private pickChangedFields<T extends object>(
        source: T,
        changedFields?: object,
    ): T {
        if (!changedFields) {
            return source;
        }

        const flags = changedFields as Record<string, boolean | undefined>;
        const picked = { ...source } as T;
        for (const key of Object.keys(source)) {
            if (flags[key] === false) {
                delete (picked as Record<string, unknown>)[key];
            }
        }
        return picked;
    }

    private async collectMissingFields(
        entityType: TranslationEntityType,
        entityId: number,
    ): Promise<string[]> {
        switch (entityType) {
            case 'course': {
                const row = await this.writer.findCourseTranslation(entityId);
                return this.missingOf(
                    { title: row?.title, description: row?.description },
                    ['title', 'description'],
                );
            }
            case 'test': {
                const row = await this.writer.findTestTranslation(entityId);
                return this.missingOf(
                    { title: row?.title, description: row?.description },
                    ['title', 'description'],
                );
            }
            case 'question': {
                const row = await this.writer.findQuestionTranslation(entityId);
                return this.missingOf(
                    {
                        questionText: row?.questionText,
                        explanation: row?.explanation,
                        hint: row?.hint,
                        mediaInstructions: row?.mediaInstructions,
                    },
                    ['questionText'],
                );
            }
            case 'option': {
                const row = await this.writer.findOptionTranslation(entityId);
                return this.missingOf({ optionText: row?.optionText }, [
                    'optionText',
                ]);
            }
            default:
                return [];
        }
    }

    private missingOf(
        values: Record<string, string | null | undefined>,
        required: readonly string[],
    ): string[] {
        return required.filter((field) => isEmptyTranslationText(values[field]));
    }

    private async invalidateCourseCache(
        courseId: number,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        await this.deleteKeys([
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:course:${courseId}`,
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:course:detail:${courseId}`,
            `org:global:branch:global:course:${courseId}`,
        ]);
    }

    private async invalidateTestCache(
        testId: number,
        courseId?: number,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keys = [
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}`,
            `org:global:branch:global:test:${testId}`,
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}:questions`,
        ];
        if (courseId) {
            keys.push(
                `org:${orgId || 'global'}:branch:${branchId || 'global'}:course:${courseId}:tests`,
            );
        }
        await this.deleteKeys(keys);
    }

    private async invalidateQuestionCache(
        questionId: number,
        testId: number,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        await this.deleteKeys([
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:question:${questionId}`,
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:test:${testId}:questions`,
        ]);
    }

    private async invalidateOptionCache(
        optionId: number,
        questionId: number,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        await this.deleteKeys([
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:question-option:${optionId}`,
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:question-options:question:${questionId}`,
        ]);
    }

    private async deleteKeys(keys: readonly string[]): Promise<void> {
        await Promise.all(
            keys.map(async (key) => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete translation cache key ${key}: ${
                            error instanceof Error ? error.message : 'unknown'
                        }`,
                    );
                }
            }),
        );
    }
}
