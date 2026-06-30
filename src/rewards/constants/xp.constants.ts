/**
 * XP gamification constants for ProTrain rewards.
 * Mirrors the LORO XP model with ProTrain-specific point values and level bands.
 * All awards must reference these constants — never hard-code XP amounts in services.
 */

/** Points awarded per learner/admin action. */
export const XP_VALUES = {
    DAILY_LOGIN: 10,
    COMPLETE_PROFILE: 40,
    START_TEST_ATTEMPT: 5,
    SUBMIT_TEST: 15,
    PASS_TEST: 20,
    PASS_TEST_FIRST_TRY: 15,
    PERFECT_SCORE: 40,
    IMPROVE_SCORE: 10,
    COMPLETE_COURSE: 75,
    VIEW_COURSE_MATERIAL: 5,
    COMPLETE_ALL_MATERIALS: 25,
    LEARNING_STREAK_7: 50,
    WEEKLY_TRAINING_GOAL: 30,
    WEEKLY_TRAINING_HOURS_2: 30,
    MONTHLY_TRAINING_HOURS_5: 25,
    MONTHLY_TRAINING_HOURS_10: 50,
    DAILY_TRAINING_30MIN: 15,
    CREATE_COURSE: 25,
    CREATE_TEST: 15,
    ADD_COURSE_MATERIAL: 5,
} as const;

/** Stored in xp_transaction.action — stable action codes for audit and reporting. */
export const XP_ACTIONS = {
    DAILY_LOGIN: 'DAILY_LOGIN',
    COMPLETE_PROFILE: 'COMPLETE_PROFILE',
    START_TEST_ATTEMPT: 'START_TEST_ATTEMPT',
    SUBMIT_TEST: 'SUBMIT_TEST',
    PASS_TEST: 'PASS_TEST',
    PASS_TEST_FIRST_TRY: 'PASS_TEST_FIRST_TRY',
    PERFECT_SCORE: 'PERFECT_SCORE',
    IMPROVE_SCORE: 'IMPROVE_SCORE',
    COMPLETE_COURSE: 'COMPLETE_COURSE',
    VIEW_COURSE_MATERIAL: 'VIEW_COURSE_MATERIAL',
    COMPLETE_ALL_MATERIALS: 'COMPLETE_ALL_MATERIALS',
    LEARNING_STREAK_7: 'LEARNING_STREAK_7',
    WEEKLY_TRAINING_GOAL: 'WEEKLY_TRAINING_GOAL',
    WEEKLY_TRAINING_HOURS_2: 'WEEKLY_TRAINING_HOURS_2',
    MONTHLY_TRAINING_HOURS_5: 'MONTHLY_TRAINING_HOURS_5',
    MONTHLY_TRAINING_HOURS_10: 'MONTHLY_TRAINING_HOURS_10',
    DAILY_TRAINING_30MIN: 'DAILY_TRAINING_30MIN',
    CREATE_COURSE: 'CREATE_COURSE',
    CREATE_TEST: 'CREATE_TEST',
    ADD_COURSE_MATERIAL: 'ADD_COURSE_MATERIAL',
    MANUAL_AWARD: 'MANUAL_AWARD',
} as const;

/** Stored in xp_transaction.metadata.sourceType — identifies the originating domain. */
export const XP_SOURCE_TYPES = {
    AUTH: 'auth',
    USER: 'user',
    TEST_ATTEMPT: 'test_attempt',
    TEST_RESULT: 'test_result',
    COURSE: 'course',
    COURSE_MATERIAL: 'course_material',
    TRAINING_PROGRESS: 'training_progress',
    STREAK: 'streak',
    ADMIN: 'admin',
} as const;

/** Keys used in xpBreakdown / challengeMonthXpBreakdown JSON aggregates. */
export const XP_CATEGORIES = {
    LEARNING: 'learning',
    COURSES: 'courses',
    ENGAGEMENT: 'engagement',
    PROFILE: 'profile',
    MATERIALS: 'materials',
    AUTHORING: 'authoring',
    OTHER: 'other',
} as const;

export type XpCategory = (typeof XP_CATEGORIES)[keyof typeof XP_CATEGORIES];
export type XpAction = (typeof XP_ACTIONS)[keyof typeof XP_ACTIONS];
export type XpSourceType =
    (typeof XP_SOURCE_TYPES)[keyof typeof XP_SOURCE_TYPES];

/** Rank tier labels derived from level. */
export const RANKS = {
    ROOKIE: 'ROOKIE',
    BRONZE: 'BRONZE',
    SILVER: 'SILVER',
    GOLD: 'GOLD',
    PLATINUM: 'PLATINUM',
    DIAMOND: 'DIAMOND',
} as const;

export type XpRank = (typeof RANKS)[keyof typeof RANKS];

/** Level bands by lifetime totalXP — wider than LORO to suit LMS pacing. */
export const LEVELS: ReadonlyArray<{
    level: number;
    minXp: number;
    maxXp: number;
}> = [
    { level: 1, minXp: 0, maxXp: 500 },
    { level: 2, minXp: 501, maxXp: 1500 },
    { level: 3, minXp: 1501, maxXp: 3500 },
    { level: 4, minXp: 3501, maxXp: 7000 },
    { level: 5, minXp: 7001, maxXp: 12000 },
    { level: 6, minXp: 12001, maxXp: 20000 },
    { level: 7, minXp: 20001, maxXp: 32000 },
    { level: 8, minXp: 32001, maxXp: 50000 },
    { level: 9, minXp: 50001, maxXp: 75000 },
    { level: 10, minXp: 75001, maxXp: 1_000_000 },
] as const;

/** Maximum closed monthly challenge records retained per user. */
export const MONTHLY_CHALLENGE_HISTORY_CAP = 48;

/** Default rank/level for newly created UserRewards rows. */
export const DEFAULT_LEVEL = 1;
export const DEFAULT_RANK: XpRank = RANKS.ROOKIE;
