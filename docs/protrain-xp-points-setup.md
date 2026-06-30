# ProTrain user reward XP points — setup and implementation plan

This document describes how to introduce **learner experience points (XP)** in ProTrain. It is adapted from the LORO-S reference (`loro-xp-points-setup.md`) but tailored to ProTrain’s LMS domain, existing modules, and database conventions.

**Important:** ProTrain already has a **course leaderboard** (`leaderboards` table) that ranks users by **test scores** (average percentage, tests completed). XP is a **separate gamification layer**: a lifetime + monthly ledger that rewards *learning behaviour*, not just raw test performance. The two systems complement each other and should not be merged into one table.

---

## Overview

XP motivates learners to engage with ProTrain training: signing in, completing profiles, starting and passing tests, improving scores, viewing course materials, and finishing courses. Points accumulate on a per-user **`UserRewards`** record with an immutable audit trail in **`xp_transaction`**. Totals drive **level** and **rank**, and monthly totals power **org/branch-scoped challenge leaderboards**.

All awards should flow through a single service method: **`RewardsService.awardXP()`**.

### Current ProTrain state (as of backend review)

| Area | Status |
|------|--------|
| `RewardsModule` / `UserRewards` / `xp_transaction` | **Implemented** (Phases 1–6) — full award pipeline + API + crons |
| Domain events | **Implemented** (Phase 3) — test/auth/user/course/material events emitted |
| `course_material_view` tracking | **Implemented** (Phase 4) — `POST /course-materials/:id/view` |
| `LeaderboardModule` | **Implemented** — derived from `results` (test scores) |
| `TrainingProgressModule` | **Implemented** — per-test completion snapshots |
| `EventEmitterModule` | **Configured globally** in `AppModule` |
| Domain events | **Implemented** — user/course/org/test lifecycle events wired (Phase 3) |
| User identity | UUID `users.id` (not Clerk) |
| Multi-tenancy | `OrgBranchScope` — `orgId`, `branchId`, `userId` as strings |

Primary learner flow today:

```
startAttempt → submitAttempt → autoMark → createFromAttempt → updateUserScore (leaderboard)
                              └→ syncTrainingProgressSnapshotForAttempt
```

XP hooks belong **after** successful business actions (result saved, progress synced), wrapped in try/catch so a rewards failure never rolls back training data.

---

## Step-by-step implementation plan

### Phase 1 — Foundation (database + constants) ✅ COMPLETED

> **Completed:** 2026-06-19 — constants, entities, migration (`1739900000000-CreateUserRewardsTables`), User link, migration executed via `yarn typeorm:migration:run`.

1. ✅ **Create constants file**  
   `src/rewards/constants/xp.constants.ts`  
   Define `XP_VALUES`, `XP_ACTIONS`, `XP_SOURCE_TYPES`, `XP_CATEGORIES`, `LEVELS`, and `RANKS` (see sections below).

2. ✅ **Create entities**  
   - `src/rewards/entities/user-rewards.entity.ts`  
   - `src/rewards/entities/xp-transaction.entity.ts`  
   - Optional (Phase 2+): `achievement.entity.ts`, `user-achievement.entity.ts` — deferred

3. ✅ **Generate TypeORM migration**  
   - Tables: `user_rewards`, `xp_transaction`  
   - Indexes: `(userId)`, `(userRewardsId, timestamp)`, `(orgId, challengeMonthXP)` for monthly rankings  
   - FK: `user_rewards.userId` → `users.id`  
   - FK: `xp_transaction.userRewardsId` → `user_rewards.id` ON DELETE CASCADE  
   - FK: `user_rewards.orgId` → `organizations.id`, optional `branchId` → `branches.id`  
   - File: `src/migrations/1739900000000-CreateUserRewardsTables.ts`  
   - CLI config: `src/data-source.ts` + `package.json` scripts `typeorm`, `typeorm:migration:run`

4. ✅ **Link User entity**  
   Add optional `@OneToOne(() => UserRewards)` on `User` (inverse side), matching ProTrain’s UUID primary key pattern.

5. ✅ **Run migration**  
   ```bash
   yarn typeorm:migration:run
   ```
   Keep `TYPEORM_SYNCHRONIZE=false` in production-like environments.

---

### Phase 2 — Rewards module core ✅ COMPLETED

> **Completed:** 2026-06-19 — full module scaffold, `RewardsService.awardXP()`, controller endpoints, `RewardsModule` registered in `AppModule`.

