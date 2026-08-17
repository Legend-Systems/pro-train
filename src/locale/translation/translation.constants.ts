/**
 * Runtime constants for automatic English → European Portuguese content translation.
 * Values may be overridden by environment variables (see `.env-example`).
 */

/** Event names emitted after a successful English content save. */
export const CONTENT_SAVED_EVENTS = {
    COURSE: 'content.saved.course',
    TEST: 'content.saved.test',
    QUESTION: 'content.saved.question',
    OPTION: 'content.saved.option',
} as const;

/** Event names emitted after a pt-PT translation upsert completes. */
export const CONTENT_TRANSLATED_EVENTS = {
    COURSE: 'content.translated.course',
    TEST: 'content.translated.test',
    QUESTION: 'content.translated.question',
    OPTION: 'content.translated.option',
} as const;

/** Canonical source locale stored in base tables. */
export const TRANSLATION_SOURCE_LOCALE = 'en' as const;

/** European Portuguese target locale written to sidecar tables. */
export const TRANSLATION_TARGET_LOCALE = 'pt-PT' as const;

/**
 * Starter monthly character budget for ProTrain's current catalog:
 * ~110k chars for a full 5-course / 15-test / 207-question / 655-option pass,
 * with headroom for ~15–25 new tests and admin edits per month.
 */
export const DEFAULT_MONTHLY_CHAR_BUDGET = 500_000;

/** Google Cloud Translation v3 practical per-request character cap. */
export const DEFAULT_MAX_BATCH_CHARS = 30_000;

/** Provider call retries after a transient failure. */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** Minimum delay between batched provider requests (ms). */
export const DEFAULT_MIN_REQUEST_INTERVAL_MS = 200;

export const TRANSLATION_PROVIDER_TOKEN = 'TRANSLATION_PROVIDER';

export const TRANSLATION_ENTITY_TYPES = [
    'course',
    'test',
    'question',
    'option',
] as const;

export type TranslationEntityType = (typeof TRANSLATION_ENTITY_TYPES)[number];

export const TRANSLATION_JOB_STATUSES = [
    'pending',
    'completed',
    'failed',
    'skipped',
] as const;

export type TranslationJobStatus = (typeof TRANSLATION_JOB_STATUSES)[number];
