import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

/** Circuit states for database connectivity (Strategy B). */
export type DatabaseCircuitState =
    | 'healthy'
    | 'degraded'
    | 'circuit_open'
    | 'half_open';

export interface DatabaseHealthStatus {
    isHealthy: boolean;
    circuitState: DatabaseCircuitState;
    lastHealthCheck: Date;
    consecutiveFailures: number;
    reconnectBurstCount: number;
    nextProbeAt: Date | null;
}

/** Probe interval while the pool is healthy (30 seconds). */
const HEALTHY_PROBE_INTERVAL_MS = 30_000;

/** Probe interval while degraded or half-open (5 minutes). */
const UNHEALTHY_PROBE_INTERVAL_MS = 5 * 60 * 1000;

/** Cooldown before a recovery attempt after the circuit opens (10 minutes). */
const CIRCUIT_OPEN_COOLDOWN_MS = 10 * 60 * 1000;

/** Consecutive probe failures before opening the circuit. */
const FAILURE_THRESHOLD = 3;

/** Max in-process pool resets per cooldown window. */
const MAX_RECOVERY_ATTEMPTS_PER_COOLDOWN = 10;

/** Timeout for destroy/initialize recovery (60 seconds). */
const RECOVERY_TIMEOUT_MS = 60_000;

/** Minimum gap between summary logs while unhealthy (5 minutes). */
const SUMMARY_LOG_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Monitors MySQL pool health via TypeORM and applies a circuit-breaker recovery
 * model. Avoids log spam during outages and performs bounded in-process pool
 * recovery when the mysql2 pool is closed or uninitialized.
 */
@Injectable()
export class DatabaseHealthService implements OnModuleInit {
    private readonly logger = new Logger(DatabaseHealthService.name);

    private isHealthy = true;
    private circuitState: DatabaseCircuitState = 'healthy';
    private lastHealthCheck = new Date();
    private lastProbeAt: Date | null = null;
    private lastSummaryLogAt: Date | null = null;
    private circuitOpenedAt: Date | null = null;
    private nextProbeAt: Date | null = null;

    private consecutiveFailures = 0;
    private reconnectBurstCount = 0;

    /** Prevents overlapping destroy/initialize recovery attempts. */
    private isRecovering = false;