6. ✅ **Scaffold module**  
   ```
   src/rewards/
   ├── rewards.module.ts
   ├── rewards.controller.ts
   ├── rewards.service.ts
   ├── rewards.subscriber.ts
   ├── dto/
   │   ├── create-reward.dto.ts
   │   ├── award-xp.dto.ts
   │   └── user-rewards-stats.dto.ts
   ├── constants/
   │   └── xp.constants.ts
   ├── utils/
   │   └── xp-breakdown.util.ts
   └── entities/
   ```

7. ✅ **Implement `RewardsService.awardXP()`**  
   Single DB transaction (mirror LORO pattern, adapted for ProTrain):
   - Resolve user by `userId` scoped to `orgId` / optional `branchId`
   - Skip silently if user not found or inactive
   - Find or create `UserRewards` for the user within org scope
   - Roll challenge month forward if UTC month changed
   - Enforce idempotency when `idempotencyKey` is provided (see Idempotency section)
   - Insert `xp_transaction`
   - Update aggregates: `currentXP`, `totalXP`, `challengeMonthXP`, JSON breakdowns
   - Recalculate `level` and `rank` from `totalXP`
   - Save `UserRewards`  
   - Utility: `src/rewards/utils/xp-breakdown.util.ts` (`normalizeXpBreakdown`, category mapping)

8. ✅ **Register module**  
   - Import `RewardsModule` in `AppModule`  
   - Export `RewardsService` for injection into `ResultsModule`, `TestAttemptsModule`, `AuthModule`, `UserModule`, `TrainingProgressModule`, `CourseMaterialsModule`  
   - API endpoints (Phase 2 core): `POST /rewards/award-xp`, `GET /rewards/user-stats/:userId`

9. ✅ **Follow module standards**  
   Per `docs/module.standard.md`:
   - Org/branch-scoped cache keys
   - `RetryService.executeDatabase()` for all DB work
   - Scope all queries when `OrgBranchScope` is available  
   - `RewardsSubscriber` scaffolded (event handlers wired in Phase 3)

---

### Phase 3 — Event infrastructure ✅ COMPLETED

> **Completed:** 2026-06-19 — domain events, `RewardsSubscriber` handlers, email/XP separation preserved.

10. ✅ **Add missing domain events** (event classes in `src/common/events/`; emitted from services):

    | Event name | Emit from | Payload highlights |
    |------------|-----------|-------------------|
    | `test.attempt.started` | `TestAttemptsService.startAttempt` (new attempt only) | `RewardsTestAttemptStartedEvent` |
    | `test.attempt.submitted` | `TestAttemptsService.submitAttempt` | `TestAttemptSubmittedEvent` |
    | `test.result.created` | `ResultsService.createFromAttempt` (after save) | `TestResultCreatedEvent` |
    | `course.completed` | `RewardsService.evaluateAndAwardCourseCompletion` | `CourseCompletedEvent` |
    | `course-material.viewed` | `CourseMaterialsService.recordMaterialView` | `CourseMaterialViewedEvent` |
    | `user.profile.completed` | `UserService.update` | `UserProfileCompletedEvent` |
    | `auth.daily_login` | `AuthService.signIn` | `AuthDailyLoginEvent` |

11. ✅ **Create `RewardsSubscriber`** (`src/rewards/rewards.subscriber.ts`)  
    Listen with `@OnEvent(...)` and delegate to `awardXP()`. Wrap each handler in try/catch — rewards must never break login, test submission, or result creation.

12. ✅ **Keep `EmailListener` pattern**  
    Communications stay in `communications/listeners/email.listener.ts`; XP stays in `rewards.subscriber.ts`. Do not mix concerns.

---

### Phase 4 — Service integrations (direct calls + events) ✅ COMPLETED

> **Completed:** 2026-06-19 — Results/Auth/User/TestAttempts/CourseMaterials wired; admin authoring XP via subscriber.

13. ✅ **Results / test completion (highest priority)**  
    In `ResultsService.createFromAttempt`, after leaderboard update succeeds:
    - Emit `test.result.created`
    - Or call `rewardsService.awardXP()` directly with result metadata  
    Award chain for one submitted test:
    - Base submit XP (once per `attemptId`)
    - Pass bonus if `passed === true`
    - First-try bonus if `attemptNumber === 1` and passed
    - Perfect score bonus if `percentage === 100`
    - Improve-score bonus if new percentage beats user’s previous best for that test  
    - Implemented via `RewardsService.processTestResultXp()` (non-blocking try/catch in `ResultsService`)

