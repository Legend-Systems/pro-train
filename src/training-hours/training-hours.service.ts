import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TrainingSession } from './entities/training-session.entity';
import { UserTrainingHoursMonthly } from './entities/user-training-hours-monthly.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { AttemptStatus } from '../test_attempts/entities/test_attempt.entity';
import { User } from '../user/entities/user.entity';
import {
    TRAINING_HOURS,
    TRAINING_SESSION_TYPES,
} from './constants/training-hours.constants';
import {
    AdminOrgTrainingHoursSummaryDto,
    AdminTrainingHoursTrendDto,
    AdminUserTrainingHoursRankingDto,
    MonthlyTrainingHoursDto,
    TrainingHoursSignInSummaryDto,
    UserTrainingHoursSummaryDto,
} from './dto/training-hours.dto';
import {
    computeAttemptDurationMinutes,
    formatActivityDateUtc,
    formatYearMonthUtc,
    getMonthEndExclusiveUtc,
    getMonthStartUtc,
    isTrainingHoursEnabled,
    minutesToDisplayHours,
} from './utils/training-hours.util';

/** Core service for recording and querying training hours. */
@Injectable()
export class TrainingHoursService {
    private readonly logger = new Logger(TrainingHoursService.name);

    constructor(
        @InjectRepository(TrainingSession)
        private readonly sessionRepository: Repository<TrainingSession>,
        @InjectRepository(UserTrainingHoursMonthly)
        private readonly monthlyRepository: Repository<UserTrainingHoursMonthly>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly configService: ConfigService,
    ) {}

    /** Records a test attempt session after scoring (idempotent per attempt). */
    async recordTestAttemptSession(attempt: TestAttempt): Promise<void> {
        if (!isTrainingHoursEnabled(this.configService)) {
            this.logger.debug(
                `Training hours disabled — skipping attempt ${attempt.attemptId}`,
            );
            return;
        }

        const orgId =
            typeof attempt.orgId === 'object'
                ? attempt.orgId?.id
                : (attempt.orgId as unknown as string | undefined);
        if (!orgId) {
            this.logger.warn(
                `Training hours recording skipped — attempt ${attempt.attemptId} missing orgId`,
            );
            return;
        }

        const branchId =
            attempt.branchId && typeof attempt.branchId === 'object'
                ? attempt.branchId.id
                : undefined;

        const durationMinutes = computeAttemptDurationMinutes(attempt);
        if (durationMinutes === 0) {
            this.logger.debug(
                `Training hours below minimum for attempt ${attempt.attemptId}`,
            );
            return;
        }

        const endTime = attempt.submitTime ?? attempt.updatedAt ?? new Date();
        const sourceId = String(attempt.attemptId);
        const courseId = attempt.test?.courseId;

        try {
            const existing = await this.sessionRepository.findOne({
                where: {
                    sessionType: TRAINING_SESSION_TYPES.TEST_ATTEMPT,
                    sourceId,
                },
            });

            const sessionData: Partial<TrainingSession> = {
                userId: attempt.userId,
                orgId: { id: orgId } as TrainingSession['orgId'],
                branchId: branchId
                    ? ({ id: branchId } as TrainingSession['branchId'])
                    : undefined,
                sessionType: TRAINING_SESSION_TYPES.TEST_ATTEMPT,
                sourceId,
                courseId,
                startedAt: attempt.startTime,
                endedAt: endTime,
                durationMinutes,
                activityDate: formatActivityDateUtc(endTime),
                metadata: {
                    attemptNumber: attempt.attemptNumber,
                    testId: attempt.testId,
                },
            };

            if (existing) {
                Object.assign(existing, {
                    userId: sessionData.userId,
                    orgId: sessionData.orgId,
                    branchId: sessionData.branchId,
                    courseId: sessionData.courseId,
                    startedAt: sessionData.startedAt,
                    endedAt: sessionData.endedAt,
                    durationMinutes: sessionData.durationMinutes,
                    activityDate: sessionData.activityDate,
                    metadata: sessionData.metadata,
                });
                await this.sessionRepository.save(existing);
                this.logger.log(
                    `Training hours updated for attempt ${attempt.attemptId}: ${durationMinutes} min`,
                );
            } else {
                await this.sessionRepository.save(
                    this.sessionRepository.create(sessionData),
                );
                this.logger.log(
                    `Training hours recorded for attempt ${attempt.attemptId}: ${durationMinutes} min`,
                );
            }

            await this.rebuildMonthlyRollup(
                attempt.userId,
                orgId,
                formatYearMonthUtc(endTime),
                branchId,
            );
        } catch (error) {
            this.logger.error(
                `Training hours recording failed for attempt ${attempt.attemptId}`,
                error instanceof Error ? error.stack : String(error),
            );
            throw error;
        }
    }

