import {
    REPORT_ALWAYS_EXCLUDED_EMAILS,
    REPORT_CROSS_ORG_EMAILS,
    REPORT_EXCLUDED_ROLES,
} from '../constants/report-user-exclusions.constant';

const ALWAYS_EXCLUDED_EMAILS = new Set(REPORT_ALWAYS_EXCLUDED_EMAILS);
const CROSS_ORG_EMAILS = new Set(REPORT_CROSS_ORG_EMAILS);
const EXCLUDED_ROLES = new Set<string>(REPORT_EXCLUDED_ROLES);

/** Identity fields needed to decide whether a user belongs in a report. */
export interface ReportUserExclusionInput {
    readonly email?: string | null;
    readonly role?: string | null;
    /** Organization the user belongs to. */
    readonly userOrgId?: string | null;
    /**
     * Organization the report is generated for.
     * Null means the report is not scoped to one organization.
     */
    readonly reportOrgId?: string | null;
}

/** Lowercase trimmed email, or null when the address is blank. */
export function normalizeReportEmail(
    email?: string | null,
): string | null {
    const normalized = email?.trim().toLowerCase();
    return normalized ? normalized : null;
}

/**
 * True when this user must be left out of the report.
 * Elevated roles are always excluded. Cross-organization addresses are
 * excluded unless the report organization is their own.
 */
export function shouldExcludeUserFromReport(
    input: ReportUserExclusionInput,
): boolean {
    if (input.role && EXCLUDED_ROLES.has(input.role)) {
        return true;
    }

    const email = normalizeReportEmail(input.email);
    if (!email) {
        return false;
    }

    if (ALWAYS_EXCLUDED_EMAILS.has(email)) {
        return true;
    }

    if (!CROSS_ORG_EMAILS.has(email)) {
        return false;
    }

    if (!input.reportOrgId || !input.userOrgId) {
        return true;
    }

    return input.userOrgId !== input.reportOrgId;
}
