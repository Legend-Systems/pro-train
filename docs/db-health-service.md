# Database health service: failure patterns and simplification guide

This document explains what went wrong on Render (`DatabaseHealthService`), why logs showed **attempt 145/10**, and concrete ways to simplify reconnection logic so it **does not spam logs** yet can still **recover** when MySQL (`mysql2` pool via TypeORM) is usable again.

Related code today: [`src/common/services/database-health.service.ts`](../src/common/services/database-health.service.ts)

---

## 1. Symptoms from Render logs

### 1.1 **`Pool is closed`**

mysql2 rejects work when the underlying pool has been ended. Queries such as `dataSource.query('SELECT 1')` then fail immediately with **`Error: Pool is closed`**.

Typical contexts:

- `DataSource` / driver pool was **`destroy()`-ed** and not fully recreated.
- A severe network/DB outage left connections in an invalid terminal state.

### 1.2 **`attempt N/10` with N ≫ 10**

The service defines `maxReconnectAttempts = 10`, but cron runs **`performHealthCheck` every 30 seconds** (`@Cron(CronExpression.EVERY_30_SECONDS)`).

On **every failing** cron run:

1. `handleConnectionFailure` runs and does **`reconnectAttempts++`**.
2. Once `reconnectAttempts > maxReconnectAttempts`, the code **only logs** “Maximum exceeded” and **does not reset** `reconnectAttempts`.

So counters like **attempt 145/10** mean: “the cron has failed health checks ~145 times” — **not** “we have 145 controlled reconnect tries inside one recovery session.”  
The **circuit breaker semantics are broken**: after “giving up,” the cron **keeps increasing the counter forever**, producing noisy, misleading logs.

### 1.3 **Overlapping PIDs (`[Nest] 82` vs `[Nest] 83` vs `[Nest] 70`)**

During **`==> Deploying...`**, Render runs **multiple Node processes briefly** (old + new). Logs interleave rows from:

- PID **82** — old instance still emitting `DatabaseHealthService` cron errors.
- PID **83** / **70** — new bootstrap: TypeORM **`Unable to connect to the database. Retrying`**, then **`connect ETIMEDOUT`**, **`read ECONNRESET`**, **`Exited with status 1`** (failed boot).

This is confusing but expected during rolling deploy **if DB is unreachable** or **listening very slowly**.

### 1.4 **Underlying connectivity (not credentials)**

Logs also showed:

- **`Error: connect ETIMEDOUT`**
- **`Error: read ECONNRESET`**
- **`TypeOrmModule` Unable to connect … Retrying (N) …**

Those are **network / reachability / TLS / firewall / DB sleep**, not necessarily wrong username/password. Correct env values can still yield timeouts if nothing answers on the TCP path.

### 1.5 **Invalid mysql2 `extra` options (warnings)**

Render printed:

```text
Ignoring invalid configuration option passed to Connection: acquireTimeout
Ignoring invalid configuration option passed to Connection: timeout
Ignoring invalid configuration option passed to Connection: reconnect
Ignoring invalid configuration option passed to Connection: maxReconnects
Ignoring invalid configuration option passed to Connection: handleDisconnects
```

These come from **`app.module.ts` → TypeORM → `extra`**. They are either **unsupported** by the mysql2 Connection layer as passed, or need to live under **`pool`/driver-specific shapes**. They do **not** fix connectivity by themselves but add noise and may mask real pool tuning mistakes.

See: [`src/app.module.ts`](../src/app.module.ts) (`TypeOrmModule.forRootAsync`, `extra` block).

---

## 2. Design problems in the current health service

| Issue | Effect |
|--------|--------|
| Cron + **`setTimeout(..., performHealthCheck)`** inside `handleConnectionFailure` | Can stack/overlap retries with scheduled cron ticks. |
| **`destroy()` then `initialize()`** on singleton `DataSource` | Fragile with mysql2: easy to reach **_pool closed** if `initialize` fails or races. TypeORM startup already retries; second destroy/re-init from cron fights that. |
| **`reconnectAttempts` never resets** after “give up” | Infinite **attempt N/10** logs; meaningless ratio. |
| Health check **`SELECT 1`** on closed pool every 30s | Hammering useless work and log volume while unhealthy. |

---

## 3. Goals for a simplified design

