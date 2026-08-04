# Cross-Branch Course & Test Visibility

## Problem Statement

Users assigned to the **Denver** branch can view courses and tests, but users in **other branches** within the same organization cannot see the same content.

This is expected under the current architecture: courses and tests are tagged with a specific `branchId` at creation time, and all list/detail queries enforce **strict branch equality** based on the user's JWT scope.

---

## Current Architecture

### Data model

```
Organization
  └── Branch (optional)
        └── User.branchId

Course
  ├── orgId      (required)
  ├── branchId   (nullable — intended for org-wide content, but not honored in queries)
  └── tests[]

Test
  ├── courseId   (required)
  ├── orgId      (copied from course)
  └── branchId   (copied from course at create time)
```

### How scope is assigned

| Action | Branch assignment |
|--------|-------------------|
| Create course | Inherits `orgId` + `branchId` from the **creator's JWT** (`course.service.ts`) |
| Create test | Inherits `orgId` + `branchId` from the **parent course** (`test.service.ts`) |
| Create question | Inherits `branchId` from the course when the test is created |

There is **no admin UI or API field** to choose a different branch or mark content as shared when creating a course.

### How visibility is enforced

Scope comes from the JWT payload (`orgId`, `branchId`) via the `OrgBranchScope` decorator — **not** from client query parameters.

**Course list filter** (`course.service.ts`):

```typescript
if (scope?.branchId) {
    query.andWhere('course.branchId = :branchId', { branchId: scope.branchId });
}
```

**Test list filter** (`test.service.ts`): same pattern.

**Read access** (`validateCourseAccess`): returns 403 if the user's `branchId` does not exactly match the course's `branchId`.

### Important behaviors

| User JWT scope | What they see |
|----------------|---------------|
| Has `branchId` | Only rows where `entity.branchId = user.branchId` |
| Has `orgId` only (no branch) | All courses/tests in the organization |
| Learner (`user` role) | Above rules + `status = active` only |

**Gaps that contribute to the Denver-only visibility:**

1. Courses created by Denver-scoped admins inherit `branchId = Denver`.
2. Queries use strict equality — courses with `branchId IS NULL` (org-wide) are **invisible** to branch-scoped users.
3. `crossBranchAccess: true` is returned at login for owners/admins but is **not applied** to course/test list endpoints.
4. User branch assignments may be incorrect (many org users mapped to Denver per `branch-data.md`).
5. JWT `branchId` is fixed at token issue — branch reassignment requires re-login or token refresh.

### Affected code paths (backend)

| Module | File | Filter pattern |
|--------|------|----------------|
| Courses | `src/course/course.service.ts` | `course.branchId = :branchId` |
| Tests | `src/test/test.service.ts` | `test.branchId = :branchId` |
| Questions | `src/questions/questions.service.ts` | `question.branchId = :branchId` |
| Test attempts | `src/test_attempts/test_attempts.service.ts` | `attempt.branchId = :branchId` |
| Results / answers | `src/results/results.service.ts`, `src/answers/answers.service.ts` | Branch-scoped reporting |

Clients (web + mobile) call `GET /courses` and `GET /tests` with no branch parameter — the backend JWT alone determines visibility.

---

## Solution Options

Below are distinct approaches, ordered from least to most invasive. Each includes trade-offs, affected areas, and a rough effort estimate.

---

### Method 1: Organization-Wide Content via NULL `branchId`

**Concept:** Treat `branchId = NULL` as "visible to all branches in the organization." Update queries so branch-scoped users see their branch content **plus** org-wide content.

**Query change:**

```typescript
if (scope?.branchId) {
    query.andWhere(
        '(course.branchId = :branchId OR course.branchId IS NULL)',
        { branchId: scope.branchId },
    );
}
```

Apply the same pattern in `validateCourseAccess`, test services, and question reads tied to course access.

**Data migration:**

```sql
-- Example: make specific courses org-wide
UPDATE courses SET "branchIdId" = NULL WHERE course_id IN (...);

-- Cascade to tests and questions for those courses
UPDATE tests SET "branchIdId" = NULL WHERE course_id IN (...);
```

**Pros:**

- Uses an existing nullable column — no schema migration required.
- Minimal code change (centralized query updates).
- Clear semantics: NULL = shared across the org.

**Cons:**

- No way to share with **some** branches only (all or one).
- Admins cannot currently set `branchId` to NULL at create time — needs a DTO/UI update.
- Existing Denver-tagged content must be migrated manually or via script.
- Downstream entities (tests, questions) should stay consistent with the course's scope.

