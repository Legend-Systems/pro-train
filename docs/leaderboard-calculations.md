# Leaderboard & Top Performers Calculations

How ProTrain ranks learners on the Leaderboard, in Top Performers widgets, and
across the reporting and analytics surfaces.

All ranking is computed **server-side**. The web and mobile clients render the
ranks and metrics the API returns and never re-sort or recompute them, so there
is exactly one definition of "who is first" in the product.

---

## 1. The problem this replaced

Rankings used to be built by grouping raw `results` rows per user:

```sql
COUNT(result.resultId)   -- "tests completed"
AVG(result.percentage)   -- "average score"
SUM(result.score)        -- "points"
```

Three things were wrong with that:

| Issue | Effect |
| --- | --- |
| Every attempt counted as a separate test | Three retries of one test showed as "3 tests completed" |
| Retries were averaged together | A learner who scored 90, 90, then 100 on one test averaged 93.33% instead of 100% |
| No denominator | Sitting one easy test and skipping everything else produced a perfect average |

The real-world symptom: a learner with **100% on 1 test** outranked a learner
with **7 of 8 tests completed at 96%**, because the second learner's extra
effort only created more rows to average and more chances to drop below 100%.

There was also no exam-window filter, so learners were ranked on tests that
were still open — being penalised for training they still had time to finish.

---

## 2. Which tests count (eligibility)

Implemented in `src/ranking/services/eligible-test.service.ts`.

A test contributes to rankings only when **all** of these hold:

1. `tests.isActive = 1`
2. `examStartDate` and `examEndDate` are both set — an unscheduled test never
   closes, so it can never form a fair denominator
3. The exam window has **fully closed**: `examEndDate < start of today (UTC)`,
   matching the existing `isExamWindowClosed` helper
4. `examStartDate` is also in the past (a guard against rows saved with the
   dates the wrong way round)
5. The test belongs to the caller's organization

Tests with an **open** or **future** exam window are excluded entirely. They
are neither scored nor counted against anyone.

### Branch scoping

A test only counts toward a learner when it was actually expected of them
(`src/ranking/utils/test-scope.util.ts`):

- Test has a branch → only learners in that branch
- Test has no branch, but its course does → the course's branch applies
- Neither has a branch → org-wide, everyone is expected to sit it

This means two learners in the same org can legitimately have different
`totalEligibleTests` values.

---

## 3. Per-learner metrics

Implemented in `src/ranking/services/learner-ranking.service.ts`.

For each learner, over their eligible test set:

| Metric | Definition |
| --- | --- |
| `totalEligibleTests` | Count of eligible tests expected of this learner |
| `testsCompleted` | Eligible tests with a valid graded result — **one per test**, not per attempt |
| `testsPassed` | Of those, how many were a pass |
| `averageScore` | Mean `percentage` across the counted results (0–100, 2dp) |
| `participationRate` | `testsCompleted / totalEligibleTests` (0–1, 3dp) |
| `totalPoints` | Sum of `score` on the counted results |
| `missedTestIds` | Eligible tests with no counted result |

### One result per test — the latest attempt

When a learner has retried a test, only **one** result counts. The chosen row
is the learner's *latest* attempt:

1. Highest `attempt.attemptNumber`
2. Tie-broken by the later `result.calculatedAt`

This is deliberate: the latest attempt reflects the learner's current
knowledge. It also means retries can neither inflate `testsCompleted` nor drag
`averageScore` down.

### Rows that are ignored

- `result.voidedByResetId IS NOT NULL` — voided by an anti-cheat reset
- `attempt.voidedByResetId IS NOT NULL` — the attempt itself was voided
- Attempts with no result (`in_progress`, `expired`) — these simply never
  appear, which is how a started-but-unfinished test correctly stays counted as
  missed
- Users outside `LEARNER_USER_ROLES`, and users who are not `ACTIVE`

---

## 4. The ranking formula

```
rankingScore = (averageScore × 0.6) + (participationRate × 100 × 0.4)
```

Weights live in one place: `src/ranking/constants/ranking-weights.constant.ts`.

Both terms are on a 0–100 scale, so `rankingScore` is also 0–100.
`participationRate` is scaled by 100 to bring it onto the same scale as
`averageScore`. The result is rounded to 2 decimal places.

A learner with `testsCompleted = 0` scores **0** — they are not hidden from the
full leaderboard, they sort last (see §6).

### Sort order

Descending, with deterministic tiebreaks
(`src/ranking/utils/ranking-comparator.util.ts`):

1. `rankingScore` (desc)
2. `testsCompleted` (desc)
3. `averageScore` (desc)
4. Surname then first name (ascending) — applied by each calling service so
   repeated requests return a stable order

Rank numbering differs by surface, which is existing behaviour and was not
changed:

- **Leaderboard** (`GET /leaderboards`) numbers sequentially — position in the
  sorted list. Because the surname tiebreak makes the order fully
  deterministic, two learners with identical metrics still get distinct,
  stable rank numbers.
- **Report rankings** (`GET /reports/admin/leaderboard-insights`) use
  competition ranking — ties share a rank and the next rank skips, so two
  learners tied at 1st are followed by 3rd.

### Worked example

Eight eligible tests in the organization:

| Learner | Completed | Average | Participation | Ranking score |
| --- | --- | --- | --- | --- |
| Learner A | 2 of 8 | 100.00% | 0.250 | `100 × 0.6 + 25 × 0.4` = **70.00** |
| Learner B | 7 of 8 | 96.07% | 0.875 | `96.07 × 0.6 + 87.5 × 0.4` = **92.64** |

Learner B now ranks above Learner A. Under the old logic Learner A ranked
first.

Scoped to a single month where only two tests closed:

