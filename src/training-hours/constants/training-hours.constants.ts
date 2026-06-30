/** Caps and thresholds for training hours recording. */
export const TRAINING_HOURS = {
    MIN_SESSION_MINUTES: 1,
    DEFAULT_MAX_ATTEMPT_MINUTES: 120,
    IDLE_TIMEOUT_MINUTES: 5,
    MINUTES_PER_HOUR: 60,
    MATERIAL_MIN_SESSION_MINUTES: 1,
} as const;

/** Session type codes stored on the training_session ledger. */
export const TRAINING_SESSION_TYPES = {
    TEST_ATTEMPT: 'test_attempt',
    COURSE_MATERIAL: 'course_material',
} as const;

export type TrainingSessionType =
    (typeof TRAINING_SESSION_TYPES)[keyof typeof TRAINING_SESSION_TYPES];

/** Hour-based XP milestone thresholds (minutes). */
export const TRAINING_HOURS_XP_THRESHOLDS = {
    DAILY_MINUTES: 30,
    WEEKLY_MINUTES: 120,
    MONTHLY_5_HOURS_MINUTES: 300,
    MONTHLY_10_HOURS_MINUTES: 600,
} as const;
