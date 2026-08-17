import type {
    TranslationEntityType,
    TranslationJobStatus,
} from './translation.constants';

/** Contract implemented by Google Cloud Translation and the noop test adapter. */
export interface TranslationProvider {
    translateBatch(params: {
        readonly texts: readonly string[];
        readonly sourceLocale: 'en';
        readonly targetLocale: 'pt-PT';
    }): Promise<readonly string[]>;
}

export interface CourseTranslationFields {
    readonly title?: string | null;
    readonly description?: string | null;
}

export interface TestTranslationFields {
    readonly title?: string | null;
    readonly description?: string | null;
}

export interface QuestionTranslationFields {
    readonly questionText?: string | null;
    readonly explanation?: string | null;
    readonly hint?: string | null;
    readonly mediaInstructions?: string | null;
}

export interface OptionTranslationFields {
    readonly optionText?: string | null;
}

export interface CourseChangedFields {
    readonly title?: boolean;
    readonly description?: boolean;
}

export interface TestChangedFields {
    readonly title?: boolean;
    readonly description?: boolean;
}

export interface QuestionChangedFields {
    readonly questionText?: boolean;
    readonly explanation?: boolean;
    readonly hint?: boolean;
    readonly mediaInstructions?: boolean;
}

export interface OptionChangedFields {
    readonly optionText?: boolean;
}

export interface TranslateEntityOptions {
    readonly force?: boolean;
    readonly includeQuestions?: boolean;
    readonly changedFields?:
        | CourseChangedFields
        | TestChangedFields
        | QuestionChangedFields
        | OptionChangedFields;
}

export interface TranslationJobSnapshot {
    readonly jobId: number;
    readonly entityType: TranslationEntityType;
    readonly entityId: number;
    readonly locale: string;
    readonly status: TranslationJobStatus;
    readonly lastError: string | null;
    readonly sourceContentHash: string | null;
    readonly charactersTranslated: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export interface TranslationStatusResponse {
    readonly entityType: TranslationEntityType;
    readonly entityId: number;
    readonly locale: string;
    readonly hasTranslation: boolean;
    readonly missingFields: readonly string[];
    readonly job: TranslationJobSnapshot | null;
}