    /** Whether the last failure was a terminal pool-closed error. */
    private lastFailureWasPoolClosed = false;

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) {}

    async onModuleInit(): Promise<void> {
        this.logger.log('Database health monitoring initialized (circuit breaker mode)');
        await this.performHealthCheck();
    }

    /**
     * Runs on a fixed 30s schedule but gates actual probes by circuit state:
     * healthy → every 30s; degraded/half-open → every 5 min; circuit_open → skip until cooldown.
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async performHealthCheck(): Promise<void> {
        if (!this.shouldPerformProbe()) {
            return;
        }

        this.lastProbeAt = new Date();

        // After cooldown, attempt pool reset before the half-open probe when the pool was closed.
        if (
            this.circuitState === 'half_open' &&
            (this.lastFailureWasPoolClosed || !this.dataSource.isInitialized)
        ) {
            await this.tryRecover(this.lastFailureWasPoolClosed);
            if (this.isHealthy) {
                return;
            }
        }

        try {
            await this.dataSource.query('SELECT 1');
            await this.handleProbeSuccess();
        } catch (error) {
            await this.handleProbeFailure(error as Error);
        }
    }

    /**
     * Decides whether a probe or recovery attempt should run on this cron tick.
     * Transitions circuit_open → half_open when the cooldown expires.
     */
    private shouldPerformProbe(): boolean {
        if (this.isRecovering) {
            return false;
        }

        const now = Date.now();

        if (this.circuitState === 'circuit_open') {
            if (
                this.circuitOpenedAt &&
                now - this.circuitOpenedAt.getTime() < CIRCUIT_OPEN_COOLDOWN_MS
            ) {
                this.logCircuitOpenSummaryIfDue(now);
                return false;
            }

            this.circuitState = 'half_open';
            this.nextProbeAt = new Date(now + UNHEALTHY_PROBE_INTERVAL_MS);
            this.logger.warn(
                'Circuit cooldown elapsed — entering half-open state; attempting pool recovery',
            );
            return true;
        }

        if (!this.lastProbeAt) {
            return true;
        }

        const intervalMs =
            this.circuitState === 'healthy'
                ? HEALTHY_PROBE_INTERVAL_MS
                : UNHEALTHY_PROBE_INTERVAL_MS;

        return now - this.lastProbeAt.getTime() >= intervalMs;
    }

    /** Resets circuit state after a successful SELECT 1 probe. */
    private async handleProbeSuccess(): Promise<void> {
        const wasUnhealthy = !this.isHealthy || this.circuitState !== 'healthy';

        this.isHealthy = true;
        this.circuitState = 'healthy';
        this.consecutiveFailures = 0;
        this.reconnectBurstCount = 0;
        this.circuitOpenedAt = null;
        this.lastFailureWasPoolClosed = false;
        this.nextProbeAt = new Date(Date.now() + HEALTHY_PROBE_INTERVAL_MS);
        this.lastHealthCheck = new Date();

        if (wasUnhealthy) {
            this.logger.log(
                'Database connection pool re-established — health probe succeeded',
            );
        }
    }

    /**
     * Handles a failed probe: opens the circuit when thresholds are met and
     * triggers a single-flight recovery when appropriate.
     */
    private async handleProbeFailure(error: Error): Promise<void> {
        this.isHealthy = false;
        this.lastHealthCheck = new Date();
        this.consecutiveFailures++;

        const poolClosed = this.isPoolClosedError(error);
        this.lastFailureWasPoolClosed = poolClosed;

        if (poolClosed) {
            this.logger.error(
                `Connection pool is closed — mysql2 pool cannot serve queries (${error.message})`,
            );
        }

        this.logDegradedSummaryIfDue(error, poolClosed);

        if (this.circuitState === 'half_open') {
            this.logger.warn(
                'Half-open probe failed — reopening circuit for cooldown',
            );
            this.openCircuit(error, poolClosed);
            return;
        }

        const shouldOpenCircuit =
            poolClosed || this.consecutiveFailures >= FAILURE_THRESHOLD;

        if (shouldOpenCircuit) {
            this.openCircuit(error, poolClosed);
            return;
        }

        // Degraded: only reset the pool for terminal pool-closed or uninitialized states.
        if (poolClosed || !this.dataSource.isInitialized) {
            await this.tryRecover(poolClosed);
        }
    }

    /** Opens the circuit: stops aggressive probing and starts cooldown. */
    private openCircuit(error: Error, poolClosed: boolean): void {
        this.circuitState = 'circuit_open';
        this.circuitOpenedAt = new Date();
        this.reconnectBurstCount = 0;

        const nextAttemptAt = new Date(
            Date.now() + CIRCUIT_OPEN_COOLDOWN_MS,
        );
        this.nextProbeAt = nextAttemptAt;

        const reason = poolClosed
            ? 'connection pool is closed'
            : `${this.consecutiveFailures} consecutive probe failures`;

        this.logger.error(
            `Database circuit opened (${reason}). ` +
                `Probes paused until ${nextAttemptAt.toISOString()}. ` +
                `Last error: ${error.message}`,
        );
    }

    /**
     * Attempts to re-open the pool in-process. Uses initialize() when not
     * initialized, or destroy()+initialize() when the pool is closed.
     * Falls back to process.exit(1) so Render can start a fresh pool.
     */
    private async tryRecover(poolClosed: boolean): Promise<void> {
        if (this.isRecovering) {
            return;
        }

        if (this.reconnectBurstCount >= MAX_RECOVERY_ATTEMPTS_PER_COOLDOWN) {
            this.logger.error(
                `Maximum recovery attempts (${MAX_RECOVERY_ATTEMPTS_PER_COOLDOWN}) ` +
                    'exceeded for this cooldown window — exiting for platform restart',
            );
            process.exit(1);
        }

        this.isRecovering = true;
        this.reconnectBurstCount++;

        this.logger.warn(
            `Attempting to re-open database connection pool ` +
                `(recovery ${this.reconnectBurstCount}/${MAX_RECOVERY_ATTEMPTS_PER_COOLDOWN})`,
        );

        try {
            await this.runRecoveryWithTimeout(poolClosed);

            this.logger.log(
                'Database connection pool recovery succeeded — verifying with health probe',
            );

            await this.dataSource.query('SELECT 1');
            await this.handleProbeSuccess();
        } catch (recoveryError) {
            const message =
                recoveryError instanceof Error
                    ? recoveryError.message
                    : String(recoveryError);

            this.logger.error(
                `Database connection pool recovery failed: ${message}`,
            );

            if (
                poolClosed ||
                this.isPoolClosedError(
                    recoveryError instanceof Error
                        ? recoveryError
                        : new Error(message),
                )
            ) {
                this.logger.error(
                    'Pool remains closed after recovery — exiting process for clean restart',
                );
                process.exit(1);
            }
        } finally {
            this.isRecovering = false;
        }
    }

    /**
     * Runs destroy/initialize or initialize only, wrapped in a timeout so
     * recovery cannot hang indefinitely.
     */
    private async runRecoveryWithTimeout(poolClosed: boolean): Promise<void> {
        const recoveryOperation = async (): Promise<void> => {
            if (!this.dataSource.isInitialized) {
                this.logger.log(
                    'DataSource not initialized — calling initialize()',
                );
                await this.dataSource.initialize();
                return;
            }

            if (poolClosed) {
                this.logger.warn(
                    'Connection pool is closed — destroying and re-initializing DataSource',
                );
                await this.dataSource.destroy();
                await this.dataSource.initialize();
                return;
            }

            this.logger.log(
                'Half-open recovery — refreshing DataSource connection pool',
            );
            await this.dataSource.destroy();
            await this.dataSource.initialize();
        };

        await Promise.race([
            recoveryOperation(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            new Error(
                                `Recovery timed out after ${RECOVERY_TIMEOUT_MS}ms`,
                            ),
                        ),
                    RECOVERY_TIMEOUT_MS,
                ),
            ),
        ]);
    }

    /** Detects mysql2 "Pool is closed" and equivalent terminal pool errors. */
    private isPoolClosedError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return (
            message.includes('pool is closed') ||
            message.includes('pool closed') ||
            message.includes('connection pool is closed')
        );
    }

    /** Emits at most one summary log per SUMMARY_LOG_INTERVAL_MS while degraded. */
    private logDegradedSummaryIfDue(
        error: Error,
        poolClosed: boolean,
    ): void {
        const now = Date.now();
        if (
            this.lastSummaryLogAt &&
            now - this.lastSummaryLogAt.getTime() < SUMMARY_LOG_INTERVAL_MS
        ) {
            return;
        }

        this.lastSummaryLogAt = new Date();
        this.logger.warn(
            `Database health probe failed (${this.consecutiveFailures}/${FAILURE_THRESHOLD} ` +
                `toward circuit open, state=${this.circuitState}): ${error.message}` +
                (poolClosed ? ' [pool closed]' : ''),
        );
    }

    /** Emits at most one summary log per interval while the circuit is open. */
    private logCircuitOpenSummaryIfDue(now: number): void {
        if (
            this.lastSummaryLogAt &&
            now - this.lastSummaryLogAt.getTime() < SUMMARY_LOG_INTERVAL_MS
        ) {
            return;
        }

        this.lastSummaryLogAt = new Date();
        const nextAt =
            this.circuitOpenedAt &&
            new Date(
                this.circuitOpenedAt.getTime() + CIRCUIT_OPEN_COOLDOWN_MS,
            ).toISOString();

        this.logger.warn(
            `Database circuit still open — probes paused until ${nextAt ?? 'cooldown elapses'}`,
        );
    }

    /** Returns current health and circuit state for monitoring endpoints. */
    getHealthStatus(): DatabaseHealthStatus {
        return {
            isHealthy: this.isHealthy,
            circuitState: this.circuitState,
            lastHealthCheck: this.lastHealthCheck,
            consecutiveFailures: this.consecutiveFailures,
            reconnectBurstCount: this.reconnectBurstCount,
            nextProbeAt: this.nextProbeAt,
        };
    }

    /** Allows manual health probe (e.g. admin tooling). */
    async forceHealthCheck(): Promise<void> {
        this.lastProbeAt = null;
        await this.performHealthCheck();
    }
}