1. **Quiet degraded mode**: After repeated failure, **one summary log per interval** (e.g. 5–15 minutes), not every 30 seconds.
2. **Clear states**: **`healthy`** | **`degraded`** | **`circuit_open`** (no pretend “max retries” unless you truly stop trying).
3. **Single-flight recovery**: Only **one** reconnection routine at a time (mutex/`isRecovering` flag).
4. **Honest recovery model**: Decide explicitly:
   - Either **recover in-process** only when **`destroy()` + `initialize()`` is believed safe, **or**
   - **Fail fast**: `process.exit(1)` so the platform (**Render**) restarts a fresh process — often the **most reliable** fix for `"Pool is closed"` after catastrophe.

---

## 4. Recommended approaches (pick one primary strategy)

### Strategy A — **Passive monitor only** (minimal, least risky)

**Idea**: Do **not** call `destroy()` / `initialize()` from cron at all.

- Cron (or slower interval, e.g. **every 2–5 minutes**): **`SELECT 1`** only.
- If it fails: set `isHealthy = false`, log **once per backoff window** with error **message + code** (ETIMEDOUT vs Pool closed).
- Rely on:
  - **TypeORM/mysql2** for normal reconnect behavior where supported, **and/or**
  - **Orchestrator restart** (Render autorestart on crash / deploy) after unrecoverable pool death.

**When to choose**: You want predictable logs and to avoid killing the DI-managed `DataSource` from cron.

---

### Strategy B — **Circuit breaker + bounded retry** (controlled in-process recovery)

Implement explicit machine:

1. **Closed (healthy)** — `SELECT 1` succeeds → reset counters.
2. **Open (no DB)** — after **K** failures **or** `Pool is closed`:
   - Enter **`circuit_open`** for a **cooldown** (e.g. 5–15 minutes).
   - During cooldown: **skip** `performHealthCheck` body (early return), or run at **most one** log line: “still open, next probe at …”.
   - Optionally allow **one** `tryRecover()` at cooldown expiry (mutex-guarded).
3. **Half-open** — single probe; success → closed; failure → open again.

**Recover implementation** (if you insist on process-level pool reset):

- Set **`isRecovering = true`**
- Prefer **only when** `!dataSource.isInitialized` → `initialize()`.
- If pool is **`Pool is closed`** while `isInitialized === true`: either:
  - **document** “requires process restart”, **or**
  - call `destroy()` then `initialize()` **once**, with **timeout** + catch; on failure **`process.exit(1)`** so Render replaces the instance.

**Counter fix**: Maintain separate counters:

- `consecutiveHealthFailuresThisSession`
- **`reconnectBurstCount`** capped per cooldown (≤ 10), reset when circuit closes — **never** increment unbounded forever from cron.

---

### Strategy C — **`process.exit(1)` after terminal DB failure**

**Idea**: If health check detects **`Pool is closed`** **or** N consecutive timeouts, **log once** and terminate.

- Render restarts the web service (**new pool**, clean state).
- Often **fixes** zombies better than looping `initialize()`.

Tradeoff: Brief downtime / failed health checks hitting clients during restart.

---

## 5. Operational checklist (infra, parallel to code)

Even perfect health code cannot fix **`ETIMEDOUT`** if the TCP path or DB tier is wrong.

1. **Private vs public hostname** — some providers give an **internal** URL only reachable from another service in same VPC; Render web must use the **internet-reachable** host if DB is external.
2. **TLS** — Many managed MySQLs require SSL; align `extra.ssl` / URL params with provider docs (see commented block in `app.module.ts`).
3. **Firewall / allowlist** — Allow **Render outbound IPs** or “anywhere” per provider policy.
4. **Region / latency** — Cross-region DB increases timeouts; align region or raise `connectTimeout` **only** after confirming valid options in mysql2 docs.
5. **Clean up `extra`** — Remove or relocate invalid options to stop warnings and use **supported** pool settings only.

---

## 6. Suggested implementation checklist (for `database-health.service.ts`)

- [ ] Remove or gate **`setTimeout(... performHealthCheck ...)`** so it does not stack with cron.
- [ ] After exceeding max recovery attempts, **stop incrementing** a global counter every tick; use **cooldown** + **single log per window**.
- [ ] Add **`isRecovering`** mutex; skip overlapping recoveries.
- [ ] Reset **`reconnectAttempts`** (or replace with circuit state) when entering **healthy** or when **cooldown** elapses.
- [ ] Map errors: **`Pool is closed`** → treat as **terminal for in-process pool** unless you have a proven `destroy`/`init` path; consider **exit(1)**.
- [ ] Slow cron when unhealthy (e.g. 5 min) instead of 30s spam.
- [ ] Optional: expose **`getHealthStatus()`** to a **`/health`** controller returning **503** when circuit open (for load balancers).

---

## 7. Summary

- **`Pool is closed`** + **unbounded `attempt N/10`** are symptoms of **pool lifecycle + broken counter semantics + aggressive cron**, compounded on Render by **deploy overlap** and real **`ETIMEDOUT`/`ECONNRESET`** to MySQL.
- **Simplifying** means: **circuit breaker**, **single-flight recovery**, **honest logging**, and/or **delegate recovery to process restart** — not an endless 30-second loop that pretends a “max of 10” attempts.

After changing behavior, validate with: kill DB briefly, restore DB, confirm logs stay quiet in open state and recovery happens once when appropriate.
