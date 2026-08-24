/**
 * Report content selection primitives shared by schedules, on-demand
 * generation, and PDF/CSV/email rendering.
 */

/** High-level starting point chosen when creating or editing a report. */
export enum ReportPreset {
    /**
     * Motivation-first rankings. Sections that single out weak individual
     * performance are always stripped, even if explicitly requested.
     */
    LEADERBOARD = 'leaderboard',
    /** Full analytics: leaderboard content plus diagnostic admin sections. */
    ADMIN = 'admin',
    /** Caller supplies the exact section list. */
    CUSTOM = 'custom',
}

/**
 * Individually toggleable report sections and headline metrics.
 * `kpi-*` entries control single tiles inside the KPI block; the remaining
 * entries control whole sections.
 */
export enum ReportSection {
    KPI_AVERAGE_KNOWLEDGE_SCORE = 'kpi-average-knowledge-score',
    KPI_OVERALL_PASS_RATE = 'kpi-overall-pass-rate',
    KPI_TOTAL_RESULTS = 'kpi-total-results',
    KPI_ACTIVE_LEARNERS = 'kpi-active-learners',
    KPI_TRAINING_HOURS = 'kpi-training-hours',
    KPI_AT_RISK_USERS = 'kpi-at-risk-users',
    KPI_HIGH_POTENTIAL_USERS = 'kpi-high-potential-users',
    KPI_KEY_AREAS = 'kpi-key-areas',

    ADMIN_OVERVIEW = 'admin-overview',
    LEADERBOARD_RANKINGS = 'leaderboard-rankings',
    BRANCH_TOP_PERFORMERS = 'branch-top-performers',
    TOP_SCORERS = 'top-scorers',
    TEST_COMPLETION = 'test-completion',
    TOP_PERFORMERS = 'top-performers',
    HIGH_POTENTIAL_USERS = 'high-potential-users',
    BRANCH_COMPARISON = 'branch-comparison',
    TRAINING_HOURS = 'training-hours',
    MOST_PASSED_TESTS = 'most-passed-tests',
    EFFECTIVENESS_TRENDS = 'effectiveness-trends',

    NEEDS_SUPPORT = 'needs-support',
    AT_RISK_USERS = 'at-risk-users',
    KEY_AREAS = 'key-areas',
    MOST_FAILED_TESTS = 'most-failed-tests',
    PASS_FAIL_RATES = 'pass-fail-rates',
    /**
     * Learners who still need to finish tests in the selected month:
     * never started, or started and left `in_progress` / `expired`.
     */
    TESTS_NOT_COMPLETED = 'tests-not-completed',
}

/** Every selectable section, in presentation order. */
export const ALL_REPORT_SECTIONS: readonly ReportSection[] =
    Object.values(ReportSection);

/**
 * Sections that expose individual or organizational weakness.
 * Leaderboard reports must never contain these — the leaderboard is meant to
 * motivate, not to publicly rank people by their shortcomings.
 */
export const SENSITIVE_REPORT_SECTIONS: readonly ReportSection[] = [
    ReportSection.NEEDS_SUPPORT,
    ReportSection.AT_RISK_USERS,
    ReportSection.KEY_AREAS,
    ReportSection.MOST_FAILED_TESTS,
    ReportSection.PASS_FAIL_RATES,
    ReportSection.KPI_AT_RISK_USERS,
    ReportSection.KPI_KEY_AREAS,
    ReportSection.TESTS_NOT_COMPLETED,
];

/** Default content for the leaderboard preset (celebratory sections only). */
export const LEADERBOARD_PRESET_SECTIONS: readonly ReportSection[] = [
    ReportSection.KPI_AVERAGE_KNOWLEDGE_SCORE,
    ReportSection.KPI_OVERALL_PASS_RATE,
    ReportSection.KPI_ACTIVE_LEARNERS,
    ReportSection.KPI_TRAINING_HOURS,
    ReportSection.KPI_TOTAL_RESULTS,
    ReportSection.ADMIN_OVERVIEW,
    ReportSection.LEADERBOARD_RANKINGS,
    ReportSection.BRANCH_TOP_PERFORMERS,
    ReportSection.TOP_SCORERS,
    ReportSection.TEST_COMPLETION,
    ReportSection.TOP_PERFORMERS,
    ReportSection.HIGH_POTENTIAL_USERS,
    ReportSection.BRANCH_COMPARISON,
];

