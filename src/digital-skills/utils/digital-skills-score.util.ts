import {
    DIGITAL_SKILLS_WEAK_LEVELS,
    type DigitalSkillsClassification,
} from '../constants/digital-skills.constant';

/**
 * Points awarded for one self-rating.
 *
 * Level 1 → 0, level 6 → questionPoints. Five equal steps.
 */
export function awardDigitalSkillsPoints(
    level: number,
    questionPoints: number,
): number {
    if (level < 1 || level > 6 || questionPoints <= 0) {
        return 0;
    }

    return ((level - 1) / 5) * questionPoints;
}

/**
 * Unrounded Digital Skills Score 0–100 from the 1–6 ratings.
 *
 * `((Σ Lᵢ − N) / (5 × N)) × 100`
 */
export function calculateDigitalSkillsScoreRaw(levels: readonly number[]): number {
    if (levels.length === 0) {
        return 0;
    }

    const total = levels.reduce((sum, level) => sum + level, 0);
    return ((total - levels.length) / (5 * levels.length)) * 100;
}

/**
 * Digital Skills Score 0–100, rounded to one decimal for storage and display.
 */
export function calculateDigitalSkillsScore(levels: readonly number[]): number {
    return Math.round(calculateDigitalSkillsScoreRaw(levels) * 10) / 10;
}

/** Classification bands from `new-feature.md` (inclusive). */
export function classifyDigitalSkillsScore(
    score: number,
): DigitalSkillsClassification {
    if (score <= 25) {
        return 'Urgent Training';
    }
    if (score <= 45) {
        return 'Beginner';
    }
    if (score <= 60) {
        return 'Basic';
    }
    if (score <= 75) {
        return 'Competent';
    }
    if (score <= 90) {
        return 'Strong';
    }
    return 'Advanced';
}

/** True when the skill should be assigned as a training gap. */
export function isWeakDigitalSkillLevel(level: number): boolean {
    return DIGITAL_SKILLS_WEAK_LEVELS.includes(level);
}
