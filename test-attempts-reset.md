# Admin Reset of User Test Attempts + Restriction of Pre-Reset Results

## 1. Overview

Today, when a learner uses up the attempts allowed by `tests.maxAttempts`, the apps show a
"no attempts remaining" state (`components/loader/maximum-attempts-loader.tsx` on web,
`getStatusMessage` in `src/components/learner/test-card.tsx` on mobile) and the backend rejects
`POST /test-attempts/start`.

This feature lets an **admin, owner or master admin** reset a **specific learner's attempts for a
specific test** so the learner can sit the test again.

### Anti-cheat requirement

Marking is automatic: on submit, the server marks the answers and returns a full breakdown
including the **correct answer for every question** (`ResultsService.getQuestionBreakdown`) and the
per-answer grading (`AnswersService.findByAttempt`). If a learner could still read their previous
attempts after a reset, the retake would be worthless — they would simply copy the answer key.

Therefore, the reset must **void** everything that came before it. After a reset, for that learner
and that test:

- previous attempts, answers and results must be invisible and unreachable through every
  learner-facing endpoint;
- only attempts and results created **after** the reset may be returned;
- the data must not be destroyed, because admins and reporting still need the history.

---

## 2. Data model

### 2.1 New entity: `TestAttemptReset`

`src/test_attempts/entities/test-attempt-reset.entity.ts` → table `test_attempt_resets`.

| Column | Type | Notes |
| --- | --- | --- |
| `resetId` | PK int | |
| `testId` | int | indexed |
| `userId` | uuid | indexed, the learner being reset |
| `resetByUserId` | uuid | the admin who performed the reset (audit) |
| `reason` | varchar(500) nullable | free-text justification |
| `attemptsVoided` | int | how many attempts this reset voided |
| `resultsVoided` | int | how many results this reset voided |
| `resetAt` | timestamp | indexed, the watermark |
| `createdAt` | timestamp | |
| `orgId` | ManyToOne Organization, not null | scoping |
| `branchId` | ManyToOne Branch, nullable | scoping |

Append-only. This mirrors the existing audit-style entities in the codebase
(`XPTransaction`, `Communication`, `CourseMaterialView`).

### 2.2 New columns on existing tables

- `test_attempts.voidedByResetId` int NULL, FK → `test_attempt_resets.resetId` (`ON DELETE SET NULL`), indexed
- `results.voidedByResetId` int NULL, FK → `test_attempt_resets.resetId` (`ON DELETE SET NULL`), indexed

`NULL` means "live / visible to the learner". A non-null value means "voided by that reset".

### 2.3 Why a denormalised flag rather than comparing timestamps

An alternative is to store only `resetAt` and filter learner queries with
`attempt.startTime > (latest resetAt for this user+test)`. That was rejected because:

1. It forces a correlated subquery or extra join into **every** learner query
   (`my-attempts`, `my-results`, `/tests?includeUserData=true`, stats, analytics), which is
   the hottest path in the app.
2. The flag is a single indexable predicate — `AND x.voidedByResetId IS NULL` — that drops
   cleanly into the existing `QueryBuilder` chains.
3. Repeated resets stack naturally, and each row records *which* reset voided it, which the
   timestamp approach cannot express.
4. It is idempotent: the reset only touches rows where `voidedByResetId IS NULL`, so a retried
   request cannot re-void rows that an earlier reset already claimed.

### 2.4 Migration

`src/migrations/1741000000000-AddTestAttemptResets.ts`, matching the existing raw-SQL MySQL style
(`1740900000000-ReplaceExamDateWithWindow.ts`). `up` creates the table, adds both columns, the
indexes and the foreign keys; `down` reverses in the opposite order. `synchronize` is `false`, so
the migration is mandatory: `yarn typeorm:migration:run`.

---

## 3. Detailed phase plan

### Phase 1 — Backend: data model

1. Add `TestAttemptReset` entity.
2. Add `voidedByResetId` to `TestAttempt` and `Result` entities (plus the `voidedByReset` relation).
3. Write the migration.
4. Register `TestAttemptReset` in `TypeOrmModule.forFeature` in `TestAttemptsModule` and in the
   explicit `entities: [...]` array in `app.module.ts` (project convention — `autoLoadEntities`
   is on, but the array is kept exhaustive).