14. ✅ **Test attempt start**  
    In `TestAttemptsService.startAttempt`, when a **new** attempt is created (not when returning an existing in-progress attempt):
    - Emit `test.attempt.started` → subscriber awards start XP

15. ✅ **Daily login**  
    In `AuthService.signIn`, after successful authentication:
    - Check last daily-login transaction for user (UTC date)
    - Award `DAILY_LOGIN` at most once per UTC day (idempotency in subscriber)

16. ✅ **Profile completion**  
    In `UserService` update path, when profile meets completion criteria (avatar + firstName + lastName):
    - One-time award via idempotency key `profile-complete:{userId}`

17. ✅ **Course completion**  
    After each result, evaluate whether the user has passed all active tests in the course (reuse logic similar to `CourseService.getCourseLearnerProgress`):
    - One-time award via idempotency key `course-complete:{userId}:{courseId}`

18. ✅ **Course materials (new tracking)**  
    - Entity `course_material_view` + migration `1740000000000-CreateCourseMaterialViewTable`  
    - `POST /course-materials/:id/view`  
    - First view per material → XP; all materials in course viewed → bonus XP

19. ✅ **Admin / trainer actions (optional, role-gated)**  
    Award only to `admin`, `owner`, or `master_admin` roles:
    - `course.created` event (already emitted from `CourseService`) → creator XP
    - `test.created` event (already emitted from `TestService`) → creator XP
    - `course-material.created` event (already emitted) → creator XP

---

### Phase 5 — API + read paths ✅ COMPLETED (backend)

> **Completed:** 2026-06-19 — all `/rewards` read/write endpoints + sign-in `rewardsStats`. Frontend (item 22) deferred to `protrain-client`.

20. ✅ **Controller endpoints** (`/rewards`):

    | Method | Path | Purpose |
    |--------|------|---------|
    | `POST` | `/rewards/award-xp` | Manual/admin award |
    | `GET` | `/rewards/user-stats/:userId` | Lifetime + monthly XP, level, rank, breakdown |
    | `GET` | `/rewards/rankings` | Org/branch leaderboard (`scope=alltime` \| `monthly`) |
    | `GET` | `/rewards/transactions/:userId` | Paginated XP history (optional) |

21. ✅ **Extend sign-in / session payload**  
    `AuthService.loadSignInRewardsStats` returns **`rewardsStats`** (non-fatal on failure, same pattern as leaderboard).

22. ⏳ **Frontend (`protrain-client`)** — not started  
    - `services/rewards-service.ts` — API client  
    - Show XP bar + level on `/training-progress`, `/leaderboard`, nav header  
    - Toast on level-up (optional WebSocket later)  
    - Admin manual award UI (owner/admin only)

---

### Phase 6 — Scheduled jobs + streaks ✅ COMPLETED

> **Completed:** 2026-06-19 — `RewardsCronService` with daily/monthly crons.

23. ✅ **Monthly challenge rollover cron**  
    `@Cron('0 3 * * *')` in `RewardsCronService.rollStaleChallengeMonthsCron`

24. ✅ **Learning streak cron**  
    `@Cron('0 4 * * *')` in `RewardsCronService.evaluateLearningStreaksCron`

25. ✅ **Weekly goal cron (optional)**  
    `@Cron('0 5 * * 1')` in `RewardsCronService.evaluateWeeklyTrainingGoalsCron`

---

### Phase 7 — Testing + rollout

26. **Unit tests**  
    - `awardXP` transaction integrity  
    - Level/rank calculation  
    - Idempotency (duplicate `attemptId` does not double-award)  
    - Category breakdown normalization

27. **Integration tests**  
    - Submit test → result → XP transactions created  
    - Org isolation (user in org A cannot receive XP for org B context)

28. **Feature flag**  
    `REWARDS_XP_ENABLED=true` in env; subscriber and direct calls no-op when disabled.

29. **Backfill (optional)**  
    One-off script: seed `UserRewards` from historical `results` with capped XP (e.g. 50% of normal values) to avoid empty leaderboards for existing learners.

---

## Data model

### `user_rewards` (`UserRewards` entity)

