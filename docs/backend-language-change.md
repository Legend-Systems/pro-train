# Backend Language Change — Implementation Status

European Portuguese (`pt-PT`) and English (`en`) localization for the ProTrain NestJS API (`pro-train`).

This document tracks backend phases, seed data, manual QA, and follow-up work across repos.

**Last updated:** 2026-08-07

---

## Summary

| Area | Status |
|------|--------|
| Phase 1 — User preference & org config | **Complete** |
| Phase 2 — Locale resolution infrastructure | **Complete** |
| Phase 3 — Locale-aware content APIs | **Complete** |
| Phase 4 — Attempt locale tracking | **Complete** |
| Phase 5 — Seed pt-PT translations & org config | **Complete** |
| Migrations applied (`yarn typeorm:migration:run`) | **Complete** (no pending migrations) |
| Seed data verified in database | **Complete** (counts match expected) |
| Backend manual QA (API checklist) | **Partial** — see [Testing checklist](#testing-checklist) |
| Web client preference sync | **Complete** — see [Web client integration](#web-client-integration-protrain-client) |
| Admin translation authoring | **Not started** |
| Mobile client i18n | **Not started** |

**Locale codes:** `en`, `pt-PT` (bare `pt` normalizes to `pt-PT`).

---

## Overview

| Layer | Purpose | Status |
|-------|---------|--------|
| **User preference** | Persist `users.preferredLanguage` and expose via profile + auth | Done |
| **Locale resolution** | Resolve `?locale=`, `Accept-Language`, user preference, org default | Done |
| **Content translations** | Sidecar tables merge over English base columns | Done |
| **Attempt locale** | Store language on `test_attempts` at start time | Done |
| **Seed data** | Full `pt-PT` rows for all courses, tests, questions, and options | Done |

---

## Phase 1 — User preference & org config

**Goal:** API stores and returns language choice; org config allows `pt-PT`.

| Task | Status |
|------|--------|
| Map `preferredLanguage` on `User` entity | [x] |
| Add `preferredLanguage` to `UpdateUserDto` with validation | [x] |
| Validate against org `supportedLanguages` + `allowUserLanguageChange` | [x] |
| Return `preferredLanguage` from `GET /user/profile` | [x] |
| Accept `preferredLanguage` on `PUT /user/profile` | [x] |
| Include `preferredLanguage` in auth sign-in / sign-up user payload | [x] |
| Add `preferredLanguage` to JWT strategy `req.user` | [x] |
| Update org entity default `supportedLanguages` to include `pt-PT` | [x] |
| Migration: ensure `users.preferredLanguage` column exists | [x] |

**Deliverable:** Clients can sync language preference with the backend. **API and web client sync are both wired.**

---

## Phase 2 — Locale resolution infrastructure

**Goal:** Every request resolves a single locale for content APIs.

| Task | Status |
|------|--------|
| `LocaleService` — normalize + resolve priority chain | [x] |
| `LocaleInterceptor` — attach `request.locale` | [x] |
| `@ResolvedLocale()` param decorator for controllers | [x] |
| Register `LocaleModule` globally in `AppModule` | [x] |
| Allow `Accept-Language` in CORS `allowedHeaders` | [x] |
| TypeORM entities for four translation tables | [x] |
| `ContentLocalizationService` — load + merge translations | [x] |

**Resolution priority:**

1. `?locale=`
2. `Accept-Language`
3. `user.preferredLanguage`
4. Org `defaultLanguage`
5. `en`

---

## Phase 3 — Locale-aware content APIs

**Goal:** Tests, questions, and courses return translated text when available.

| Task | Status |
|------|--------|
| `TestService.findOne` — merge test + question + option translations | [x] |
| `CourseService.findOne` — merge course (+ nested test titles) | [x] |
| `QuestionsService.findByTest` — merge question + option translations | [x] |
| Controllers pass resolved locale into services | [x] |
| Per-field fallback to English when PT missing | [x] |
| Skip translation queries when locale is `en` | [x] |

**Deliverable:** `GET /tests/:id` with `Accept-Language: pt-PT` returns Portuguese when rows exist.

**Note:** Localization is applied on detail endpoints (`findOne` / by-test). List endpoints may still return English base columns unless extended later.

---

## Phase 4 — Attempt locale tracking

**Goal:** Record which language the learner saw when starting an attempt.

| Task | Status |
|------|--------|
| Migration: `test_attempts.locale` column | [x] |
| Map `locale` on `TestAttempt` entity | [x] |
| Persist locale in `TestAttemptsService.createNewAttempt` | [x] |
| Pass locale from `LocaleInterceptor` into `startAttempt` | [x] |

**Policy:** Locale is locked at attempt start (no mid-attempt language switch on server).

---

## Phase 5 — Seed pt-PT translations & org config

**Goal:** Runnable seed via `yarn typeorm:migration:run`.

| Task | Status |
|------|--------|
| Migration: create translation tables (if missing) | [x] |
| Seed full `pt-PT` for all courses, tests, questions, and options | [x] |
| Translation payload JSON (`pt-pt-translations.json`) | [x] |
| Shared upsert helper (`seed-pt-pt-translations.ts`) | [x] |
| Backfill migration for DBs with partial pilot seed | [x] |
| Migration: add `pt-PT` to pilot org `supportedLanguages` (org id `2`) | [x] |
| Idempotent migrations (safe if schema/data already exists) | [x] |

### Seed coverage (verified in database)

| Table | Expected | Verified |
|-------|----------|----------|
| `course_translations` (`pt-PT`) | 5 | [x] |
| `test_translations` (`pt-PT`) | 15 | [x] |
| `question_translations` (`pt-PT`) | 207 | [x] |
| `question_option_translations` (`pt-PT`) | 655 | [x] |

### Regenerating translations (when content changes)

1. Export English source from DB → `scripts/export-translation-source.json`
2. Edit Portuguese in `scripts/pt-pt-translations-data.js`
3. Run `node scripts/build-pt-pt-translations.js` → updates `src/migrations/data/pt-pt-translations.json`
4. Add a new migration (or re-run upsert) to push changes to the database

**Do not regenerate** unless English content changed or Portuguese wording needs updating. Regenerating the JSON alone does not update the database.

---

## Migrations

Run from `pro-train` root:

```bash
yarn typeorm:migration:run
```

| Migration | Purpose | Applied |
|-----------|---------|---------|
| `1741100000000-CreateLocalizationSchema.ts` | Tables + columns (idempotent) | [x] |
| `1741200000000-SeedPtPtPilotTranslations.ts` | Full `pt-PT` content seed + org config | [x] |
| `1741300000000-BackfillAllPtPtTranslations.ts` | Upsert all `pt-PT` translations (fixes partial seeds) | [x] |

**Data files (not migrations):**

| Path | Purpose |
|------|---------|
| `src/migrations/data/pt-pt-translations.json` | Translation payload consumed by seed helper |
| `src/database/seed-pt-pt-translations.ts` | Batch upsert / revert logic |
| `scripts/pt-pt-translations-data.js` | Editable source for Portuguese text |
| `scripts/build-pt-pt-translations.js` | Builds JSON from data file |

Revert last migration:

```bash
yarn typeorm:migration:revert
```

---

## API usage

### Profile

```http
PUT /user/profile
Authorization: Bearer <token>
Content-Type: application/json

{ "preferredLanguage": "pt-PT" }
```

### Localized test

```http
GET /tests/43?locale=pt-PT
Authorization: Bearer <token>
Accept-Language: pt-PT
```

### Start attempt (locale stored)

```http
POST /test-attempts/start
Authorization: Bearer <token>
Accept-Language: pt-PT
```

---

## Testing checklist

### Backend — implementation

All items below are implemented in code:

- [x] `PUT /user/profile` accepts `preferredLanguage`
- [x] `GET /user/profile` returns `preferredLanguage`
- [x] Invalid locale rejected when not in org `supportedLanguages`
- [x] Sign-in response includes `preferredLanguage`
- [x] Content APIs merge `pt-PT` translations with English fallback
- [x] New attempt persists `locale` on `test_attempts`
- [x] Org with `allowUserLanguageChange: false` rejects preference update

### Backend — manual QA

Run these in Postman or via the web app to confirm end-to-end behaviour:

- [ ] `PUT /user/profile` with `preferredLanguage: pt-PT` persists and returns on `GET /user/profile`
- [ ] Sign-in response includes `preferredLanguage` for a test user
- [ ] `GET /tests/43?locale=pt-PT` returns Portuguese titles, questions, and options
- [ ] `GET /courses/23?locale=pt-PT` returns Portuguese course title and nested test titles
- [ ] Missing PT field falls back to English (delete one translation row temporarily to verify)
- [ ] New attempt stores `locale = pt-PT` on `test_attempts` when started with `Accept-Language: pt-PT`
- [ ] Invalid locale (e.g. `fr`) rejected for org without that language in `supportedLanguages`

### Seed data

- [x] All migrations run (`No migrations are pending`)
- [x] Translation table row counts match expected (5 / 15 / 207 / 655)
- [x] Sample rows confirmed in Portuguese (e.g. question 115, option text for question 116)

---

## Web client integration (`protrain-client`)

Cross-repo work needed to complete the user-facing language experience:

| Task | Status |
|------|--------|
| Send `Accept-Language` on API requests | [x] |
| UI strings via i18next (`en` / `pt-PT` locale files) | [x] |
| Sidebar / nav labels localized | [x] |
| `LocaleProvider` reads `user?.preferredLanguage` on login | [x] |
| `setLocale` → `PUT /user/profile` (`preferredLanguage`) | [x] |
| Invalidate React Query cache on locale change (courses, tests, attempts) | [x] |
| Sign-in / `refreshUser` map `preferredLanguage` into session user | [x] |
| End-to-end smoke test: UI + API content both Portuguese | [ ] |

---

## File reference

| Purpose | Path |
|---------|------|
| Status (this file) | `docs/backend-language-change.md` |
| Locale module | `src/locale/` |
| Translation entities | `src/locale/entities/` |
| Content merge service | `src/locale/content-localization.service.ts` |
| Seed helper | `src/database/seed-pt-pt-translations.ts` |
| Translation JSON | `src/migrations/data/pt-pt-translations.json` |
| Migrations | `src/migrations/174110*.ts`, `174120*.ts`, `174130*.ts` |
| Migration helpers | `src/database/migration-utils.ts` |
| User entity | `src/user/entities/user.entity.ts` |
| Test service | `src/test/test.service.ts` |
| Course service | `src/course/course.service.ts` |
| Questions service | `src/questions/questions.service.ts` |
| Test attempts | `src/test_attempts/test_attempts.service.ts` |

---

## Remaining work

### Near term (recommended next)

1. **End-to-end smoke test** — switch to pt-PT in the app and verify course/test content is Portuguese, then confirm `users.preferredLanguage` updated after the toggle.
2. **Backend manual QA** — work through unchecked items in [Testing checklist](#backend--manual-qa).

### Out of scope / later

- [ ] Admin CRUD APIs for translation authoring (web admin UI)
- [ ] `nestjs-i18n` for server validation/error messages
- [ ] Email template localization (`communications` module)
- [ ] Mobile client i18n (`protrain-mobile`)
- [ ] Localize course/test **list** endpoints (if list views should show translated titles without opening detail)