### Phase 2 — Backend: reset service + endpoints

1. `TestAttemptsService.resetUserTestAttempts(dto, scope)` — the transactional reset (section 5).
2. `TestAttemptsService.findAttemptResets(scope, filters)` — paginated audit history.
3. DTOs: `ResetTestAttemptsDto` (request), `TestAttemptResetResponseDto`,
   `TestAttemptResetListResponseDto`.
4. Controller: `POST /test-attempts/admin/reset` and `GET /test-attempts/admin/resets`, both
   guarded with `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN, OWNER, MASTER_ADMIN)`,
   scoped with `@OrgBranchScope()`.

### Phase 3 — Backend: learner visibility filtering

Add `voidedByResetId IS NULL` to every learner-reachable read path (section 4 lists them all),
and add an `includeVoided` option used only by admin paths.

### Phase 4 — Backend: attempt-count unification

The three existing counters disagree, which would leave the learner still locked out after a
reset (section 6).

### Phase 5 — Web (`protrain-client`)

1. `services/test-service.ts`: `resetUserTestAttempts()`, `getAttemptResets()`.
2. `types/api.ts`: `ResetTestAttemptsRequest`, `TestAttemptReset`, and `voidedByResetId` on the
   attempt/result types.
3. `hooks/tests/use-test-attempts.ts`: `useResetUserTestAttempts()` mutation with broad cache
   invalidation; also widen the existing `useResetAttempt` invalidation, which currently only
   invalidates the single attempt detail.
4. New `components/admin/reset-attempts-dialog.tsx` — shadcn `AlertDialog` + react-hook-form/zod
   reason field, destructive styling, loading state.
5. Wire it into the results detail drawer in `app/admin/results/page.tsx`, which already has
   `userId`, `testId` and the learner's name in scope — the only place in the admin UI that
   currently has both identifiers together.
6. Learner-side resilience: the result detail and per-test result views must render a friendly
   "this result is no longer available" state instead of an error when the server returns 404
   for a now-voided result.

### Phase 6 — Mobile (`protrain-mobile`)

1. `src/services/admin-test-attempt-service.ts` (new, one export, matching the existing service
   class + singleton convention).
2. `src/types/admin-type.ts`: reset request/response types.
3. `src/hooks/use-admin-test-attempts.ts`: `useResetUserTestAttempts()` with the same invalidation
   set plus `['admin', 'users', userId]`.
4. `src/components/admin/reset-attempts-modal.tsx` — follows `deactivate-test-modal.tsx`
   (transparent `Modal`, `GlassCard`-style panel, `Button` with `bg-danger`, `isLoading`).
5. Wire into `src/app/(admin)/users/[userId].tsx`, on each recent-result row (it exposes both
   `userId` and `result.testId`).
6. Learner-side resilience: `src/app/test-results/[testId].tsx` handles 404 gracefully, and the
   stale `protrain_active_attempt_${testId}` AsyncStorage key is cleared when the active-attempt
   query returns `null`.

### Phase 7 — Verification

Type-check all three repos, run the backend lint/build, and walk the manual test matrix in
section 8.

---

## 4. How previous results are restricted

Every read path a learner can reach gains the `voidedByResetId IS NULL` predicate. Admin paths pass
`includeVoided` explicitly where history is wanted.

### Backend paths to change

**`TestAttemptsService`**

| Method | Change |
| --- | --- |
| `getUserAttempts` | exclude voided (list + embedded statistics) |
| `findOne` | voided attempt → `NotFoundException` for the owner |
| `getActiveAttempt` | exclude voided |
| `getAttemptWithProgress` | exclude voided |
| `getStats` | exclude voided unless the caller is elevated |
| `calculateScore` | exclude voided |
| `submitAttempt` / `updateProgress` / `cancelAttempt` | reject writes against a voided attempt |
| `findOrCleanupUserAttempt` | never resume a voided in-progress attempt |
| `validateNewAttemptAllowed` / `validateAttemptLimits` | count only live attempts |
| `findAttemptsByTest` | force `userId = scope.userId` and exclude voided for non-elevated callers |