One row per user **per organization** (lazy-created on first XP award). ProTrain users belong to an org via `users.orgId`; branch is optional.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | PK (auto) | Primary key |
| `userId` | UUID FK → `users.id` | Learner |
| `orgId` | FK → `organizations.id` | Required tenant scope |
| `branchId` | FK → `branches.id`, nullable | Optional branch scope |
| `currentXP` | int | Display total (mirrors `totalXP` in normal operation) |
| `totalXP` | int | Lifetime XP — drives level |
| `level` | int (1–10) | Derived from `totalXP` |
| `rank` | enum/string | Tier label (`ROOKIE`, `BRONZE`, …) |
| `xpBreakdown` | JSON | Lifetime XP by category |
| `challengeMonth` | string `YYYY-MM` UTC | Active challenge period |
| `challengeMonthXP` | int | XP earned this month |
| `challengeMonthXpBreakdown` | JSON | Monthly category breakdown |
| `monthlyChallengeHistory` | JSON array | Closed months (cap 48 entries) |
| `lastActionAt` | timestamp | Updated on each award |
| `createdAt` / `updatedAt` | timestamps | Audit |

**User link:**

```typescript
// user.entity.ts
@OneToOne(() => UserRewards, (rewards) => rewards.user)
rewards?: UserRewards;

// user-rewards.entity.ts
@OneToOne(() => User, (user) => user.rewards)
@JoinColumn({ name: 'userId' })
user: User;

@ManyToOne(() => Organization, { nullable: false })
orgId: Organization;

@ManyToOne(() => Branch, { nullable: true })
branchId?: Branch;
```

> **Design note:** If users can belong to multiple orgs in future, use composite uniqueness `(userId, orgId)` rather than one global row per user.

---

### `xp_transaction` (`XPTransaction` entity)

Append-only ledger of every XP award.

| Column | Type | Purpose |
|--------|------|---------|
| `id` | PK | Primary key |
| `userRewardsId` | FK → `user_rewards.id` CASCADE | Parent aggregate |
| `action` | string | Action code (e.g. `PASS_TEST`, `DAILY_LOGIN`) |
| `xpAmount` | int | Points awarded (always positive) |
| `metadata` | JSON | `{ sourceId, sourceType, details, idempotencyKey? }` |
| `timestamp` | timestamp | When the award occurred |

**Indexes:**
- `IDX_xp_transaction_rewards_timestamp` on `(userRewardsId, timestamp)` — monthly aggregation, streaks
- `IDX_xp_transaction_idempotency` unique on `(userRewardsId, idempotencyKey)` where key is not null

---

### Optional: `course_material_view`

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `userId` | FK → users |
| `materialId` | FK → course_materials |
| `courseId` | FK → courses |
| `viewedAt` | First view timestamp |

Unique constraint: `(userId, materialId)`.

---

## XP amount constants

Define in `src/rewards/constants/xp.constants.ts`.

### `XP_VALUES` — points per action

| Constant | Action | Points | Rationale |
|----------|--------|--------|-----------|
| `DAILY_LOGIN` | First login per UTC day | **10** | Habit building without inflating totals |
| `COMPLETE_PROFILE` | Avatar + name filled | **40** | One-time onboarding boost |
| `START_TEST_ATTEMPT` | New attempt started | **5** | Encourages starting, low repeat farming |
| `SUBMIT_TEST` | Attempt submitted & scored | **15** | Core learning action |
| `PASS_TEST` | Result `passed === true` (≥60%) | **20** | Reward competence |
| `PASS_TEST_FIRST_TRY` | Pass on `attemptNumber === 1` | **15** | Bonus on top of pass (not instead) |
| `PERFECT_SCORE` | `percentage === 100` | **40** | Mastery moment |
| `IMPROVE_SCORE` | Beat previous best on same test | **10** | Encourage retakes |
| `COMPLETE_COURSE` | All active tests passed in course | **75** | Major milestone |
| `VIEW_COURSE_MATERIAL` | First view of a material | **5** | Content engagement |
| `COMPLETE_ALL_MATERIALS` | All materials in course viewed | **25** | Course content completion |
| `LEARNING_STREAK_7` | 7 consecutive days with XP activity | **50** | Weekly retention |
| `WEEKLY_TRAINING_GOAL` | ≥3 tests completed in 7 days | **30** | Sustained effort |
| `CREATE_COURSE` | Admin/trainer creates course | **25** | Authoring (role-gated) |
| `CREATE_TEST` | Admin/trainer creates test | **15** | Authoring (role-gated) |
| `ADD_COURSE_MATERIAL` | Material linked to course | **5** | Authoring (role-gated) |

**Example — learner passes a test first try at 85%:**

