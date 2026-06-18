# User reward XP points — setup and flow

This document describes how **staff user experience points (XP)** work in LORO-S. XP is separate from **client loyalty points** (`LoyaltyService` / `client_loyalty_profile`), which use a different schema and APIs.

---

## Overview

XP gamifies workforce activity: completing tasks, checking in, creating leads, filing claims, writing journals, and similar actions earn points. Points accumulate on a per-user **`UserRewards`** record, with an immutable audit trail in **`xp_transaction`**. Totals drive **level** and **rank**, and monthly totals power **challenge leaderboards**.

All awards flow through a single service method: **`RewardsService.awardXP()`**.

---

## Data model

### `user_rewards` (`UserRewards` entity)

One row per staff user (lazy-created on first XP award). Linked to `User` via Clerk ID.

| Column | Purpose |
|--------|---------|
| `uid` | Primary key |
| `ownerClerkUserId` | FK to `users.clerkUserId` |
| `currentXP` | Running total (same as cumulative awards in practice) |
| `totalXP` | Lifetime XP (used for level calculation) |
| `level` | Numeric level (1–8), derived from `totalXP` |
| `rank` | Tier label (`ROOKIE`, `BRONZE`, `SILVER`, etc.) |
| `xpBreakdown` | JSON map of XP by category (lifetime) |
| `challengeMonth` | Current challenge period (`YYYY-MM`, UTC) |
| `challengeMonthXP` | XP earned in the current challenge month |
| `challengeMonthXpBreakdown` | JSON category breakdown for the current month |
| `monthlyChallengeHistory` | JSON array of closed months (capped at 48 entries) |
| `lastAction` | Updated on each save |

**User link:**

```typescript
// user.entity.ts — OneToOne
@OneToOne(() => UserRewards, (userRewards) => userRewards?.owner)
rewards: UserRewards;

// user-rewards.entity.ts — inverse side
@OneToOne(() => User, user => user?.rewards)
@JoinColumn({ name: 'ownerClerkUserId', referencedColumnName: 'clerkUserId' })
owner: User;
```

### `xp_transaction` (`XPTransaction` entity)

Append-only ledger of every XP award.

| Column | Purpose |
|--------|---------|
| `uid` | Primary key |
| `userRewardsUid` | FK → `user_rewards.uid` (`ON DELETE CASCADE`) |
| `action` | Action code (e.g. `CREATE_TASK`, `COMPLETE_TASK_EARLY`) |
| `xpAmount` | Points awarded |
| `metadata` | JSON: `{ sourceId, sourceType, details }` |
| `timestamp` | When the award occurred |

Index: `IDX_xp_transaction_rewards_timestamp` on `(userRewardsUid, timestamp)` for monthly aggregation.

### Related entities

- **`achievement`** — badges linked to `UserRewards` (separate from per-action XP ledger).
- **`unlocked_item`** — inventory items linked to `UserRewards`.

---

## How XP is created

### Central entry point: `RewardsService.awardXP()`

Location: `src/rewards/rewards.service.ts`

**Input:** `CreateRewardDto` plus organisation context:

```typescript
{
  owner: number | string;           // user uid or Clerk user ID
  ownerClerkUserId?: string;        // preferred when available
  amount: number;
  action: string;                   // e.g. 'CREATE_TASK', 'COMPLETE_TASK'
  source?: {
    id: string;                     // source record id
    type: string;                   // e.g. 'task', 'lead', 'attendance'
    details?: string;
  };
}
```

**Required context:** `orgId` (Clerk organisation ID). Optional: `branchId`.

**Flow (single DB transaction):**

1. Resolve the user by `ownerClerkUserId` or `owner` (uid / Clerk ID) scoped to `organisationRef = orgId`.
2. Skip silently if user not found or missing `clerkUserId`.
3. Find or **create** `UserRewards` for `ownerClerkUserId`.
4. Roll challenge month forward if the calendar month changed (`rollChallengeMonthIfNeeded`).
5. Insert an **`xp_transaction`** row.
6. Update aggregates on `UserRewards`:
   - Increment `currentXP`, `totalXP`, `challengeMonthXP`.
   - Increment category in `xpBreakdown` and `challengeMonthXpBreakdown`.
7. Recalculate **level** and **rank** from `totalXP` if level increased.
8. Save `UserRewards`.

### XP amount constants