| Learner | Completed | Average | Participation | Ranking score |
| --- | --- | --- | --- | --- |
| Learner A | 1 of 2 | 100.00% | 0.500 | **80.00** |
| Learner B | 2 of 2 | 100.00% | 1.000 | **100.00** |

Learner B ranks above Learner A in the monthly view too — a perfect average on
half the tests cannot beat a perfect average on all of them.

---

## 5. Period filters

Both period modes run the **same** ranking pass. Only the eligible-test set
differs.

| Filter | Eligible test set |
| --- | --- |
| `all-time` | Every test whose exam window has fully closed |
| `month` (e.g. `2026-10`) | Tests whose `examEndDate` falls inside that calendar month |
| Report timeframes (`week` / `month`) | Tests whose `examEndDate` falls inside the rolling window |

### Periods bucket by `examEndDate`, not submission date

This is the key semantic change. A period selects **the exam cycles that
closed in it**, not the dates learners happened to submit.

Why: if a test's window ran 20 Sep – 3 Oct and a learner submitted on 28 Sep,
bucketing by submission date would push them into September while the test
itself belongs to the October cycle. Early submitters would be penalised and
the monthly denominator would not match the monthly numerator.

Consequences worth knowing:

- A month can contain a result submitted in the previous month, if the test's
  window closed in the month being viewed.
- A month **never** contains a test that is still open, by construction.
- `participationRate` in a monthly view is relative to the tests that closed
  that month, so it is directly comparable between learners in that month.

---

## 6. Learners with zero completions

Treated differently by surface, intentionally:

| Surface | Behaviour |
| --- | --- |
| Full leaderboard | Included with `rankingScore = 0`, so they sort last |
| Top Performers (`order=desc`) | Excluded — a top-performer list of non-participants is meaningless |
| Needs Support (`order=asc`) | **Included** — zero participation is exactly the signal a manager needs |
| Admin results dashboard performers | Excluded |
| Course analytics top performers | Excluded |

---

## 7. Where this is used

### Shared engine

| File | Role |
| --- | --- |
| `src/ranking/services/eligible-test.service.ts` | Resolves the eligible test set |
| `src/ranking/services/learner-ranking.service.ts` | Computes per-learner metrics |
| `src/ranking/utils/ranking-score.util.ts` | The formula |
| `src/ranking/utils/ranking-comparator.util.ts` | The sort order |
| `src/ranking/utils/test-scope.util.ts` | Branch expectation rule |
| `src/ranking/constants/ranking-weights.constant.ts` | The weights |

`RankingModule` is standalone so the leaderboard, reports, results, and
analytics modules can all depend on it without importing each other.

### Consumers

| Endpoint / surface | Service |
| --- | --- |
| `GET /leaderboards` | `LeaderboardOverviewService` |
| `GET /leaderboards/course/:courseId` | `LeaderboardOverviewService` |
| `GET /reports/admin/performers` | `AdminInsightsReportsService.getPerformers` |
| `GET /reports/admin/leaderboard-insights` | `AdminInsightsReportsService.getLeaderboardInsights` |
| `GET /reports/leaderboard/top-performers` | `LeaderboardReportsService.getTopPerformers` |
| `GET /results/admin/dashboard` (top performers) | `ResultsService.buildDashboardTopPerformers` |
| `GET /analytics/branches/performers` | `AnalyticsService.getBranchPerformers` |
| `GET /home-insights/carousel` | `HomeInsightsService` (consumes the leaderboard overview) |
| CSV / PDF report exports | `ReportExportService` |

`GET /reports/leaderboard/top-performers` was previously unscoped and queried
the whole `leaderboards` table globally — it is now org- and branch-scoped.

---

## 8. What was deliberately left alone

**Points awarding is unchanged.** `LeaderboardService.updateLeaderboard` /
`updateUserScore` still write the `leaderboards` snapshot table exactly as
before. Only the *reading* of rankings changed.

`totalPoints` shown on the leaderboard is now the sum of `result.score` on the
counted (latest-attempt, eligible) results, for both `all-time` and `month`.
Previously `all-time` summed the `leaderboards` table, which included points
from tests whose windows were still open and double-counted retries.

Branch-level aggregates (`GET /analytics/branches/summary`, branch comparison
charts) are unchanged — they summarise branches, not rank learners.

---

## 9. Client-side notes

### Web (`protrain-client`)

Displays `testsCompleted / totalEligibleTests` plus a participation percentage
wherever a test count was previously shown alone. Fields added to
`LeaderboardOverviewEntry`, `LeaderboardSummary`, `AdminPerformer`,
`AdminRankingEntry`, and `AdminEmployeePerformance`.

### Mobile (`protrain-mobile`)

Same display treatment. One piece of client-side ranking logic existed and was
fixed: `buildLowestScoreUsersChart` in
`src/utils/workforce-results-analytics.ts` averaged every raw result row per
user. It now reduces to the latest attempt per test first, via
`src/utils/latest-attempt-results.ts`, matching the server rule.

The branch performers chart plots `rankingScore` rather than `averageScore`, so
the bars match the order the API returned.

---

## 10. Quick reference

```
Eligible test  = isActive
               AND examStartDate IS NOT NULL
               AND examEndDate IS NOT NULL
               AND examStartDate < today (UTC)
               AND examEndDate   < today (UTC)
               AND (period ? examEndDate within period : true)
               AND expected of this learner (branch rule)

testsCompleted     = eligible tests with a non-voided graded result
                     (latest attempt only — one per test)
averageScore       = mean percentage of those counted results
participationRate  = testsCompleted / totalEligibleTests
rankingScore       = averageScore × 0.6 + participationRate × 100 × 0.4

Sort: rankingScore desc, testsCompleted desc, averageScore desc, surname asc
```