| Award | Points |
|-------|--------|
| `SUBMIT_TEST` | 15 |
| `PASS_TEST` | 20 |
| `PASS_TEST_FIRST_TRY` | 15 |
| **Total** | **50** |

**Example — perfect score on second attempt:**

| Award | Points |
|-------|--------|
| `SUBMIT_TEST` | 15 |
| `PASS_TEST` | 20 |
| `PERFECT_SCORE` | 40 |
| `IMPROVE_SCORE` | 10 (if beats prior best) |
| **Total** | **85** (no first-try bonus) |

---

### `XP_ACTIONS` — stored in `xp_transaction.action`

```typescript
export const XP_ACTIONS = {
  DAILY_LOGIN: 'DAILY_LOGIN',
  COMPLETE_PROFILE: 'COMPLETE_PROFILE',
  START_TEST_ATTEMPT: 'START_TEST_ATTEMPT',
  SUBMIT_TEST: 'SUBMIT_TEST',
  PASS_TEST: 'PASS_TEST',
  PASS_TEST_FIRST_TRY: 'PASS_TEST_FIRST_TRY',
  PERFECT_SCORE: 'PERFECT_SCORE',
  IMPROVE_SCORE: 'IMPROVE_SCORE',
  COMPLETE_COURSE: 'COMPLETE_COURSE',
  VIEW_COURSE_MATERIAL: 'VIEW_COURSE_MATERIAL',
  COMPLETE_ALL_MATERIALS: 'COMPLETE_ALL_MATERIALS',
  LEARNING_STREAK_7: 'LEARNING_STREAK_7',
  WEEKLY_TRAINING_GOAL: 'WEEKLY_TRAINING_GOAL',
  CREATE_COURSE: 'CREATE_COURSE',
  CREATE_TEST: 'CREATE_TEST',
  ADD_COURSE_MATERIAL: 'ADD_COURSE_MATERIAL',
  MANUAL_AWARD: 'MANUAL_AWARD',
} as const;
```

---

### `XP_SOURCE_TYPES` — `metadata.sourceType`

```typescript
export const XP_SOURCE_TYPES = {
  AUTH: 'auth',
  USER: 'user',
  TEST_ATTEMPT: 'test_attempt',
  TEST_RESULT: 'test_result',
  COURSE: 'course',
  COURSE_MATERIAL: 'course_material',
  TRAINING_PROGRESS: 'training_progress',
  STREAK: 'streak',
  ADMIN: 'admin',
} as const;
```

---

### `XP_CATEGORIES` — breakdown JSON keys

Used in `xpBreakdown` and `challengeMonthXpBreakdown`:

| Category key | Maps from |
|--------------|-----------|
| `learning` | Test submit, pass, perfect, improve |
| `courses` | Course completion, all materials |
| `engagement` | Login, streaks, weekly goals |
| `profile` | Profile completion |
| `materials` | Material views |
| `authoring` | Create course/test/material (admin) |
| `other` | Manual awards, unmapped actions |

Implement normalization in `src/rewards/utils/xp-breakdown.util.ts` (mirror LORO `normalizeXpBreakdown()`).

---

### Levels and ranks

ProTrain learners earn XP more slowly than LORO field staff; use wider bands:

**Levels (`LEVELS`) — by `totalXP`:**

| Level | XP range |
|-------|----------|
| 1 | 0 – 500 |
| 2 | 501 – 1,500 |
| 3 | 1,501 – 3,500 |
| 4 | 3,501 – 7,000 |
| 5 | 7,001 – 12,000 |
| 6 | 12,001 – 20,000 |
| 7 | 20,001 – 32,000 |
| 8 | 32,001 – 50,000 |
| 9 | 50,001 – 75,000 |
| 10 | 75,001 – 1,000,000 |

**Ranks (`RANKS`) — from level:**

| Rank | Levels |
|------|--------|
| ROOKIE | 1 |
| BRONZE | 2–3 |
| SILVER | 4–5 |
| GOLD | 6–7 |
| PLATINUM | 8–9 |
| DIAMOND | 10 |

Default on new `UserRewards`: `level = 1`, `rank = 'ROOKIE'`.

---

## Tasks users complete to earn XP

### Learners (`UserRole.USER`)

