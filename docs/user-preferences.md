# User preferences

This document describes how **staff user preferences** are stored, created, updated, and consumed in LORO-S. Preferences cover UI settings, notification consent, display formats, and attendance behaviour (e.g. auto shift end).

Preferences are **not** the same as:

- **Client loyalty points** (`LoyaltyService` / `client_loyalty_profile`)
- **User profile** data (`user_profile` — physical/HR fields)
- **Employment profile** (`user_employeement_profile`)
- **Performance targets** (`user_target`)

---

## Storage model

### Primary storage: JSON on `users`

There is no separate `user_preferences` table. Preferences live in a **nullable JSON column** on the `users` table (`User` entity).

```typescript
// src/user/entities/user.entity.ts
@Column({ type: 'json', nullable: true, default: { shiftAutoEnd: true } })
preferences: {
  theme?: 'light' | 'dark';
  language?: string;
  notifications?: boolean;
  shiftAutoEnd?: boolean;
  [key: string]: any;
} | null;
```

| Aspect | Detail |
|--------|--------|
| **Table** | `users` |
| **Column** | `preferences` (PostgreSQL `json`) |
| **Nullable** | Yes |
| **DB default** | `{ "shiftAutoEnd": true }` |
| **User link** | Same row as the user (`users.uid`, `users.clerkUserId`) |

Preferences are **embedded on the user record**, not a separate entity with its own primary key.

### Related columns (device / push — not inside JSON)

Push notification delivery uses **separate columns** on `users`:

| Column | Purpose |
|--------|---------|
| `expoPushToken` | Expo push token |
| `deviceId` | Device identifier |
| `platform` | `'ios'` or `'android'` |
| `pushTokenUpdatedAt` | Last token update time |

These are updated via `PATCH /users/:ref` (`UpdateUserDto`) or `UserService.updateDeviceRegistration()`, not via the preferences JSON endpoints.

---

## Preference fields

Defined and validated in `src/user/dto/create-user-preferences.dto.ts`. Updates use `UpdateUserPreferencesDto` (`PartialType` of the create DTO).

| Field | Type / values | Purpose |
|-------|----------------|---------|
| `theme` | `light`, `dark`, `system` | UI theme |
| `language` | `en`, `af`, `zu`, … | Interface language |
| `notifications` | boolean | Push notifications master toggle |
| `emailNotifications` | boolean | Email notifications |
| `smsNotifications` | boolean | SMS notifications |
| `notificationFrequency` | `real_time`, `hourly`, `daily`, `weekly`, `disabled` | Email batching frequency |
| `shiftAutoEnd` | boolean | Auto-close open shifts after org close + delay |
| `dateFormat` | e.g. `DD/MM/YYYY` | Date display format |
| `timeFormat` | e.g. `24h` | Time display format |
| `timezone` | IANA string, e.g. `Africa/Johannesburg` | User timezone |
| `biometricAuth` | boolean | Biometric auth preference |
| `advancedFeatures` | boolean | Show advanced UI features |

### Read-only field (not persisted)

On **GET**, the API adds `shiftAutoEndDelayMinutes` from server config (`SHIFT_AUTO_END_DELAY_MINUTES`, default `60`). This value is **stripped on PATCH** and never written to the database.

---

## Default values

Two code paths define defaults (keep them aligned when changing defaults):

### `UserService.getDefaultPreferences()` (preferences API)

Used by GET (when null), POST, and PATCH merge logic:

```typescript
{
  theme: 'light',
  language: 'en',
  notifications: true,
  shiftAutoEnd: true,
  notificationFrequency: 'real_time',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  emailNotifications: true,
  smsNotifications: false,
  biometricAuth: false,
  advancedFeatures: false,
  timezone: 'Africa/Johannesburg',
}
```

### `ClerkService.getDefaultUserPreferences()` (Clerk user provisioning)

Same shape; applied when a user is **first created from Clerk** sync.

### Database column default

If a user is created without an explicit preferences object (e.g. admin `POST /users`), PostgreSQL applies only:

```json
{ "shiftAutoEnd": true }
```

Full defaults are applied when the user hits `POST /users/:ref/preferences` or when Clerk provisions the account.

---

## How preferences are created

### 1. Clerk first login / sync

When `ClerkService` creates a new `users` row, it sets `preferences: getDefaultUserPreferences()` — a **complete** default object persisted on insert.

**Location:** `src/clerk/clerk.service.ts`

### 2. Admin user creation

`UserService.create()` does not set `preferences` in code. The row relies on the **DB default** `{ shiftAutoEnd: true }` until preferences are explicitly created or updated.

**Location:** `src/user/user.service.ts`

### 3. Preferences API — initial create

```http
POST /users/:ref/preferences
```

- Body: `CreateUserPreferencesDto` (all fields optional)
- Service merges: `{ ...getDefaultPreferences(), ...dto }`
- Saves to `users.preferences`
- Invalidates user cache
- Does **not** emit `user.preferences.updated` or send preference-change email

### 4. Lazy defaults on read (not persisted)

```http
GET /users/:ref/preferences
```

If `preferences` is `null`, the response returns `getDefaultPreferences()` **in memory only**. Nothing is written until POST or PATCH.

---

## How preferences are saved (updates)

### Dedicated update endpoint (preferred)

```http
PATCH /users/:ref/preferences
```

