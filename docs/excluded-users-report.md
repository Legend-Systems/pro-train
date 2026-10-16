# Users Excluded in Reports

Source of truth for report audience filtering. Implemented by
`src/reports/constants/report-user-exclusions.constant.ts` and applied through
`ReportAudienceService` on every report metric.

## Rules

1. **Always excluded** — every address in the main list below that is **not**
   listed under “different organization” is removed from **all** reports and
   all metrics (rankings, breakdowns, top-3, KPIs, scheduled exports, etc.).
2. **Elevated roles** — users with role `admin`, `owner`, `master_admin`, or
   `senior_managers` never appear in any report, including inside their own
   organization.
3. **Cross-organization** — addresses under “different organization” appear
   only when the report is generated for **their** organization. They are
   removed from every other organization’s reports.
4. **Missing rows** — addresses with no matching `users` row are skipped.
   Nothing is inserted.

Emails are matched case-insensitively.

---

LegendDev@bitgroup.co.za
linkedin@legendsystems.co.za
lsf@bitgroup.co.za
Lucky@legendsystems.co.za
mack@bitgroup.co.za
debtors@bitgroup.co.za
marg@gmail.com
markus@legendsystems.co.za
michaelpatel@bitgroup.co.za
milton@legendsystems.co.za
morne@legendsystems.co.za
nisaar.isaacs@bitgroup.co.za
no-reply@legendsystems.co.za
no-reply-performance-tracker@legendsystems
nonreply@legendsystems.co.za
pamela.medeiros@bitgroup.co.za
penny.patel@bitgroup.co.za
philip.dias@bitgroup.co.za
philip@legendsystems.co.za
printer@bitgroup.co.za
quarantine@bitgroup.co.za
raksha.misthry@bitgroup.co.za
Recruitment2@bitgroup.co.za
accounts2@bitgroup.co.za
richard.jacobs@bitgroup.co.za
roberto.barradas@bitgroup.co.za
rowan.ambrose@bitgroup.co.za
ruben.tavares@bitgroup.co.za
sales20@bitgroup.co.za
sales7@bitgroup.co.za
shanil.sriram@bitgroup.co.za
siviwe.madikane@bitgroup.co.za
Socials@bitgroup.co.za
soweto@bitgroup.co.za
stefan@legendsystems.co.za
tjaart.pretorius@bitgroup.co.za
training1@bitgroup.co.za
training2@bitgroup.co.za
tzaneen2@bitgroup.co.za
vitor.medeiros@bitgroup
yanga@legendsystems.co.za
yangagovuza@gmail.com
whires44@gmail.com


## Users below belong to a different organization

Lucky@legendsystems.co.za
markus@legendsystems.co.za
michaelpatel@bitgroup.co.za
milton@legendsystems.co.za
morne@legendsystems.co.za



## Users below belong to a different organization but are not currently stored within the database

linkedin@legendsystems.co.za
no-reply@legendsystems.co.za
no-reply-performance-tracker@legendsystems
nonreply@legendsystems.co.za
philip@legendsystems.co.za
stefan@legendsystems.co.za
yanga@legendsystems.co.za