/** Default content for the admin preset (everything). */
export const ADMIN_PRESET_SECTIONS: readonly ReportSection[] =
    ALL_REPORT_SECTIONS;

/** Fallback used when a legacy schedule has no stored selection. */
export const DEFAULT_REPORT_SECTIONS: readonly ReportSection[] =
    ADMIN_PRESET_SECTIONS;

/** Maps legacy `reportTypes` keys onto the new section model. */
const LEGACY_REPORT_TYPE_SECTIONS: Record<string, ReportSection[]> = {
    overview: [ReportSection.ADMIN_OVERVIEW],
    performers: [ReportSection.TOP_PERFORMERS, ReportSection.NEEDS_SUPPORT],
    'training-hours': [ReportSection.TRAINING_HOURS],
    'pass-fail': [
        ReportSection.MOST_PASSED_TESTS,
        ReportSection.MOST_FAILED_TESTS,
        ReportSection.PASS_FAIL_RATES,
    ],
    'key-areas': [ReportSection.KEY_AREAS],
    leaderboard: [
        ReportSection.LEADERBOARD_RANKINGS,
        ReportSection.BRANCH_TOP_PERFORMERS,
        ReportSection.TOP_SCORERS,
    ],
};

/** Narrows arbitrary strings to known section keys. */
export function isReportSection(value: string): value is ReportSection {
    return (ALL_REPORT_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolves the definitive section list for a report.
 *
 * Precedence: explicit `sections` → legacy `reportTypes` → preset defaults.
 * The leaderboard preset always has sensitive sections removed last, so a
 * stale or hand-crafted payload can never reintroduce them.
 */
export function resolveReportSections(params: {
    preset?: ReportPreset | null;
    sections?: string[] | null;
    legacyReportTypes?: string[] | null;
}): ReportSection[] {
    const preset = params.preset ?? ReportPreset.ADMIN;

    let resolved: ReportSection[];

    if (params.sections?.length) {
        resolved = params.sections.filter(isReportSection);
    } else if (preset === ReportPreset.CUSTOM && params.legacyReportTypes?.length) {
        resolved = params.legacyReportTypes.flatMap(
            type => LEGACY_REPORT_TYPE_SECTIONS[type] ?? [],
        );
    } else if (preset === ReportPreset.LEADERBOARD) {
        resolved = [...LEADERBOARD_PRESET_SECTIONS];
    } else {
        resolved = [...ADMIN_PRESET_SECTIONS];
    }

    if (resolved.length === 0) {
        resolved = [...DEFAULT_REPORT_SECTIONS];
    }

    if (preset === ReportPreset.LEADERBOARD) {
        resolved = resolved.filter(
            section => !SENSITIVE_REPORT_SECTIONS.includes(section),
        );
    }

    return ALL_REPORT_SECTIONS.filter(section => resolved.includes(section));
}

/**
 * True when the selection reads as a motivational leaderboard rather than a
 * diagnostic admin report: rankings are present and nothing that highlights
 * weakness is. Person rows then drop score/pass percentages in favour of rank
 * and tests completed, so nobody is singled out by a low number.
 */
export function isMotivationalSelection(
    sections: readonly ReportSection[],
): boolean {
    return (
        sections.includes(ReportSection.LEADERBOARD_RANKINGS) &&
        !sections.some(section => SENSITIVE_REPORT_SECTIONS.includes(section))
    );
}

/** True when any leaderboard-specific dataset is required. */
export function requiresLeaderboardInsights(
    sections: readonly ReportSection[],
): boolean {
    return (
        sections.includes(ReportSection.LEADERBOARD_RANKINGS) ||
        sections.includes(ReportSection.BRANCH_TOP_PERFORMERS) ||
        sections.includes(ReportSection.TOP_SCORERS) ||
        sections.includes(ReportSection.TEST_COMPLETION)
    );
}

/** True when the tests-not-completed month roster must be loaded. */
export function requiresTestsNotCompleted(
    sections: readonly ReportSection[],
): boolean {
    return sections.includes(ReportSection.TESTS_NOT_COMPLETED);
}