Defined in `src/lib/constants/constants.ts` as `XP_VALUES`:

| Action | Points |
|--------|--------|
| Daily login | 25 |
| Complete profile | 50 |
| Create task | 5 |
| Complete task | 15 |
| Complete task early | 20 |
| Create subtask | 2 |
| Create lead | 10 |
| Convert lead | 30 |
| Complete sale | 50 |
| Create journal | 10 |
| Comment on task | 2 |
| Help colleague | 15 |
| Check-in / check-out (attendance) | 5 each |
| Check-in / check-out (client visit) | 8 each |
| Claim | 10 |
| Journal (generic) | 8 |
| Lead | 10 |
| Notification | 2 |
| Task | 8 |

Source-type labels for breakdowns use `XP_VALUES_TYPES` (e.g. `'lead'`, `'check-in-client'`, `'attendance'`).

### Where awards are triggered

| Trigger | Mechanism | Module |
|---------|-----------|--------|
| Create task | Event `task.created` → `RewardsSubscriber` | `tasks.service.ts` emits; `rewards.subscriber.ts` handles |
| Complete task | Event `task.completed` → `RewardsSubscriber` | Listener exists; **no emitter found in codebase** |
| Create lead | Event `lead.created` → `RewardsSubscriber` | Listener exists; **leads also call `awardXP` directly** |
| Create lead | Direct `awardXP` | `leads.service.ts` |
| Convert lead | Direct `awardXP` (3× lead XP) | `leads.service.ts` |
| Attendance check-in/out | Direct `awardXP` | `attendance.service.ts` |
| Client check-in/out | Direct `awardXP` | `check-ins.service.ts` |
| Create/update journal | Direct `awardXP` | `journal.service.ts` |
| Create claim | Direct `awardXP` | `claims.service.ts` |
| Manual / admin award | HTTP `POST /rewards/award-xp` | `rewards.controller.ts` |

**Event subscriber** (`src/rewards/rewards.subscriber.ts`):

- `@OnEvent('task.created')` — awards `XP_VALUES.CREATE_TASK` (5 XP).
- `@OnEvent('task.completed')` — awards 15 or 20 XP depending on `completedEarly`.
- `@OnEvent('lead.created')` — awards `XP_VALUES.CREATE_LEAD` (10 XP).

Domain services generally wrap `awardXP` in try/catch so a rewards failure does not roll back the primary business action.

---

## How XP is stored and linked to a user

```
User (users)
  clerkUserId ──────► UserRewards.ownerClerkUserId
                           │
                           ├── currentXP / totalXP / level / rank
                           ├── xpBreakdown (JSON)
                           ├── challengeMonth* fields
                           │
                           └── xpTransactions[] ──► xp_transaction rows
```

- **Link key:** `ownerClerkUserId` ↔ `users.clerkUserId` (not numeric `users.uid` on the FK column).
- **Lookup:** `awardXP` resolves the user within an organisation (`users.organisationRef = orgId`) before writing rewards.
- **Lazy creation:** No `UserRewards` row exists until the user earns XP for the first time; `awardXP` creates one with empty breakdown defaults.

---

## How XP is saved (persistence details)

### Transaction safety

`awardXP` runs inside `DataSource.transaction()`. The ledger row and aggregate update commit together or roll back together.

### Category breakdown (`xp-breakdown.util.ts`)

XP is grouped into canonical keys for reporting and leaderboards:

`tasks`, `subtasks`, `leads`, `sales`, `attendance`, `collaboration`, `login`, `checkInClient`, `checkOutClient`, `claims`, `journals`, `notifications`, `other`

- **`normalizeXpBreakdown()`** merges legacy key names (e.g. `task`, `check-in-client`) into canonical keys.
- **`RewardsService.mapSourceTypeToCategory()`** maps `source.type` and `action` to a canonical key when awarding.
- Unknown keys roll into **`other`**.

### Entity lifecycle hooks

**`UserRewards` entity** (`@BeforeInsert`, `@BeforeUpdate`):

- On insert: initialise `xpBreakdown`, `challengeMonthXpBreakdown`, and `monthlyChallengeHistory` if null.
- On update: refresh `lastAction`; normalise breakdown JSON.

**`UserRewardsOrmSubscriber`** (`user-rewards.orm-subscriber.ts`):

