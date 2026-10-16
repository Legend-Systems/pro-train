/**
 * Users and roles that must not appear in report metrics.
 *
 * Mirrors `docs/excluded-users-report.md`.
 * Emails are stored lowercase. Comparison is case-insensitive.
 *
 * - Always excluded: listed accounts that must not appear in any organization.
 * - Cross-organization: listed accounts that appear only when the report
 *   organization is their own. Missing database rows are simply absent.
 * - Elevated roles: never appear, including inside their own organization.
 *
 * Role strings match `UserRole` in `user.entity.ts` without importing that
 * module (avoids pulling entity graphs into lightweight report helpers).
 */

/** Roles that never appear in any report. */
export const REPORT_EXCLUDED_ROLES = [
    'admin',
    'owner',
    'master_admin',
    'senior_managers',
] as const;

/**
 * Learner roles that may appear in reports.
 * Training job roles minus elevated roles — `senior_managers` trains as a
 * learner but must not appear in reports.
 */
export const REPORT_LEARNER_ROLES = [
    'user',
    'administrative_staff',
    'warehouse_staff',
    'drivers',
] as const;

/**
 * Listed accounts excluded from every report.
 * The cross-organization section of the markdown is not in this set.
 */
export const REPORT_ALWAYS_EXCLUDED_EMAILS: readonly string[] = [
    'legenddev@bitgroup.co.za',
    'lsf@bitgroup.co.za',
    'mack@bitgroup.co.za',
    'debtors@bitgroup.co.za',
    'marg@gmail.com',
    'nisaar.isaacs@bitgroup.co.za',
    'pamela.medeiros@bitgroup.co.za',
    'penny.patel@bitgroup.co.za',
    'philip.dias@bitgroup.co.za',
    'printer@bitgroup.co.za',
    'quarantine@bitgroup.co.za',
    'raksha.misthry@bitgroup.co.za',
    'recruitment2@bitgroup.co.za',
    'accounts2@bitgroup.co.za',
    'richard.jacobs@bitgroup.co.za',
    'roberto.barradas@bitgroup.co.za',
    'rowan.ambrose@bitgroup.co.za',
    'ruben.tavares@bitgroup.co.za',
    'sales20@bitgroup.co.za',
    'sales7@bitgroup.co.za',
    'shanil.sriram@bitgroup.co.za',
    'siviwe.madikane@bitgroup.co.za',
    'socials@bitgroup.co.za',
    'soweto@bitgroup.co.za',
    'tjaart.pretorius@bitgroup.co.za',
    'training1@bitgroup.co.za',
    'training2@bitgroup.co.za',
    'tzaneen2@bitgroup.co.za',
    'vitor.medeiros@bitgroup',
    'yangagovuza@gmail.com',
    'whires44@gmail.com',
];

/**
 * Listed accounts that belong to another organization.
 * They stay in reports for their own organization and are removed everywhere else.
 * Includes addresses that are not stored yet; those match nothing until a row exists.
 */
export const REPORT_CROSS_ORG_EMAILS: readonly string[] = [
    'lucky@legendsystems.co.za',
    'markus@legendsystems.co.za',
    'michaelpatel@bitgroup.co.za',
    'milton@legendsystems.co.za',
    'morne@legendsystems.co.za',
    'linkedin@legendsystems.co.za',
    'no-reply@legendsystems.co.za',
    'no-reply-performance-tracker@legendsystems',
    'nonreply@legendsystems.co.za',
    'philip@legendsystems.co.za',
    'stefan@legendsystems.co.za',
    'yanga@legendsystems.co.za',
];

/** Every address from the markdown, used to load candidate rows. */
export const REPORT_LISTED_EMAILS: readonly string[] = [
    ...REPORT_ALWAYS_EXCLUDED_EMAILS,
    ...REPORT_CROSS_ORG_EMAILS,
];