| User task | When it completes | XP award(s) |
|-----------|-------------------|-------------|
| Sign in | First login of UTC day | `DAILY_LOGIN` (10) |
| Complete profile | Avatar + first + last name saved | `COMPLETE_PROFILE` (40, once) |
| Start a test | New `test_attempts` row created | `START_TEST_ATTEMPT` (5) |
| Submit a test | Attempt status → `submitted`, result created | `SUBMIT_TEST` (15) |
| Pass a test | Result `passed === true` | `PASS_TEST` (20) |
| Pass on first attempt | Pass + `attemptNumber === 1` | `PASS_TEST_FIRST_TRY` (15) |
| Score 100% | Result `percentage === 100` | `PERFECT_SCORE` (40) |
| Improve previous best | New % > best prior result for same test | `IMPROVE_SCORE` (10) |
| View course material | First open of material (tracked) | `VIEW_COURSE_MATERIAL` (5) |
| View all materials in course | All materials have view records | `COMPLETE_ALL_MATERIALS` (25) |
| Complete a course | Passed all active tests in course | `COMPLETE_COURSE` (75) |
| 7-day learning streak | XP-earning activity 7 days in a row | `LEARNING_STREAK_7` (50) |
| Weekly training goal | ≥3 tests submitted in 7 days | `WEEKLY_TRAINING_GOAL` (30) |

### Admins / trainers (`ADMIN`, `OWNER`, `MASTER_ADMIN`)

| User task | When it completes | XP award(s) |
|-----------|-------------------|-------------|
| Create a course | `course.created` event | `CREATE_COURSE` (25) |
| Create a test | `test.created` event | `CREATE_TEST` (15) |
| Add course material | `course-material.created` event | `ADD_COURSE_MATERIAL` (5) |
| Manual award | `POST /rewards/award-xp` | Custom amount |

---

## How event triggers will be handled

### Architecture

```
Domain service (Results, TestAttempts, Auth, User, Course)
        │
        ├── emit domain event ──► RewardsSubscriber ──► RewardsService.awardXP()
        │
        └── direct awardXP() in try/catch (for complex multi-award chains)
```

Use **events** for single, decoupled awards. Use **direct calls** in `ResultsService.createFromAttempt` when one submission triggers a **chain** of awards (submit + pass + perfect + improve) so logic stays in one place.

### Subscriber mapping (`rewards.subscriber.ts`)

| Event | Handler | XP |
|-------|---------|-----|
| `auth.daily_login` | `handleDailyLogin` | `DAILY_LOGIN` |
| `user.profile.completed` | `handleProfileCompleted` | `COMPLETE_PROFILE` |
| `test.attempt.started` | `handleAttemptStarted` | `START_TEST_ATTEMPT` |
| `course.created` | `handleCourseCreated` | `CREATE_COURSE` (role check) |
| `test.created` | `handleTestCreated` | `CREATE_TEST` (role check) |
| `course-material.created` | `handleMaterialCreated` | `ADD_COURSE_MATERIAL` (role check) |
| `course-material.viewed` | `handleMaterialViewed` | `VIEW_COURSE_MATERIAL` |
| `course.completed` | `handleCourseCompleted` | `COMPLETE_COURSE` |

### Direct integration (no subscriber)

| Location | Method | Responsibility |
|----------|--------|----------------|
| `ResultsService` | `createFromAttempt` | Submit / pass / first-try / perfect / improve awards; emit `test.result.created`; evaluate course completion |
| `AuthService` | `signIn` | Emit `auth.daily_login` after success |
| `UserService` | `update` | Emit `user.profile.completed` when criteria met |
| `TestAttemptsService` | `startAttempt` | Emit `test.attempt.started` for new attempts only |

### Events to add / wire (gaps in current codebase)

| Event class | File | Currently emitted? |
|-------------|------|-------------------|
| `TestAttemptStartedEvent` | `common/events/test-attempt-started.event.ts` | **No** — import exists in `test.service.ts` only |
| `TestResultsReadyEvent` | `common/events/test-results-ready.event.ts` | **No** |
| `CourseCreatedEvent` | `common/events/course-created.event.ts` | **Yes** — `course.service.ts` |
| `TestCreatedEvent` | `common/events/test-created.event.ts` | **Yes** — `test.service.ts` |
| `course-material.created` | inline payload | **Yes** — `course-materials.service.ts` |

**Recommendation:** Emit `test.result.created` from `ResultsService` (new event class) rather than overloading `TestResultsReadyEvent`, unless email templates already depend on the latter name.

---

## How XP is stored in the database

### Relationship diagram

