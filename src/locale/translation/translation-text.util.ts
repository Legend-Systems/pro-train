import { createHash } from 'crypto';

/** Trims and collapses whitespace so hash/diff comparisons stay stable. */
export function normalizeTranslationText(
    value: string | null | undefined,
): string {
    if (value == null) {
        return '';
    }

    return value.trim().replace(/\s+/g, ' ');
}

/** True when the value has nothing worth sending to the translation provider. */
export function isEmptyTranslationText(
    value: string | null | undefined,
): boolean {
    return normalizeTranslationText(value).length === 0;
}

/** True when two English fields differ after normalization. */
export function hasTextChanged(
    previous: string | null | undefined,
    next: string | null | undefined,
): boolean {
    return normalizeTranslationText(previous) !== normalizeTranslationText(next);
}

/**
 * SHA-256 of concatenated translatable fields. Used to skip unchanged re-saves.
 */
export function hashTranslationSource(
    fields: Readonly<Record<string, string | null | undefined>>,
): string {
    const payload = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${normalizeTranslationText(fields[key])}`)
        .join('\n');

    return createHash('sha256').update(payload).digest('hex');
}

/**
 * Splits strings into batches that stay under the provider character cap
 * while preserving input order.
 */
export function splitIntoCharacterBatches(
    texts: readonly string[],
    maxBatchChars: number,
): string[][] {
    const batches: string[][] = [];
    let current: string[] = [];
    let currentChars = 0;

    for (const text of texts) {
        const length = text.length;

        if (current.length > 0 && currentChars + length > maxBatchChars) {
            batches.push(current);
            current = [];
            currentChars = 0;
        }

        current.push(text);
        currentChars += length;
    }

    if (current.length > 0) {
        batches.push(current);
    }

    return batches;
}

/** Counts billed characters for a list of source strings. */
export function countCharacters(texts: readonly string[]): number {
    return texts.reduce((total, text) => total + text.length, 0);
}