**Effort:** Low–Medium (backend query changes + admin create/edit UI + data migration)

**Best for:** Organizations where most training content should be available to every branch.

---

### Method 2: Explicit Visibility Scope Enum

**Concept:** Add an explicit field instead of relying on NULL semantics.

**Schema:**

```typescript
enum CourseVisibilityScope {
    BRANCH = 'branch',           // Single branch (current behavior)
    ORGANIZATION = 'organization', // All branches in org
}

@Column({ default: CourseVisibilityScope.BRANCH })
visibilityScope: CourseVisibilityScope;
```

**Query change:**

```typescript
if (scope?.branchId) {
    query.andWhere(
        '(course.branchId = :branchId OR course.visibilityScope = :orgScope)',
        { branchId: scope.branchId, orgScope: CourseVisibilityScope.ORGANIZATION },
    );
}
```

**Pros:**

- Self-documenting; avoids ambiguous NULL meaning.
- Admins can toggle scope without clearing branch ownership metadata.
- Easier to extend later (e.g. `SELECTED_BRANCHES`).

**Cons:**

- Requires migration to add column and backfill existing rows.
- Slightly more complex than Method 1 for the same immediate outcome.

**Effort:** Medium (migration + entity/DTO + services + admin UI)

**Best for:** Long-term clarity when org-wide vs branch-specific content coexists and admins need an explicit control.

---

### Method 3: Multi-Branch Assignment (Junction Table)

**Concept:** A course can be assigned to one or many branches via a join table.

**Schema:**

```typescript
@Entity('course_branch_assignments')
export class CourseBranchAssignment {
    courseId: number;
    branchId: string; // UUID
}
```

**Query change:**

```typescript
if (scope?.branchId) {
    query
        .leftJoin('course.branchAssignments', 'cba')
        .andWhere(
            '(course.branchId = :branchId OR cba.branchId = :branchId OR course.visibilityScope = :org)',
            { branchId: scope.branchId, org: 'organization' },
        );
}
```

**Pros:**

- Maximum flexibility — share with Denver + Boksburg but not Bethlehem.
- Supports future "branch catalog" admin UX (checkbox list of branches).
- Does not require duplicating course content.

**Cons:**

- Highest implementation complexity (new entity, CRUD, migrations, UI).
- Tests/questions still inherit a primary `branchId`; assignment logic must be consistent.
- Every list query needs a join or subquery.

**Effort:** High

**Best for:** Large orgs with regional training where content varies by location but overlap is common.

---

### Method 4: Wire Up Existing `crossBranchAccess` Permission

**Concept:** The auth layer already exposes `permissions.crossBranchAccess = true` for owners and admins. Apply it to course/test read paths so elevated roles bypass branch filtering.

**Query change:**

```typescript
if (scope?.branchId && !this.hasCrossBranchAccess(scope)) {
    query.andWhere('course.branchId = :branchId', { branchId: scope.branchId });
}
// orgId filter still applies
```

**Pros:**

- Leverages existing permission model.
- No schema or data migration.
- Useful for admins managing content across branches.

**Cons:**

- **Does not help learners** in other branches — only owners/admins see cross-branch content.
- Must decide whether admins should *take* tests on behalf of branches or only *view/manage* them.
- `crossBranchAccess` is in the login response but not consistently available on every JWT — may need to embed it in the token or re-fetch permissions.

**Effort:** Low (backend only, if permission is available in scope)

**Best for:** Solving admin visibility only; must be combined with another method for learner access.

---

### Method 5: Admin-Controlled Branch on Create/Edit

**Concept:** Expose `branchId` and/or `visibilityScope` in `CreateCourseDto` / `UpdateCourseDto` so admins explicitly choose scope when publishing.

**API example:**

```typescript
export class CreateCourseDto {
    title: string;
    description?: string;
    branchId?: string | null;        // null = org-wide
    visibilityScope?: CourseVisibilityScope;
    assignedBranchIds?: string[];    // if using Method 3
}
```

**Validation rules:**

- Branch-scoped admin can only assign their own branch unless they have `crossBranchAccess`.
- Org-wide (`branchId: null`) requires owner/admin role.
- Changing scope on update cascades to child tests/questions (or blocks change if attempts exist).

**Pros:**

- Fixes the root cause of "creator's branch is always inherited."
- Gives admins intentional control going forward.
- Works with Methods 1, 2, or 3.