```
User (users.id UUID)
  │
  ├── orgId / branchId (tenant scope)
  │
  └── UserRewards (user_rewards) — one per user per org
        ├── currentXP, totalXP, level, rank
        ├── xpBreakdown (JSON)
        ├── challengeMonth, challengeMonthXP, challengeMonthXpBreakdown
        ├── monthlyChallengeHistory (JSON)
        │
        └── xp_transaction[] (append-only ledger)
              ├── action, xpAmount, metadata, timestamp
              └── metadata.sourceId → resultId | attemptId | materialId | ...
```

### Persistence rules

1. **Transaction safety** — `awardXP` runs inside `DataSource.transaction()`. Ledger insert and aggregate update commit or roll back together.

2. **Lazy creation** — No `user_rewards` row until first award. Defaults: empty breakdown objects, `challengeMonth = current UTC month`, `level = 1`, `rank = ROOKIE`.

3. **Org scoping** — Every award requires `orgId` from `OrgBranchScope` or JWT user context. Throws if missing (same as LORO).

4. **Separation from course leaderboard** — `leaderboards.totalPoints` remains **test score sum** from `results.score`. Do not write XP into that column. Optionally show both on the UI: “Test points” vs “XP”.

5. **Monthly challenge rollover** — On each award, if `challengeMonth !== yyyy-MM (UTC)`, archive prior month into `monthlyChallengeHistory`, reset `challengeMonthXP`, continue.

6. **Reconstruction** — If history is missing, rebuild monthly totals from `xp_transaction` filtered by timestamp (same pattern as LORO `aggregateMonthBreakdownFromTransactions`).

---

## Central entry point: `RewardsService.awardXP()`

**Input:** `AwardXpDto` + org context:

```typescript
interface AwardXpDto {
  userId: string;                    // users.id (UUID)
  amount: number;
  action: string;                    // XP_ACTIONS.*
  source?: {
    id: string;                      // resultId, attemptId, courseId, etc.
    type: string;                    // XP_SOURCE_TYPES.*
    details?: string;
  };
  idempotencyKey?: string;           // strongly recommended
}

// Context
orgId: string;                       // required
branchId?: string;
```

**Flow:**

1. Resolve user in org (and branch if scoped).
2. Skip if user not found or `status !== active`.
3. Find or create `UserRewards`.
4. If `idempotencyKey` already exists for this rewards row → return success without duplicate insert.
5. `rollChallengeMonthIfNeeded()`.
6. Insert `xp_transaction`.
7. Increment totals and category breakdowns.
8. Recalculate level/rank if `totalXP` crossed a threshold.
9. Save and return updated stats.

---

## Idempotency rules

Each business action that must only pay once should pass a stable key:

| Action | Suggested `idempotencyKey` |
|--------|---------------------------|
| Daily login | `daily-login:{userId}:{yyyy-MM-dd}` |
| Profile complete | `profile-complete:{userId}` |
| Start attempt | `attempt-start:{attemptId}` |
| Submit test | `attempt-submit:{attemptId}` |
| Pass / perfect / improve | `result:{resultId}:{action}` |
| Course complete | `course-complete:{userId}:{courseId}` |
| Material view | `material-view:{userId}:{materialId}` |
| All materials | `materials-complete:{userId}:{courseId}` |
| 7-day streak | `streak-7:{userId}:{yyyy-Www}` |
| Weekly goal | `weekly-goal:{userId}:{yyyy-Www}` |

Without keys, retried result processing or webhook duplicates could inflate XP.

---

## Module wiring

```typescript
// rewards.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([UserRewards, XPTransaction, User]),
    forwardRef(() => UserModule),
  ],
  controllers: [RewardsController],
  providers: [RewardsService, RewardsSubscriber],
  exports: [RewardsService],
})
export class RewardsModule {}
```

**Inject `RewardsService` into:**

| Module | Reason |
|--------|--------|
| `ResultsModule` | Test completion award chain |
| `TestAttemptsModule` | Attempt started events |
| `AuthModule` | Daily login |
| `UserModule` | Profile completion |
| `CourseMaterialsModule` | Material view/create hooks |
| `CourseModule` | Course completion evaluation |

**Requires:** `EventEmitterModule.forRoot()` (already in `AppModule`).

---

## Reading XP (API)

