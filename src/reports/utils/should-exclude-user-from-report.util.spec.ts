import {
    REPORT_ALWAYS_EXCLUDED_EMAILS,
    REPORT_CROSS_ORG_EMAILS,
    REPORT_EXCLUDED_ROLES,
    REPORT_LEARNER_ROLES,
    REPORT_LISTED_EMAILS,
} from '../constants/report-user-exclusions.constant';
import { shouldExcludeUserFromReport } from './should-exclude-user-from-report.util';

describe('shouldExcludeUserFromReport', () => {
    const ownOrg = 'org-own';
    const otherOrg = 'org-other';

    it('keeps the markdown groups disjoint and complete', () => {
        const always = new Set(REPORT_ALWAYS_EXCLUDED_EMAILS);
        const crossOrg = new Set(REPORT_CROSS_ORG_EMAILS);

        expect(REPORT_ALWAYS_EXCLUDED_EMAILS).toHaveLength(31);
        expect(REPORT_CROSS_ORG_EMAILS).toHaveLength(12);
        expect(REPORT_LISTED_EMAILS).toHaveLength(43);
        REPORT_CROSS_ORG_EMAILS.forEach(email => {
            expect(always.has(email)).toBe(false);
        });
        REPORT_ALWAYS_EXCLUDED_EMAILS.forEach(email => {
            expect(crossOrg.has(email)).toBe(false);
        });
        expect([...REPORT_EXCLUDED_ROLES]).toEqual([
            'admin',
            'owner',
            'master_admin',
            'senior_managers',
        ]);
        expect([...REPORT_LEARNER_ROLES]).toEqual([
            'user',
            'administrative_staff',
            'warehouse_staff',
            'drivers',
        ]);
        expect(REPORT_LEARNER_ROLES).not.toContain('senior_managers');
    });

    it('excludes elevated roles even inside their own organization', () => {
        expect(
            shouldExcludeUserFromReport({
                email: 'learner@example.com',
                role: 'senior_managers',
                userOrgId: ownOrg,
                reportOrgId: ownOrg,
            }),
        ).toBe(true);
        expect(
            shouldExcludeUserFromReport({
                email: 'lucky@legendsystems.co.za',
                role: 'admin',
                userOrgId: ownOrg,
                reportOrgId: ownOrg,
            }),
        ).toBe(true);
    });

    it('excludes listed accounts from every organization', () => {
        expect(
            shouldExcludeUserFromReport({
                email: 'LegendDev@bitgroup.co.za',
                role: 'user',
                userOrgId: ownOrg,
                reportOrgId: ownOrg,
            }),
        ).toBe(true);
    });

    it('keeps cross-organization accounts only in their own organization', () => {
        expect(
            shouldExcludeUserFromReport({
                email: 'Lucky@legendsystems.co.za',
                role: 'user',
                userOrgId: ownOrg,
                reportOrgId: ownOrg,
            }),
        ).toBe(false);
        expect(
            shouldExcludeUserFromReport({
                email: 'lucky@legendsystems.co.za',
                role: 'warehouse_staff',
                userOrgId: ownOrg,
                reportOrgId: otherOrg,
            }),
        ).toBe(true);
        expect(
            shouldExcludeUserFromReport({
                email: 'yanga@legendsystems.co.za',
                role: 'user',
                userOrgId: null,
                reportOrgId: ownOrg,
            }),
        ).toBe(true);
    });

    it('leaves ordinary learners in the report', () => {
        expect(
            shouldExcludeUserFromReport({
                email: 'learner@example.com',
                role: 'drivers',
                userOrgId: ownOrg,
                reportOrgId: ownOrg,
            }),
        ).toBe(false);
    });
});