**Cons:**

- Requires web admin UI updates (mobile is read-only for course creation).
- Must handle cascade updates to tests/questions carefully.

**Effort:** Medium (DTO + validation + admin UI)

**Best for:** Any long-term fix — should accompany Methods 1–3, not replace them.

---

### Method 6: Remove Branch Filtering for Course/Test Reads (Org-Only)

**Concept:** Courses and tests are organization-scoped for **read** operations; branch scoping applies only to results, attempts, and analytics.

**Query change:**

```typescript
// Remove branchId filter from findAll / findOne for courses and tests
if (scope?.orgId) {
    query.andWhere('course.orgId = :orgId', { orgId: scope.orgId });
}
// No branchId filter
```

**Pros:**

- Simplest behavioral change — all org users see all org courses immediately.
- No migration or new tables.

**Cons:**

- **Eliminates branch-level content isolation** entirely for catalog visibility.
- May be incorrect if some courses are genuinely branch-private (HR policies, local compliance).
- Reporting/leaderboard branch filters may feel inconsistent if catalog is org-wide.

**Effort:** Low

**Best for:** Orgs where branch is only a reporting/HR dimension, not a content boundary.

---

### Method 7: Data Correction Only (No Code Change)

**Concept:** Fix user and content branch assignments so each branch has its own copy of data, or users are on the correct branch.

**Actions:**

1. Audit `users.branchId` vs expected location (see `branch-data.md`, CSV scripts in `scripts/`).
2. Reassign users to correct branches.
3. Duplicate or re-tag courses per branch if content should remain branch-specific.

**Pros:**

- No application code changes.
- Preserves strict branch isolation if that is the desired model.

**Cons:**

- **Does not enable cross-branch viewing** — each branch still only sees its own tagged content.
- Duplicating courses creates maintenance burden (updates must be applied N times).
- Does not scale when the business requirement is genuinely shared training.

**Effort:** Medium (operational / data only)

**Best for:** When the real bug is mis-assigned users, not a product requirement for shared content.

---

### Method 8: Enrollment / Assignment Model

**Concept:** Decouple **ownership** (which branch created/manages the course) from **visibility** (which users/branches can access it).

**Schema:**

```typescript
@Entity('course_enrollments')
export class CourseEnrollment {
    courseId: number;
    userId?: string;   // individual assignment
    branchId?: string; // branch-wide assignment
    assignedAt: Date;
    assignedBy: string;
}
```

**Query change:** Learners see courses where they are enrolled directly, their branch is enrolled, or the course is org-wide.

**Pros:**

- Supports mandatory assignments, optional catalog, and branch-wide rollouts.
- Aligns with typical LMS patterns (assign training to groups).
- Branch isolation for analytics/results can remain intact.

**Cons:**

- Largest feature scope — new entity, admin assignment UI, notifications, bulk assign.
- Overkill if the requirement is simply "everyone in the org sees the same catalog."

**Effort:** Very High

**Best for:** Future-state LMS where training is actively assigned rather than passively discovered.

---

## Downstream Considerations

Any method that changes **who can view** a course must also address:

| Area | Consideration |
|------|---------------|
| **Tests** | Inherit or mirror course visibility; update `test.service.ts` filters and access checks. |
| **Questions / options** | Created with course `branchId`; may need sync on scope change. |
| **Test attempts** | Attempts should record the **user's** branch at attempt time for reporting — not the course's branch. |
| **Results / leaderboard** | Typically remain branch-scoped for reporting even if catalog is org-wide. |
| **Training progress** | Verify progress records are keyed by user + course, not branch. |
| **Media / course materials** | `media-manager.service.ts` also filters by `branchId`. |
| **Analytics & reports** | May intentionally stay branch-filtered; document expected behavior. |
| **JWT staleness** | Users reassigned to branches need token refresh to pick up new scope. |

---

## Recommended Approach

For most ProTrain deployments where **training content should be shared across branches** but **reporting stays branch-specific**:

### Phase 1 — Quick win (1–2 sprints)

1. **Method 1** — Update course/test/question read queries to include org-wide content (`branchId IS NULL`).
2. **Method 5** — Allow admins to set `branchId: null` (org-wide) on create/edit.
3. **Data migration** — Set existing shared courses/tests to `branchId = NULL`.
4. **Method 4** — Wire `crossBranchAccess` for admin list views (optional but aligns with existing permissions).

### Phase 2 — If selective sharing is needed

