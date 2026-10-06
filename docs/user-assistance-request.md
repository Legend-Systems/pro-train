# Request Assistance

**Status:** Phases 1–3 and 4.3 are implemented. Sections 4.1 and 4.2 are Wati dashboard steps. Phase 5 is not started. After email is accepted, the API calls Wati when `WATI_API_ENDPOINT` and `WATI_ACCESS_TOKEN` are set. Empty Wati config stores `whatsappStatus = skipped` and does not call Wati.

Learners with role `user` can ask for help from inside a course or an active test. One action notifies the address in `ASSISTANCE_EMAIL_NOTIFY` and, when Wati is configured, sends a WhatsApp template to the support number.

Admins, owners, and master admins do not see the control. The server rejects their requests.

## Scope

| Surface | Location |
| --- | --- |
| Web course | `protrain-client/app/course/[courseId]/page.tsx` |
| Web test | `protrain-client/app/test/[testID]/page.tsx` |
| Mobile course | `protrain-mobile/src/app/course/[courseId].tsx` |
| Mobile test | `protrain-mobile/src/app/test/[testId].tsx` |
| API | New Nest module under `pro-train/src/assistance/` |

Email uses the existing communications pipeline (Nodemailer, `communications` table, `EmailType`). WhatsApp is an outbound call from `WatiAssistanceClient` after the email is accepted. Web and mobile do not call Wati.

## Payload

The client sends context. The server fills identity from the JWT user and never trusts client-supplied name, email, org, or role.

```json
{
  "source": "web",
  "contextType": "course",
  "courseId": 12,
  "courseTitle": "Food safety",
  "materialId": 44,
  "materialTitle": "Module 2 — Allergens",
  "testId": null,
  "testTitle": null,
  "message": "I cannot open the PDF."
}
```

`contextType` is `course` or `test`. `source` is `web` or `mobile`. `message` is optional, plain text, max 500 characters.

The notification body (email and WhatsApp) includes:

- User id, first name, last name, email
- Organization id and name, branch id and name when present
- Course and, when relevant, material or test ids and titles
- Optional learner message
- `requestedAt` in UTC
- Client source

## Phase 1 — Learner UI

Status: **complete**

1. [x] Add a `RequestAssistanceButton` used only when `role === user`.
2. [x] On web, place it as a fixed control at the bottom-right of the course page and the test page. Keep it above page content and clear of primary actions (start exam, submit). Label: **Need help**. `accessibilityLabel`: "Request assistance".
3. [x] On mobile, place the same action at the bottom of the course screen and the test screen, inside the safe area. Use a Tabler outline icon (`IconLifebuoy`), size 20, and a touch target of at least 44×44. Style with NativeWind tokens (`bg-primary`, no shadow).
4. [x] One press opens a short confirm sheet, not a long form. Show the course or test title so the learner sees what will be sent. Optional message field. Actions: **Send request** and **Cancel**.
5. [x] On send, call the assistance API with the payload above. Disable the button while the request is in flight.
6. [x] Success: toast or inline confirmation — "Help request sent. Support has been notified." Do not claim WhatsApp was delivered.
7. [x] Failure: show a short error and leave the sheet open so they can retry. Do not expose status codes or provider errors.
8. [x] Web copy goes through the existing i18n keys. Mobile course and test screens are not translated, so those strings stay in English with the rest of those screens.
9. [x] Do not put the button on the marketing site, the home dashboard, or admin reports.

## Phase 2 — API

Status: **complete**

1. [x] Create `src/assistance/` with controller, service, DTO, entity, and module. Register the module in `AppModule`.
2. [x] Endpoint: `POST /assistance/requests`.
3. [x] Guards: `JwtAuthGuard`. Allow only `UserRole.USER`. Return 403 for every other role.
4. [x] Validate the body with `class-validator`. Require `source` and `contextType`. Require `courseId` for `course`, and `testId` for `test`. Cap `message` at 500 characters.
5. [x] Load the caller with org and branch. Reject the request if the course or test is outside that caller's organization.
6. [x] Rate-limit the route with `@Throttle`: 3 requests per 15 minutes per user. Return 429 with a clear message.
7. [x] Persist an `assistance_requests` row before sending notifications:
   - `id` (uuid)
   - `userId`, `orgId`, `branchId` (nullable)
   - `source`, `contextType`, `courseId`, `materialId`, `testId`
   - `message` (nullable)
   - `emailStatus` (`pending` | `sent` | `failed`)
   - `whatsappStatus` (`pending` | `sent` | `failed` | `skipped`)
   - `requestedAt`, `createdAt`
   - `communicationId` (set after the email is queued)
