import { ConfigService } from '@nestjs/config';
import {
    TRAINING_HOURS,
    TRAINING_SESSION_TYPES,
} from '../constants/training-hours.constants';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';

/** Returns YYYY-MM for a UTC date. */
export function formatYearMonthUtc(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/** Returns YYYY-MM-DD for a UTC date. */
export function formatActivityDateUtc(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Converts stored minutes to hours with one decimal place. */
export function minutesToDisplayHours(minutes: number): number {
    return Math.round((minutes / TRAINING_HOURS.MINUTES_PER_HOUR) * 10) / 10;
}

/** Computes capped attempt duration in minutes. */
export function computeAttemptDurationMinutes(
    attempt: TestAttempt,
    maxMinutes?: number,
): number {
    const endTime = attempt.submitTime ?? attempt.updatedAt ?? new Date();
    const elapsedMs = Math.max(
        0,
        new Date(endTime).getTime() - new Date(attempt.startTime).getTime(),
    );
    const rawMinutes = Math.round(elapsedMs / 60000);
    const cap =
        maxMinutes ??
        attempt.test?.durationMinutes ??
        TRAINING_HOURS.DEFAULT_MAX_ATTEMPT_MINUTES;
    const cappedMinutes = Math.min(Math.max(rawMinutes, 0), cap);

    if (cappedMinutes < TRAINING_HOURS.MIN_SESSION_MINUTES) {
        return 0;
    }

    return cappedMinutes;
}

/** Reads TRAINING_HOURS_ENABLED env flag (defaults to true). */
export function isTrainingHoursEnabled(
    configService: ConfigService,
): boolean {
    const value = configService.get<string>('TRAINING_HOURS_ENABLED');
    return value === undefined || value === 'true' || value === '1';
}

/** Builds the first day of a UTC month from YYYY-MM. */
export function getMonthStartUtc(yearMonth: string): Date {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
}

/** Builds exclusive end of a UTC month from YYYY-MM. */
export function getMonthEndExclusiveUtc(yearMonth: string): Date {
    const [year, month] = yearMonth.split('-').map(Number);
    return new Date(Date.UTC(year, month, 1));
}

/** Returns session type label for logging. */
export function describeSessionType(
    sessionType: string,
): string {
    return sessionType === TRAINING_SESSION_TYPES.TEST_ATTEMPT
        ? 'test attempt'
        : 'course material';
}
