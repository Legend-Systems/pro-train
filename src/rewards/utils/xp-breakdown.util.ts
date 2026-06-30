import {
    XP_ACTIONS,
    XP_CATEGORIES,
    XP_SOURCE_TYPES,
    type XpAction,
    type XpCategory,
    type XpSourceType,
} from '../constants/xp.constants';

export type XpBreakdown = Record<XpCategory, number>;

/** Returns a zeroed breakdown object with all known category keys. */
export function createEmptyXpBreakdown(): XpBreakdown {
    return {
        [XP_CATEGORIES.LEARNING]: 0,
        [XP_CATEGORIES.COURSES]: 0,
        [XP_CATEGORIES.ENGAGEMENT]: 0,
        [XP_CATEGORIES.PROFILE]: 0,
        [XP_CATEGORIES.MATERIALS]: 0,
        [XP_CATEGORIES.AUTHORING]: 0,
        [XP_CATEGORIES.OTHER]: 0,
    };
}

/**
 * Normalizes a partial breakdown from DB JSON into a complete XpBreakdown.
 * Mirrors LORO normalizeXpBreakdown — keeps aggregates stable when categories are added.
 */
export function normalizeXpBreakdown(
    raw: Partial<Record<string, number>> | null | undefined,
): XpBreakdown {
    const base = createEmptyXpBreakdown();

    if (!raw || typeof raw !== 'object') {
        return base;
    }

    for (const category of Object.values(XP_CATEGORIES)) {
        const value = raw[category];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
            base[category] = value;
        }
    }

    return base;
}

/** Maps an XP action code to its breakdown category. */
export function mapActionToCategory(action: string): XpCategory {
    switch (action as XpAction) {
        case XP_ACTIONS.SUBMIT_TEST:
        case XP_ACTIONS.PASS_TEST:
        case XP_ACTIONS.PASS_TEST_FIRST_TRY:
        case XP_ACTIONS.PERFECT_SCORE:
        case XP_ACTIONS.IMPROVE_SCORE:
            return XP_CATEGORIES.LEARNING;
        case XP_ACTIONS.COMPLETE_COURSE:
        case XP_ACTIONS.COMPLETE_ALL_MATERIALS:
            return XP_CATEGORIES.COURSES;
        case XP_ACTIONS.DAILY_LOGIN:
        case XP_ACTIONS.START_TEST_ATTEMPT:
        case XP_ACTIONS.LEARNING_STREAK_7:
        case XP_ACTIONS.WEEKLY_TRAINING_GOAL:
        case XP_ACTIONS.WEEKLY_TRAINING_HOURS_2:
        case XP_ACTIONS.MONTHLY_TRAINING_HOURS_5:
        case XP_ACTIONS.MONTHLY_TRAINING_HOURS_10:
        case XP_ACTIONS.DAILY_TRAINING_30MIN:
            return XP_CATEGORIES.ENGAGEMENT;
        case XP_ACTIONS.COMPLETE_PROFILE:
            return XP_CATEGORIES.PROFILE;
        case XP_ACTIONS.VIEW_COURSE_MATERIAL:
            return XP_CATEGORIES.MATERIALS;
        case XP_ACTIONS.CREATE_COURSE:
        case XP_ACTIONS.CREATE_TEST:
        case XP_ACTIONS.ADD_COURSE_MATERIAL:
            return XP_CATEGORIES.AUTHORING;
        default:
            return XP_CATEGORIES.OTHER;
    }
}

/** Maps metadata.sourceType to breakdown category when action mapping is insufficient. */
export function mapSourceTypeToCategory(sourceType?: string): XpCategory {
    switch (sourceType as XpSourceType) {
        case XP_SOURCE_TYPES.TEST_RESULT:
        case XP_SOURCE_TYPES.TEST_ATTEMPT:
        case XP_SOURCE_TYPES.TRAINING_PROGRESS:
            return XP_CATEGORIES.LEARNING;
        case XP_SOURCE_TYPES.COURSE:
            return XP_CATEGORIES.COURSES;
        case XP_SOURCE_TYPES.AUTH:
        case XP_SOURCE_TYPES.STREAK:
            return XP_CATEGORIES.ENGAGEMENT;
        case XP_SOURCE_TYPES.USER:
            return XP_CATEGORIES.PROFILE;
        case XP_SOURCE_TYPES.COURSE_MATERIAL:
            return XP_CATEGORIES.MATERIALS;
        case XP_SOURCE_TYPES.ADMIN:
            return XP_CATEGORIES.OTHER;
        default:
            return XP_CATEGORIES.OTHER;
    }
}

/** Resolves the breakdown category for an award using action first, then sourceType. */
export function resolveXpCategory(
    action: string,
    sourceType?: string,
): XpCategory {
    const actionCategory = mapActionToCategory(action);
    if (actionCategory !== XP_CATEGORIES.OTHER) {
        return actionCategory;
    }
    return mapSourceTypeToCategory(sourceType);
}

/** Adds XP to a breakdown copy and returns the updated object. */
export function addXpToBreakdown(
    breakdown: XpBreakdown,
    category: XpCategory,
    amount: number,
): XpBreakdown {
    return {
        ...breakdown,
        [category]: breakdown[category] + amount,
    };
}

/** Returns current UTC month string in YYYY-MM format for challenge tracking. */
export function getCurrentChallengeMonthUtc(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}
