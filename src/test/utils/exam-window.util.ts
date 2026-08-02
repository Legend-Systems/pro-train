import { SelectQueryBuilder } from 'typeorm';

/**
 * Exam availability window helpers.
 *
 * Tests used to carry a single `examDate` and were only available on that exact
 * calendar day. They now carry an `examStartDate`/`examEndDate` pair so an
 * organization can give learners several days to complete the test.
 *
 * Window semantics (shared with web + mobile):
 * - Boundaries are treated as whole UTC calendar days, so a window ending on
 *   2026-05-22 stays open for the entirety of that day.
 * - A null boundary is unbounded: no start means "already open", no end means
 *   "open-ended". A test with neither boundary is always available.
 */

/** Minimal shape needed to evaluate a window (entities and plain rows alike). */
export interface ExamWindowFields {
    examStartDate?: Date | string | null;
    examEndDate?: Date | string | null;
}

/** Half-open UTC day range `[start, end)` containing `reference`. */
export interface UtcDayBounds {
    startOfDay: Date;
    startOfNextDay: Date;
}

/** Message surfaced to learners who reach a test after its window closed. */
export const EXAM_WINDOW_CLOSED_MESSAGE =
    'This test is no longer available — its exam window has closed';

/** Message surfaced to learners who reach a test before its window opens. */
export const EXAM_WINDOW_NOT_OPEN_MESSAGE =
    'This test is not available yet — its exam window has not opened';

/** Returns the UTC midnight boundaries of the day containing `reference`. */
export function getUtcDayBounds(reference: Date = new Date()): UtcDayBounds {
    const startOfDay = new Date(
        Date.UTC(
            reference.getUTCFullYear(),
            reference.getUTCMonth(),
            reference.getUTCDate(),
        ),
    );
    const startOfNextDay = new Date(startOfDay);
    startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1);
    return { startOfDay, startOfNextDay };
}

/** Coerces a nullable date-ish value into a valid `Date`, or null. */
export function toNullableDate(
    value?: Date | string | null,
): Date | null {
    if (value === null || value === undefined) {
        return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** True when `reference` falls inside the test's window (inclusive). */
export function isExamWindowOpen(
    test: ExamWindowFields,
    reference: Date = new Date(),
): boolean {
    const { startOfDay, startOfNextDay } = getUtcDayBounds(reference);
    const start = toNullableDate(test.examStartDate);
    const end = toNullableDate(test.examEndDate);

    if (start && start >= startOfNextDay) {
        return false;
    }

    if (end && end < startOfDay) {
        return false;
    }

    return true;
}

/** True when the window has a start date that is still in the future. */
export function isExamWindowPending(
    test: ExamWindowFields,
    reference: Date = new Date(),
): boolean {
    const start = toNullableDate(test.examStartDate);
    if (!start) {
        return false;
    }

    return start >= getUtcDayBounds(reference).startOfNextDay;
}

/** True when the window had an end date that has already elapsed. */
export function isExamWindowClosed(
    test: ExamWindowFields,
    reference: Date = new Date(),
): boolean {
    const end = toNullableDate(test.examEndDate);
    if (!end) {
        return false;
    }

    return end < getUtcDayBounds(reference).startOfDay;
}

/**
 * Restricts a query to tests whose exam window is currently open.
 * Unscheduled tests (no boundaries) are always included.
 */
export function applyOpenExamWindowFilter<T extends object>(
    query: SelectQueryBuilder<T>,
    alias: string,
    reference: Date = new Date(),
): SelectQueryBuilder<T> {
    const { startOfDay, startOfNextDay } = getUtcDayBounds(reference);

    query.andWhere(
        `(${alias}.examStartDate IS NULL OR ${alias}.examStartDate < :examWindowStartOfNextDay)`,
        { examWindowStartOfNextDay: startOfNextDay },
    );
    query.andWhere(
        `(${alias}.examEndDate IS NULL OR ${alias}.examEndDate >= :examWindowStartOfDay)`,
        { examWindowStartOfDay: startOfDay },
    );

    return query;
}

/** Human-readable window label used in emails and logs. */
export function formatExamWindowRange(
    test: ExamWindowFields,
    formatDate: (date: Date) => string,
): string {
    const start = toNullableDate(test.examStartDate);
    const end = toNullableDate(test.examEndDate);

    if (start && end) {
        return `${formatDate(start)} — ${formatDate(end)}`;
    }

    if (start) {
        return `From ${formatDate(start)}`;
    }

    if (end) {
        return `Until ${formatDate(end)}`;
    }

    return 'No scheduled window';
}