**Flow** (`UserService.updateUserPreferences`):

1. Resolve user by `:ref` (numeric `uid` or Clerk ID `user_…`), scoped to org/branch unless elevated.
2. Load current preferences or defaults.
3. Strip read-only `shiftAutoEndDelayMinutes` from the DTO.
4. Merge: `{ ...currentPreferences, ...dto }`.
5. `userRepository.update(..., { preferences: updatedPreferences })`.
6. Invalidate user cache.
7. Emit `user.preferences.updated` event.
8. Send `USER_PREFERENCES_UPDATED` email.

### General user update

`PATCH /users/:ref` (`UpdateUserDto`) does **not** expose a `preferences` field. Use the preferences endpoints for JSON settings. Device fields (`expoPushToken`, etc.) can still be updated via general user PATCH.

### Bulk / maintenance scripts

- `yarn set-shift-auto-end` / `src/scripts/set-shift-auto-end-all-users.ts` — mass-sets `preferences.shiftAutoEnd = true` via SQL for users missing it.
- `scripts/set-shift-auto-end-preferences.sql` — SQL variant referenced from `package.json`.

---

## API reference

| Method | Route | Roles (summary) | Description |
|--------|-------|-----------------|-------------|
| GET | `/users/:ref/preferences` | Admin, Manager, Owner, User, Member, … | Read preferences + `shiftAutoEndDelayMinutes` |
| POST | `/users/:ref/preferences` | Admin, Manager, Owner, User, Member | Create / replace with defaults merge |
| PATCH | `/users/:ref/preferences` | Admin, Manager, Owner, User, Member | Partial update |

`:ref` may be numeric user `uid` or Clerk user ID for **lookup**. See [Implementation note](#implementation-note-clerk-id-on-save) for save behaviour.

### Access control

Controller uses `getAccessScope(req.user)`:

- **Elevated** (admin, owner, manager, developer, support): org-wide access (`branchId = null`).
- **Others**: restricted to same organisation and branch.

---

## Entity lifecycle helpers

### `User` entity hooks

No TypeORM hooks on `preferences` specifically; defaults are applied in service layer.

### `UserRewardsOrmSubscriber`

Unrelated to user UI preferences — handles rewards XP breakdown JSON only.

---

## How stored preferences are consumed

Other modules read `user.preferences` at runtime:

| Module | Preference keys used | Behaviour |
|--------|---------------------|-----------|
| `UnifiedNotificationService` | `notifications`, `emailNotifications` | Skip push/email when explicitly `false` |
| `AttendanceService` | `shiftAutoEnd` | Skip scheduled auto-close when `false` |
| `UserService.filterEmailsByEmailNotificationPreference()` | `emailNotifications` | Filter recipient lists |
| Email digest / task reminders / leads reminders | `emailNotifications` | Respect email opt-out |
| `email-digest-flush.service` | `emailNotifications` | Skip digest when disabled |

**Convention:** `undefined` or missing key = **opt-in** (allowed). Only explicit `false` disables the channel.

---

## Data flow diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        users table                               │
├─────────────────────────────────────────────────────────────────┤
│ uid, clerkUserId, email, …                                      │
│ preferences (json)  ←── theme, notifications, shiftAutoEnd, …   │
│ expoPushToken, deviceId, platform  ←── separate from JSON       │
└─────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
   Clerk sync          POST/PATCH              GET (defaults
   (full defaults)    /users/:ref/preferences  if null)
         │                    │
         └────────────────────┴──► Notifications, Attendance, Email
```

---

## Implementation note: Clerk ID on save

`getUserPreferences`, `createUserPreferences`, and `updateUserPreferences` **find** users correctly by Clerk ID or numeric uid.

However, **save** uses:

```typescript
await this.userRepository.update(userId, { preferences: ... });
```

where `userId` is the URL `:ref`. TypeORM treats this as the **primary key** (`users.uid`). If `:ref` is a Clerk ID string (e.g. `user_2abc…`), the update may affect **zero rows** and throw. **Numeric uid refs are reliable for POST/PATCH.** Consider resolving to `user.uid` after lookup if Clerk ID support on write is required.

---

## Key source files

| File | Role |
|------|------|
| `src/user/entities/user.entity.ts` | `preferences` JSON column definition |
| `src/user/dto/create-user-preferences.dto.ts` | Validated preference shape |
| `src/user/dto/update-user-preferences.dto.ts` | Partial update DTO |
| `src/user/user.service.ts` | `getUserPreferences`, `createUserPreferences`, `updateUserPreferences`, `getDefaultPreferences` |
| `src/user/user.controller.ts` | REST routes under `/users/:ref/preferences` |
| `src/clerk/clerk.service.ts` | Default preferences on Clerk user creation |
| `src/lib/enums/user.enums.ts` | `Theme`, `Language`, `NotificationFrequency`, `DateFormat`, `TimeFormat` |
| `src/lib/services/unified-notification.service.ts` | Notification gating |
| `src/attendance/attendance.service.ts` | `shiftAutoEnd` for auto-close |

---

## Related documentation

- Attendance auto-close and `shiftAutoEnd`: see attendance controller/service and env `SHIFT_AUTO_END_DELAY_MINUTES`.
- Push tokens: updated via `PATCH /users/:ref` device fields, not preferences JSON.