| Endpoint | Purpose |
|----------|---------|
| `POST /rewards/award-xp` | Manual award (admin) |
| `GET /rewards/user-stats/:userId` | Lifetime + challenge XP, level, rank, breakdown |
| `GET /rewards/rankings?scope=alltime\|monthly&orgId=…` | XP leaderboard (separate from `/leaderboards/course/:id`) |
| `GET /rewards/transactions/:userId?page=1&limit=20` | Audit history |

**Query param:** `month=YYYY-MM` scopes challenge XP to a calendar month.

Extend `GET /auth/sign-in` or session endpoints to include `rewardsStats` alongside existing leaderboard stats from `loadSignInLeaderboardStats`.

---

## Frontend integration checklist

| Area | File(s) | Change |
|------|---------|--------|
| API client | `services/rewards-service.ts` | New service |
| Types | `types/api.ts` | `UserRewards`, `XpTransaction`, stats DTOs |
| Training progress | `app/training-progress/page.tsx` | XP summary card |
| Leaderboard | `app/leaderboard/page.tsx` | Tab: “Test scores” vs “XP” |
| Nav / profile | `components/nav-header.tsx` | Level badge |
| Test results | `components/tests/test-results.tsx` | “+XX XP earned” toast |
| Auth session | `context/auth-context.tsx` | Store `rewardsStats` from sign-in |

---

## Relationship to existing leaderboard

| | Course leaderboard (`leaderboards`) | XP system (`user_rewards`) |
|--|-------------------------------------|----------------------------|
| **Purpose** | Rank by test performance in a course | Gamify learning behaviour org-wide |
| **Updated when** | `ResultsService.createFromAttempt` | Every rewarded action |
| **Primary metric** | `averageScore`, `testsCompleted` | `totalXP`, `level`, `rank` |
| **Scope** | Per `courseId` | Per user per org (+ monthly challenge) |
| **UI** | `/leaderboard` (course 23 hardcoded today) | New XP rankings + profile badges |

Keep both. Optionally add a combined “engagement score” in reports later — do not conflate storage.

---

## Important notes

1. **Organisation context is mandatory** — every award must include `orgId` from JWT / `OrgBranchScope`.
2. **UUID identity** — ProTrain uses `users.id` (UUID), not Clerk. All FKs and DTOs should use `userId: string`.
3. **XP ≠ test score points** — `leaderboards.totalPoints` is sum of exam scores; XP is independent.
4. **Non-blocking awards** — wrap all `awardXP` calls in try/catch; log errors; never fail test submission or login.
5. **Feature flag** — ship dark with `REWARDS_XP_ENABLED` until backfill and QA complete.
6. **Pass threshold** — ProTrain uses **60%** pass rate in `ResultsService.createFromAttempt`; align `PASS_TEST` with that rule.
7. **Attempt limits** — `tests.maxAttempts` caps retakes; XP for `IMPROVE_SCORE` still applies within allowed attempts.
8. **Admin awards** — restrict `POST /rewards/award-xp` to `ADMIN`, `OWNER`, `MASTER_ADMIN` via existing role guards (`docs/ROLE_GUARDS.md`).
9. **Breakdown sync** — when adding categories, update both `xp-breakdown.util.ts` and `RewardsService.mapSourceTypeToCategory()`.
10. **Material views** — requires new tracking; until implemented, skip material-related XP or awards will never fire.

---

## Quick reference — award payload example

```typescript
await rewardsService.awardXP(
  {
    userId: result.userId,
    amount: XP_VALUES.PASS_TEST,
    action: XP_ACTIONS.PASS_TEST,
    source: {
      id: String(result.resultId),
      type: XP_SOURCE_TYPES.TEST_RESULT,
      details: `Passed ${test.title} with ${result.percentage}%`,
    },
    idempotencyKey: `result:${result.resultId}:PASS_TEST`,
  },
  scope.orgId!,
  scope.branchId,
);
```

This creates (or updates) the user’s `UserRewards` row for that org, inserts one `xp_transaction`, updates totals and breakdowns, and applies level-up logic in a single transaction.

---

## Suggested implementation order (summary)

1. Constants + entities + migration  
2. `RewardsService.awardXP()` + module registration  
3. `ResultsService.createFromAttempt` award chain (highest user-visible impact)  
4. Daily login + profile completion  
5. Event emissions for test lifecycle  
6. API + frontend stats  
7. Material view tracking + material XP  
8. Crons (monthly rollover, streaks)  
9. Admin manual awards + optional historical backfill  

This order delivers meaningful XP to learners after step 3, while keeping risk low and aligning with ProTrain’s existing test → result → leaderboard pipeline.