5. **Method 2** — Add explicit `visibilityScope` enum for clarity.
6. **Method 3** — Add `course_branch_assignments` if specific multi-branch sharing is required.

### Phase 3 — Operational hygiene

7. Audit and correct user branch assignments (`branch-data.md`, CSV scripts).
8. Document that users must re-login after branch changes.

### Avoid unless requirements explicitly demand it

- **Method 6** — Only if the business confirms no branch-private content will ever exist.
- **Method 7 alone** — Does not solve cross-branch visibility.
- **Method 8** — Defer unless assignment workflows become a product priority.

---

## Implementation Checklist (Phase 1)

### Backend (`pro-train`)

- [ ] Create shared helper: `applyCourseBranchVisibility(query, scope)` used by course, test, and question services.
- [ ] Update `course.service.ts` — `findAll`, `findOne`, `validateCourseAccess`, dashboard aggregates.
- [ ] Update `test.service.ts` — `findAll`, `findOne`, course access validation.
- [ ] Update `questions.service.ts` — reads tied to learner test access.
- [ ] Update `media-manager.service.ts` — course material visibility.
- [ ] Add `branchId?: string | null` to `CreateCourseDto` / `UpdateCourseDto` with role validation.
- [ ] Add cascade logic: when course scope changes, update child tests/questions (or prevent change if attempts exist).
- [ ] Add integration tests for: branch user sees org-wide course; branch user does not see other branch's course; org-only user sees all.
- [ ] SQL migration script for existing Denver-shared content.

### Web admin (`protrain-client`)

- [ ] Course create/edit form: "Availability" toggle — **This branch only** vs **All branches**.
- [ ] Wire branch filter dropdown in `courses-list.tsx` to API (currently cosmetic).
- [ ] Show visibility badge on course cards.

### Mobile (`protrain-mobile`)

- [ ] No query changes needed (JWT-driven).
- [ ] Verify course list populates for non-Denver users after backend deploy.

### Verification

- [ ] Log in as user in Branch A — confirm org-wide courses appear.
- [ ] Log in as user in Branch B — confirm same org-wide courses appear.
- [ ] Confirm branch-private course in Denver is **not** visible to Branch B users.
- [ ] Confirm test attempts and results still attribute to the user's branch.
- [ ] Confirm admin with `crossBranchAccess` can see all branch courses.

---

## Decision Matrix

| Method | Learner cross-branch access | Admin control | Schema change | Effort | Branch-private content |
|--------|----------------------------|---------------|---------------|--------|------------------------|
| 1 — NULL branchId | Yes (org-wide rows) | Needs UI | No | Low–Med | Yes (keep branchId set) |
| 2 — Visibility enum | Yes | Yes | Yes | Med | Yes |
| 3 — Junction table | Yes (selected branches) | Yes | Yes | High | Yes |
| 4 — crossBranchAccess | No (admins only) | N/A | No | Low | N/A |
| 5 — Admin branch picker | Depends on paired method | Yes | No | Med | Yes |
| 6 — Remove branch filter | Yes (all org content) | N/A | No | Low | No |
| 7 — Data correction only | No | N/A | No | Med | Yes |
| 8 — Enrollment model | Yes (assigned) | Yes | Yes | Very High | Yes |

---

## Open Questions for Stakeholders

1. Should **all** courses be visible to every branch, or only **selected** courses?
2. Are there courses that must remain **branch-private** (e.g. local compliance)?
3. Should **learners** discover courses organically, or should training be **assigned** by admins?
4. When a user completes a test, should results appear on the **user's branch** leaderboard regardless of course origin?
5. Should branch reassignment take effect immediately (live DB lookup) or on next login (current JWT behavior)?

---

## Related Files

| Repository | Path | Purpose |
|------------|------|---------|
| pro-train | `src/course/course.service.ts` | Course list/access filtering |
| pro-train | `src/test/test.service.ts` | Test list/access filtering |
| pro-train | `src/course/entities/course.entity.ts` | Course schema (`branchId` nullable) |
| pro-train | `src/auth/decorators/org-branch-scope.decorator.ts` | JWT scope extraction |
| pro-train | `src/auth/auth.service.ts` | `crossBranchAccess` permission |
| pro-train | `branch-data.md` | User branch assignment audit |
| protrain-client | `components/courses/courses-list.tsx` | Admin course list (branch filter UI) |
| protrain-mobile | `src/services/course-service.ts` | Mobile course API calls |

---

*Document created: August 2026*