**`ResultsService`**

| Method | Change |
| --- | --- |
| `buildFilterQuery` / `findUserResults` | exclude voided |
| `findTestResults`, `findCourseResults` | exclude voided |
| `findOne` | voided result → `NotFoundException` |
| `getUserResultCounts` | exclude voided (also currently missing org/branch scoping) |
| `getTestAnalytics` | exclude voided |
| `getAdminDashboard`, `getAdminEmployeeMetrics` | exclude voided by default so org metrics reflect the currently valid state; `includeVoided=true` opt-in for history |

**`AnswersService`**

| Method | Change |
| --- | --- |
| `findByAttempt` | if the attempt is voided and the caller is not elevated → `NotFoundException` |
| `create` / `createBulk` / `update` | reject writes against a voided attempt |

**`TestService`**

| Method | Change |
| --- | --- |
| `getUserAttemptData` | count only live attempts, so `attemptsRemaining`, `attemptLimitReached`, `canStartNewAttempt`, `bestAttempt` and `allAttempts` all reset |

### Not-found, not forbidden

Voided rows are reported to learners as **404 Not Found**, never 403. A 403 confirms the row
exists and belongs to them, which is a (small) information leak and, more practically, produces a
worse UX. Admins keep 403/404 semantics unchanged.

### Defence in depth

The filtering is enforced **only on the server**. The clients never receive voided rows, so no
client-side hiding is required and a tampered client cannot reveal them. The client work is limited
to cache invalidation and graceful 404 handling.

---

## 5. How the reset works

### Trigger

An admin opens the learner's result in the admin UI (web: results detail drawer; mobile: user
detail screen), clicks **Reset attempts**, optionally types a reason, and confirms in a destructive
dialog.

`POST /test-attempts/admin/reset`

```jsonc
{
  "testId": 42,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "reason": "Learner lost connection during their final attempt"
}
```

### Server flow (single transaction)

1. **Authorize** — `RolesGuard` + `@Roles(ADMIN, OWNER, MASTER_ADMIN)`; the service additionally
   asserts the elevated role, mirroring `ResultsService.assertAdminAccess`.
2. **Validate scope** — load the test and the learner and confirm both belong to the caller's
   `orgId` (and `branchId` when the caller is branch-scoped). An admin cannot reset a learner or a
   test outside their own organisation.
3. **Guard against a no-op** — if the learner has no live attempts for the test, return `409` with
   a clear message rather than writing an empty audit row.
4. **Insert the `test_attempt_resets` row** to obtain `resetId` (this is the watermark).
5. **Cancel any live in-progress attempt** — `status = 'cancelled'`, so a learner mid-session
   cannot submit into the new window and inherit an old attempt number.
6. **Void the attempts** —
   `UPDATE test_attempts SET voidedByResetId = :resetId WHERE testId = :testId AND userId = :userId AND voidedByResetId IS NULL`.
7. **Void the results** — the same update on `results`. Answers are voided transitively, because
   `AnswersService.findByAttempt` resolves visibility through the parent attempt.
8. **Record the counts** on the reset row (`attemptsVoided`, `resultsVoided`).
9. **Commit**, then outside the transaction: invalidate the attempt/result/test caches
   (`invalidateAttemptCache` and the results cache keys) and call
   `testService.refreshTestStatistics(testId)`.

Steps 4–8 are one transaction, so a partial reset — attempts voided but results still visible —
cannot occur.

### What the learner sees afterwards

| Before reset | After reset |
| --- | --- |
| `attemptsCount = 3`, `attemptsRemaining = 0`, `canStartNewAttempt = false` | `attemptsCount = 0`, `attemptsRemaining = maxAttempts`, `canStartNewAttempt = true` |
| Max-attempts loader / "No attempts remaining" badge | Normal "Start test" call to action |
| Old results listed in Results / Past results | Those results are gone from every list |
| Old result detail URL renders the answer key | 404 → friendly "no longer available" state |
| `attemptNumber` of the next attempt would be 4 | Next attempt is number 1 again |