    /** Returns headline training hours summary for a user. */
    async getUserSummary(
        userId: string,
        orgId: string,
        branchId?: string,
    ): Promise<UserTrainingHoursSummaryDto> {
        const query = this.sessionRepository
            .createQueryBuilder('session')
            .where('session.userId = :userId', { userId })
            .andWhere('session.orgId = :orgId', { orgId });

        if (branchId) {
            query.andWhere('session.branchId = :branchId', { branchId });
        }

        const totalRow = await query
            .clone()
            .select('COALESCE(SUM(session.durationMinutes), 0)', 'totalMinutes')
            .addSelect('COUNT(session.id)', 'sessionCount')
            .addSelect('MAX(session.endedAt)', 'lastActivityAt')
            .getRawOne<{
                totalMinutes: string;
                sessionCount: string;
                lastActivityAt: Date | null;
            }>();

        const now = new Date();
        const currentYearMonth = formatYearMonthUtc(now);
        const monthStart = getMonthStartUtc(currentYearMonth);
        const monthEnd = getMonthEndExclusiveUtc(currentYearMonth);

        const monthRow = await query
            .clone()
            .andWhere('session.activityDate >= :monthStart', {
                monthStart: formatActivityDateUtc(monthStart),
            })
            .andWhere('session.activityDate < :monthEnd', {
                monthEnd: formatActivityDateUtc(monthEnd),
            })
            .select(
                'COALESCE(SUM(session.durationMinutes), 0)',
                'monthMinutes',
            )
            .getRawOne<{ monthMinutes: string }>();

        const weekStart = new Date(now);
        weekStart.setUTCDate(weekStart.getUTCDate() - 7);

        const weekRow = await query
            .clone()
            .andWhere('session.endedAt >= :weekStart', { weekStart })
            .select(
                'COALESCE(SUM(session.durationMinutes), 0)',
                'weekMinutes',
            )
            .getRawOne<{ weekMinutes: string }>();

        const totalMinutes = Number(totalRow?.totalMinutes) || 0;
        const currentMonthMinutes = Number(monthRow?.monthMinutes) || 0;
        const weeklyMinutes = Number(weekRow?.weekMinutes) || 0;

        return {
            totalMinutes,
            totalHours: minutesToDisplayHours(totalMinutes),
            currentMonthMinutes,
            currentMonthHours: minutesToDisplayHours(currentMonthMinutes),
            weeklyMinutes,
            weeklyHours: minutesToDisplayHours(weeklyMinutes),
            sessionCount: Number(totalRow?.sessionCount) || 0,
            lastActivityAt: totalRow?.lastActivityAt
                ? new Date(totalRow.lastActivityAt).toISOString()
                : undefined,
        };
    }

    /** Sign-in fragment for auth payload. */
    async getSignInSummary(
        userId: string,
        orgId: string,
        branchId?: string,
    ): Promise<TrainingHoursSignInSummaryDto> {
        const summary = await this.getUserSummary(userId, orgId, branchId);
        return {
            totalHours: summary.totalHours,
            currentMonthHours: summary.currentMonthHours,
            weeklyHours: summary.weeklyHours,
        };
    }