8. [x] Add a TypeORM migration. Do not rely on `synchronize`. Applied: `1741700000000-CreateAssistanceRequests`.
9. [x] Response shape is `StandardResponse`:

```json
{
  "success": true,
  "message": "Assistance request sent",
  "data": { "requestId": "uuid" }
}
```

10. [x] Return success only after the email send is accepted. A WhatsApp failure does not fail the HTTP request (see Phase 3). Until Phase 4, WhatsApp is skipped after a successful email.
11. [x] Log `requestId`, `userId`, `orgId`, and both delivery statuses. Do not log the JWT or email credentials.

## Phase 3 — Email notification

Status: **complete**

1. [x] Read `ASSISTANCE_EMAIL_NOTIFY` through `ConfigService`. If it is missing or not a valid address, fail the request with 503 and mark `emailStatus = failed`. Do not silently drop it.
2. [x] Add `EmailType.ASSISTANCE_REQUEST = 'assistance_request'` and a migration that extends the `communications.emailType` enum, following `1740600000000-CreateTestExamNotificationTables`.
3. [x] Send through `CommunicationsService` so the message is stored on `communications` and uses the existing SMTP settings (`SMTP_HOST`, `EMAIL_FROM_ADDRESS`).
4. [x] Subject: `Assistance requested — {firstName} {lastName}`.
5. [x] Body: the payload fields listed above, plus a link to the course or test in the web app if a public base URL is already configured (`CLIENT_URL`).
6. [x] Store the communication id on `assistance_requests`.
7. [x] On SMTP failure, mark `emailStatus = failed`, skip WhatsApp, and return an error to the learner.

`ASSISTANCE_EMAIL_NOTIFY` is already set in `.env`. Add the same key to `.env-example` with an empty value. Do not commit a real inbox address.

## Phase 4 — WhatsApp via Wati

Wati can only send a business-initiated WhatsApp message with a **Meta-approved template**. A free-text session message works only inside a 24-hour window after the recipient messages the business number, so it is the wrong tool for this alert.

Email remains the source of truth. If WhatsApp fails, the learner still gets a success response as long as email was accepted. Mark `whatsappStatus = failed` and log the Wati error body with the access token redacted.

### 4.1 Wati account