### What the admin sees afterwards

Nothing is deleted. `GET /test-attempts/admin/resets` returns the audit trail (who reset whom, when
and why, and how many rows were voided), and admin attempt/result queries can opt back into the
history with `includeVoided=true`.

---

## 6. Attempt-count consistency (required for the reset to actually work)

Three code paths currently count attempts differently:

| Path | Counts |
| --- | --- |
| `validateNewAttemptAllowed` (the gate in `startAttempt`) | all attempts **except** `cancelled` |
| `validateAttemptLimits` | **all** attempts including `cancelled` |
| `TestService.getUserAttemptData` (what the UI renders) | **all** attempts including `cancelled` |

Left alone, a reset would unlock the backend gate while the UI still displayed
"No attempts remaining", because the UI counter would keep counting the voided and cancelled rows.

All three are therefore routed through one rule:

> A test attempt is **chargeable** when `voidedByResetId IS NULL` **and** `status != 'cancelled'`.

`startAttempt` is already the authority for this rule, so aligning the other two on it is a
consistency fix rather than a behaviour change for the non-reset flow.

---

## 7. Edge cases

| Case | Handling |
| --- | --- |
| Learner is mid-attempt when the admin resets | The in-progress attempt is cancelled and voided in the same transaction. The learner's next submit/progress call returns 404 and the client sends them back to the test overview to start fresh. |
| Learner is looking at an old result when the reset lands | The next fetch 404s; both clients render a "This result is no longer available" empty state rather than an error toast. |
| Learner has the attempt cached client-side | Server-side filtering means the cached copy is the only remaining exposure; it disappears on the next refetch (React Query `staleTime` is 5 min on web, 60 s on mobile) and on app focus/mount. No sensitive data is added to persistent storage by this feature. |
| Two admins reset at the same time | The `voidedByResetId IS NULL` predicate makes the update idempotent — the second transaction voids zero rows and gets a 409. |
| Reset on a test the learner never attempted | 409 with an explanatory message; no audit row is written. |
| Admin resets a learner in another organisation | 403 from the org/branch scope check. |
| Learner tries the admin endpoint | 403 from `RolesGuard`. |
| Stale mobile `protrain_active_attempt_${testId}` key | Cleared when `getActiveAttempt` returns `null`. |
| XP / leaderboard already awarded for a voided result | Not reversed. XP uses the idempotency key `result:${resultId}:PASS_TEST`, so a retake mints a new key and can award XP again. This is called out in the admin dialog copy ("previously awarded XP is not removed") so resets are not used casually. Reversal is deliberately out of scope — there is no existing XP reversal API. |
| Existing `GET /test-attempts/test/:testId` leaks every learner's attempts to any authenticated user | Fixed as part of this work by forcing `userId = scope.userId` for non-elevated callers, which preserves the learner UI that already calls it with its own `userId`. |

---

## 8. Manual verification matrix

1. Learner exhausts `maxAttempts` → max-attempts state shown, `POST /test-attempts/start` rejected.
2. Learner records their old score and the direct URL of an old result.
3. Admin resets that learner for that test with a reason.
4. Learner refreshes:
   - test card shows "Start test", `attemptsRemaining = maxAttempts`;
   - Results / Past results no longer list the old attempts;
   - the saved old-result URL returns the "no longer available" state, not the answer key;
   - `GET /test-attempts/my-attempts`, `GET /results/my-results`, `GET /results/:oldId`,
     `GET /answers/attempt/:oldAttemptId` all hide or 404 the pre-reset data.
5. Learner retakes → new attempt is number 1, new result is visible, old ones stay hidden.
6. Admin: `GET /test-attempts/admin/resets` lists the reset; `includeVoided=true` still returns the
   history.
7. A non-admin calling `POST /test-attempts/admin/reset` gets 403.
8. An admin from another org gets 403.
9. Repeat the reset immediately → 409, no duplicate audit row.