    /** Monthly breakdown for a user within a date range. */
    async getMonthlyBreakdown(
        userId: string,
        orgId: string,
        fromYearMonth: string,
        toYearMonth: string,
        branchId?: string,
    ): Promise<MonthlyTrainingHoursDto[]> {
        const fromDate = formatActivityDateUtc(
            getMonthStartUtc(fromYearMonth),
        );
        const toDate = formatActivityDateUtc(
            getMonthEndExclusiveUtc(toYearMonth),
        );

        const query = this.sessionRepository
            .createQueryBuilder('session')
            .select(
                "DATE_FORMAT(session.activityDate, '%Y-%m')",
                'yearMonth',
            )
            .addSelect('SUM(session.durationMinutes)', 'totalMinutes')
            .addSelect('COUNT(session.id)', 'sessionCount')
            .where('session.userId = :userId', { userId })
            .andWhere('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate >= :fromDate', { fromDate })
            .andWhere('session.activityDate < :toDate', { toDate })
            .groupBy('yearMonth')
            .orderBy('yearMonth', 'ASC');

        if (branchId) {
            query.andWhere('session.branchId = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            yearMonth: string;
            totalMinutes: string;
            sessionCount: string;
        }>();

        return rows.map(row => {
            const totalMinutes = Number(row.totalMinutes) || 0;
            return {
                yearMonth: row.yearMonth,
                totalMinutes,
                totalHours: minutesToDisplayHours(totalMinutes),
                sessionCount: Number(row.sessionCount) || 0,
            };
        });
    }

    /** Org-wide monthly trends for admin charts. */
    async getOrgMonthlyTrends(
        orgId: string,
        months: number,
        branchId?: string,
    ): Promise<AdminTrainingHoursTrendDto[]> {
        const endDate = new Date();
        const startDate = new Date(
            Date.UTC(
                endDate.getUTCFullYear(),
                endDate.getUTCMonth() - (months - 1),
                1,
            ),
        );

        const query = this.sessionRepository
            .createQueryBuilder('session')
            .select(
                "DATE_FORMAT(session.activityDate, '%Y-%m')",
                'yearMonth',
            )
            .addSelect('SUM(session.durationMinutes)', 'totalMinutes')
            .addSelect('COUNT(DISTINCT session.userId)', 'activeLearners')
            .where('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate >= :startDate', {
                startDate: formatActivityDateUtc(startDate),
            })
            .groupBy('yearMonth')
            .orderBy('yearMonth', 'ASC');

        if (branchId) {
            query.andWhere('session.branchId = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            yearMonth: string;
            totalMinutes: string;
            activeLearners: string;
        }>();

        return rows.map(row => {
            const totalMinutes = Number(row.totalMinutes) || 0;
            const activeLearners = Number(row.activeLearners) || 0;
            const totalHours = minutesToDisplayHours(totalMinutes);
            return {
                yearMonth: row.yearMonth,
                totalHours,
                activeLearners,
                averageHoursPerLearner:
                    activeLearners > 0
                        ? Math.round((totalHours / activeLearners) * 10) / 10
                        : 0,
            };
        });
    }

    /** Org summary for a specific month. */
    async getOrgMonthlySummary(
        orgId: string,
        yearMonth: string,
        branchId?: string,
    ): Promise<AdminOrgTrainingHoursSummaryDto> {
        const monthStart = formatActivityDateUtc(getMonthStartUtc(yearMonth));
        const monthEnd = formatActivityDateUtc(
            getMonthEndExclusiveUtc(yearMonth),
        );

        const query = this.sessionRepository
            .createQueryBuilder('session')
            .select('COALESCE(SUM(session.durationMinutes), 0)', 'totalMinutes')
            .addSelect('COUNT(DISTINCT session.userId)', 'activeLearners')
            .where('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate >= :monthStart', { monthStart })
            .andWhere('session.activityDate < :monthEnd', { monthEnd });

        if (branchId) {
            query.andWhere('session.branchId = :branchId', { branchId });
        }

        const row = await query.getRawOne<{
            totalMinutes: string;
            activeLearners: string;
        }>();

        const totalMinutes = Number(row?.totalMinutes) || 0;
        const activeLearners = Number(row?.activeLearners) || 0;
        const totalHours = minutesToDisplayHours(totalMinutes);

        return {
            yearMonth,
            totalMinutes,
            totalHours,
            activeLearners,
            averageHoursPerLearner:
                activeLearners > 0
                    ? Math.round((totalHours / activeLearners) * 10) / 10
                    : 0,
        };
    }

    /** Ranks learners by hours for a month (desc = top, asc = worst). */
    async getOrgUserRankings(
        orgId: string,
        yearMonth: string,
        limit: number,
        branchId?: string,
        order: 'asc' | 'desc' = 'desc',
    ): Promise<AdminUserTrainingHoursRankingDto[]> {
        const monthStart = formatActivityDateUtc(getMonthStartUtc(yearMonth));
        const monthEnd = formatActivityDateUtc(
            getMonthEndExclusiveUtc(yearMonth),
        );

        const query = this.sessionRepository
            .createQueryBuilder('session')
            .innerJoin(User, 'user', 'user.id = session.userId')
            .select('session.userId', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('SUM(session.durationMinutes)', 'totalMinutes')
            .addSelect('COUNT(session.id)', 'sessionCount')
            .where('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate >= :monthStart', { monthStart })
            .andWhere('session.activityDate < :monthEnd', { monthEnd })
            .groupBy('session.userId')
            .addGroupBy('user.firstName')
            .addGroupBy('user.lastName')
            .orderBy('totalMinutes', order === 'asc' ? 'ASC' : 'DESC')
            .limit(limit);

        if (branchId) {
            query.andWhere('session.branchId = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string;
            lastName: string;
            totalMinutes: string;
            sessionCount: string;
        }>();

        return rows.map(row => {
            const totalMinutes = Number(row.totalMinutes) || 0;
            return {
                userId: row.userId,
                firstName: row.firstName,
                lastName: row.lastName,
                totalMinutes,
                totalHours: minutesToDisplayHours(totalMinutes),
                sessionCount: Number(row.sessionCount) || 0,
            };
        });
    }

    /** Sums minutes for a user in a rolling or calendar window (used by XP crons). */
    async sumUserMinutesInRange(
        userId: string,
        orgId: string,
        startDate: Date,
        endDate: Date,
    ): Promise<number> {
        const row = await this.sessionRepository
            .createQueryBuilder('session')
            .select('COALESCE(SUM(session.durationMinutes), 0)', 'total')
            .where('session.userId = :userId', { userId })
            .andWhere('session.orgId = :orgId', { orgId })
            .andWhere('session.endedAt >= :startDate', { startDate })
            .andWhere('session.endedAt < :endDate', { endDate })
            .getRawOne<{ total: string }>();

        return Number(row?.total) || 0;
    }

    /** Sums minutes for a user on a specific UTC activity date. */
    async sumUserMinutesOnDate(
        userId: string,
        orgId: string,
        activityDate: string,
    ): Promise<number> {
        const row = await this.sessionRepository
            .createQueryBuilder('session')
            .select('COALESCE(SUM(session.durationMinutes), 0)', 'total')
            .where('session.userId = :userId', { userId })
            .andWhere('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate = :activityDate', { activityDate })
            .getRawOne<{ total: string }>();

        return Number(row?.total) || 0;
    }

    /** Rebuilds the monthly rollup row from session ledger data. */
    async rebuildMonthlyRollup(
        userId: string,
        orgId: string,
        yearMonth: string,
        branchId?: string,
    ): Promise<void> {
        const monthStart = formatActivityDateUtc(getMonthStartUtc(yearMonth));
        const monthEnd = formatActivityDateUtc(
            getMonthEndExclusiveUtc(yearMonth),
        );

        const row = await this.sessionRepository
            .createQueryBuilder('session')
            .select('COALESCE(SUM(session.durationMinutes), 0)', 'totalMinutes')
            .addSelect('COUNT(session.id)', 'sessionCount')
            .where('session.userId = :userId', { userId })
            .andWhere('session.orgId = :orgId', { orgId })
            .andWhere('session.activityDate >= :monthStart', { monthStart })
            .andWhere('session.activityDate < :monthEnd', { monthEnd })
            .getRawOne<{ totalMinutes: string; sessionCount: string }>();

        const totalMinutes = Number(row?.totalMinutes) || 0;
        const sessionCount = Number(row?.sessionCount) || 0;

        const existing = await this.monthlyRepository.findOne({
            where: { userId, orgId, yearMonth },
        });

        if (existing) {
            await this.monthlyRepository.update(existing.id, {
                totalMinutes,
                sessionCount,
                branchId: branchId ?? existing.branchId,
            });
        } else if (totalMinutes > 0) {
            await this.monthlyRepository.save(
                this.monthlyRepository.create({
                    userId,
                    orgId,
                    branchId,
                    yearMonth,
                    totalMinutes,
                    sessionCount,
                }),
            );
        }
    }

    /** Backfills sessions from historical submitted attempts. */
    async backfillFromAttempts(): Promise<{ syncedCount: number }> {
        const attempts = await this.testAttemptRepository.find({
            where: { status: AttemptStatus.SUBMITTED },
            relations: ['test', 'orgId', 'branchId'],
        });

        let syncedCount = 0;

        for (const attempt of attempts) {
            if (!attempt.submitTime) {
                continue;
            }

            try {
                await this.recordTestAttemptSession(attempt);
                syncedCount += 1;
            } catch (error) {
                this.logger.error(
                    `Backfill failed for attempt ${attempt.attemptId}`,
                    error instanceof Error ? error.stack : String(error),
                );
            }
        }

        this.logger.log(
            `Training hours backfill complete: syncedCount=${syncedCount}`,
        );
        return { syncedCount };
    }

    /** Total study time in hours for user analytics reports. */
    async getTotalStudyTimeHours(
        userId: string,
        orgId: string,
    ): Promise<number> {
        const summary = await this.getUserSummary(userId, orgId);
        return summary.totalHours;
    }

    /** Average session duration in minutes for user analytics reports. */
    async getAverageSessionDurationMinutes(
        userId: string,
        orgId: string,
    ): Promise<number> {
        const summary = await this.getUserSummary(userId, orgId);
        if (summary.sessionCount === 0) {
            return 0;
        }
        return (
            Math.round((summary.totalMinutes / summary.sessionCount) * 100) /
            100
        );
    }
}
