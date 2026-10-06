/** Manuals a learner can download outside a course. */
export const TRAINING_MANUALS = {
    'bitdrywall-technical-book': 'BIT Drywall Technical Book',
} as const;

export type TrainingManualKey = keyof typeof TRAINING_MANUALS;

/** Returns the display title for a known manual key. */
export function trainingManualTitle(manualKey: string): string | null {
    if (manualKey in TRAINING_MANUALS) {
        return TRAINING_MANUALS[manualKey as TrainingManualKey];
    }
    return null;
}