1. Create or open the Wati workspace at [wati.io](https://www.wati.io).
2. Connect a WhatsApp Business number in **Dashboard → WhatsApp Number**. Use a number the support team controls. Complete Meta business verification if Wati prompts for it.
3. Open **API Docs** in the Wati dashboard and copy:
   - API endpoint (tenant-specific), for example `https://live-server-12345.wati.io`
   - Bearer access token
4. Add these server-only variables. Never expose them as `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*`.

| Variable | Purpose |
| --- | --- |
| `WATI_API_ENDPOINT` | Tenant base URL from the Wati API docs page, no trailing slash |
| `WATI_ACCESS_TOKEN` | Bearer token from that same page |
| `WATI_ASSISTANCE_TEMPLATE` | Approved template name, e.g. `protrain_assistance_request` |
| `ASSISTANCE_WHATSAPP_NUMBER` | Support WhatsApp number, digits only, country code included, no `+` (example `27821234567`) |

5. Document the four keys in `.env-example` with empty values.
6. If `WATI_API_ENDPOINT` or `WATI_ACCESS_TOKEN` is empty, set `whatsappStatus = skipped` and do not call Wati. Email still sends.

### 4.2 Message template

1. In Wati go to **Broadcasts → Message templates → New template** (wording can vary; it is the template builder, not a session reply).
2. Create a utility template:
   - Name: `protrain_assistance_request` (lowercase, underscores; this string is what the API sends)
   - Category: **Utility**
   - Language: `en`
3. Body (variable order is the API contract):

```text
ProTrain assistance request
{{1}} needs help.
Course: {{2}}
Context: {{3}}
When: {{4}}
Message: {{5}}
```

| Variable | Value sent by the API |
| --- | --- |
| `{{1}}` | `{firstName} {lastName}` plus email |
| `{{2}}` | Course title, or `Unknown course` |
| `{{3}}` | `Test: {title}` or `Material: {title}` or `Course` |
| `{{4}}` | UTC timestamp |
| `{{5}}` | Learner message, or `No message` |

4. Submit the template and wait until Wati shows **Approved**. Meta rejects templates that look like marketing or that omit a real utility purpose. Do not call the API before approval.
5. Add the support number `ASSISTANCE_WHATSAPP_NUMBER` as a contact in Wati if the dashboard requires a known contact before the first send. Send one manual test from the Wati template UI to that number and confirm it arrives on WhatsApp.

### 4.3 Application call

**Status:** Complete.

- [x] After the email is accepted, `AssistanceService` calls `WatiAssistanceClient` (Axios, timeout 10 seconds). Web and mobile do not call Wati.
- [x] Empty `WATI_API_ENDPOINT`, `WATI_ACCESS_TOKEN`, or `ASSISTANCE_WHATSAPP_NUMBER` sets `whatsappStatus = skipped` and makes no HTTP call.
- [x] HTTP 200 with `result: true` sets `whatsappStatus = sent`. 400 and 401 set `failed` and log Wati `info` with the bearer token redacted.
- [x] Timeout or 5xx retries once after 2 seconds, then sets `failed`.
- [x] A WhatsApp failure does not change the learner success response when the email was accepted.

```http
POST {WATI_API_ENDPOINT}/api/v1/sendTemplateMessage?whatsappNumber={ASSISTANCE_WHATSAPP_NUMBER}
Authorization: Bearer {WATI_ACCESS_TOKEN}
Content-Type: application/json
```

```json
{
  "template_name": "protrain_assistance_request",
  "broadcast_name": "protrain_assistance_request",
  "parameters": [
    { "name": "1", "value": "Jane Doe (jane@example.com)" },
    { "name": "2", "value": "Food safety" },
    { "name": "3", "value": "Material: Module 2 — Allergens" },
    { "name": "4", "value": "2026-10-05T07:26:00.000Z" },
    { "name": "5", "value": "I cannot open the PDF." }
  ]
}
```

`template_name` must match the approved template exactly. Parameter `name` values must match the template variable positions (`1` … `5`). If a Wati account uses named parameters instead of numeric ones, change only the `name` fields to match the approved template — do not change the endpoint.

Treat HTTP 200 with `result: true` as sent. Anything else is failed:

| Response | Action |
| --- | --- |
| 401 | Token missing or revoked. Log and set `whatsappStatus = failed`. |
| 400 | Template name, language, or parameters do not match. Log Wati `info`. |
| Timeout or 5xx | One retry after 2 seconds, then mark failed. |
| Empty Wati config | `whatsappStatus = skipped`. No HTTP call. |

Do not add a Wati webhook in the first release. Delivery status on the audit row is enough. A later webhook (`message` status callbacks in the Wati dashboard, pointed at `POST /assistance/wati/webhook`) can update `whatsappStatus` to delivered or read.

## Phase 5 — Testing and rollout

1. Unit-test the service: user role allowed; admin role rejected; missing email config returns 503; invalid course for the caller's org is rejected; message over 500 characters is rejected.
2. With Wati unset, send one request from a `user` account on the web course page. Confirm the `assistance_requests` row, a `communications` row to `ASSISTANCE_EMAIL_NOTIFY`, `whatsappStatus = skipped`, and the success toast.
3. Repeat from the web test page and from the mobile course and test screens. Confirm the audit row stores the correct `contextType` and ids.
4. Confirm an admin session does not render the button and that a forged request returns 403.
5. Send 4 requests inside 15 minutes and confirm the fourth returns 429.
6. After the Wati template is approved, set the four Wati variables on the server only and send one request. Confirm the WhatsApp message on `ASSISTANCE_WHATSAPP_NUMBER` and `whatsappStatus = sent`.
7. Break the Wati token on purpose. Confirm the email still sends, the API still returns success, and `whatsappStatus = failed`.
8. Deploy the API first (migration, then process). Deploy web and mobile after `POST /assistance/requests` is live. A client deploy before the route exists will show a failed request.
9. Roll out with Wati variables empty if template approval is still pending. Turn WhatsApp on by setting the env vars and restarting the API. No further client release is required for that switch.
