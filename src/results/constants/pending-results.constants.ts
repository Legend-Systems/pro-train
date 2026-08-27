/**
 * Admin “Pending Results” grading — attempts that finished (or look finished)
 * but never received a `results` row (see attempt 668: submitted answers,
 * auto-mark completed, result insert timed out).
 */

/** In-progress attempts at this progress are treated as stuck mid-submit. */
export const PENDING_IN_PROGRESS_MIN_PERCENTAGE = 100;

/** Sequential bulk grade cap — each item auto-marks then writes a result. */
export const MAX_BULK_GRADE_ATTEMPTS = 25;

export const DEFAULT_PENDING_RESULTS_PAGE = 1;

export const DEFAULT_PENDING_RESULTS_LIMIT = 20;

export const MAX_PENDING_RESULTS_LIMIT = 50;