- `afterLoad`: normalise null JSON fields without an extra UPDATE.
- `beforeInsert` / `beforeUpdate`: ensure `monthlyChallengeHistory` is never null.
- Complements entity hooks; keep breakdown logic in sync with `xp-breakdown.util.ts`.

### Monthly challenge rollover

- **`challengeMonth`** tracks the active UTC month (`yyyy-MM`).
- On each award, if the month advanced, the previous month is archived into **`monthlyChallengeHistory`** (max 48 months).
- **`rollStaleChallengeMonthsCron`** (`@Cron('0 3 * * *')`) closes stale months for inactive users who earned no XP.
- Past months can be reconstructed from **`xp_transaction`** if history is missing (`aggregateMonthBreakdownFromTransactions`).

---

## Levels and ranks

From `src/lib/constants/constants.ts`:

**Levels** (`LEVELS`) — `totalXP` ranges:

| Level | XP range |
|-------|----------|
| 1 | 0 – 1,500 |
| 2 | 1,501 – 4,500 |
| 3 | 4,501 – 9,000 |
| 4 | 9,001 – 15,000 |
| 5 | 15,001 – 22,500 |
| 6 | 22,501 – 30,000 |
| 7 | 30,001 – 45,000 |
| 8 | 45,001 – 1,000,000 |

**Ranks** (`RANKS`) — mapped from level:

| Rank | Levels |
|------|--------|
| BRONZE | 1–2 |
| SILVER | 3–4 |
| GOLD | 5–6 |
| PLATINUM | 7–8 |
| DIAMOND | 8+ |

Default on new records: `level = 1`, `rank = 'ROOKIE'` (rank updates when level crosses thresholds).

---

## Reading XP (API)

Key endpoints in `RewardsController` (`/rewards`):

| Endpoint | Purpose |
|----------|---------|
| `POST /rewards/award-xp` | Manually award XP |
| `GET /rewards/user-stats/:reference` | Lifetime + challenge XP, allocations, level, rank |
| `GET /rewards/rankings` | Leaderboard by XP (`scope=alltime` or `monthly`) |

`UserService` also exposes combined profile data (targets + rewards) for mobile clients.

**Query param:** `month=YYYY-MM` scopes challenge XP to a specific calendar month.

---

## Module wiring

`RewardsModule` registers:

- TypeORM entities: `UserRewards`, `XPTransaction`, `Achievement`, `UnlockedItem`, …
- Providers: `RewardsService`, `RewardsSubscriber`, `LoyaltyService`
- Exports: `RewardsService` (injected by attendance, leads, check-ins, claims, journal, user modules)

Requires **`EventEmitterModule`** (global in `AppModule`) for `RewardsSubscriber` event handlers.

---

## Database migration

`1775200000000-UserRewardsMonthlyChallenge` added challenge columns and backfilled `challengeMonthXP` from existing `xp_transaction` rows for the current UTC month.

Run migrations with:

```bash
yarn typeorm:migration:run
```

Keep **`TYPEORM_SYNCHRONIZE=false`** when using a production data dump locally.

---

## Important notes

1. **Organisation context is mandatory** — `awardXP` throws if `orgId` is missing; awards are org-scoped.
2. **Clerk-first identity** — prefer `ownerClerkUserId`; numeric `owner` is resolved to `clerkUserId` before persistence.
3. **XP ≠ loyalty points** — client-facing loyalty uses `LoyaltyService`, separate tables, and tier multipliers.
4. **Idempotency** — each call creates a new `xp_transaction`; callers must avoid duplicate awards if needed.
5. **Breakdown sync** — when changing category keys, update both `xp-breakdown.util.ts` and `RewardsService.mapSourceTypeToCategory()`.
6. **Event gaps** — `task.completed` is handled by `RewardsSubscriber` but may not be emitted everywhere; verify task completion paths if completion XP is missing.

---

## Quick reference — award payload example

```typescript
await rewardsService.awardXP(
  {
    owner: user.uid,                    // or clerkUserId
    amount: XP_VALUES.CREATE_LEAD,
    action: XP_VALUES_TYPES.LEAD,
    source: {
      id: lead.uid.toString(),
      type: XP_VALUES_TYPES.LEAD,
      details: 'Lead created',
    },
  },
  orgClerkId,                           // organisationRef
  branchId,                             // optional
);
```

This creates (or updates) the user's `UserRewards` row, inserts one `xp_transaction`, updates totals and breakdowns, and applies level-up logic in a single transaction.
