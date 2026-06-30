import {
    Injectable,
    BadRequestException,
    Inject,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User, UserStatus } from '../user/entities/user.entity';
import { Organization } from '../org/entities/org.entity';
import { Branch } from '../branch/entities/branch.entity';
import { UserRewards } from './entities/user-rewards.entity';
import { XPTransaction } from './entities/xp-transaction.entity';
import { Result } from '../results/entities/result.entity';
import { Test } from '../test/entities/test.entity';
import { CourseMaterial } from '../course-materials/entities/course-material.entity';
import { CourseMaterialView } from '../course-materials/entities/course-material-view.entity';
import { AwardXpDto } from './dto/award-xp.dto';
import { UserRewardsStatsDto } from './dto/user-rewards-stats.dto';
import {
    RewardsRankingScope,
    RewardsRankingsResponseDto,
    RewardsRankingEntryDto,
} from './dto/rewards-rankings.dto';
import {
    RewardsTransactionsResponseDto,
    XpTransactionResponseDto,
} from './dto/rewards-transactions.dto';
import { RetryService } from '../common/services/retry.service';
import {
    DEFAULT_LEVEL,
    DEFAULT_RANK,
    LEVELS,
    MONTHLY_CHALLENGE_HISTORY_CAP,
    RANKS,
    XP_ACTIONS,
    XP_SOURCE_TYPES,
    XP_VALUES,
    type XpRank,
} from './constants/xp.constants';
import {
    addXpToBreakdown,
    createEmptyXpBreakdown,
    getCurrentChallengeMonthUtc,
    normalizeXpBreakdown,
    resolveXpCategory,
} from './utils/xp-breakdown.util';
import type { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CourseCompletedEvent } from '../common/events/course-completed.event';
import { TrainingHoursService } from '../training-hours/training-hours.service';
import {
    TRAINING_HOURS_XP_THRESHOLDS,
} from '../training-hours/constants/training-hours.constants';
import { formatActivityDateUtc, formatYearMonthUtc } from '../training-hours/utils/training-hours.util';

/** Result returned when awardXP skips (user missing, inactive, or feature disabled). */
interface AwardXpSkippedResult {
    skipped: true;
    reason: string;
}

/** Input for the multi-award test result XP chain (Phase 4). */
export interface TestResultXpParams {
    resultId: number;
    attemptId: number;
    testId: number;
    courseId: number;
    userId: string;
    percentage: number;
    passed: boolean;
    attemptNumber: number;
    testTitle: string;
    orgId: string;
    branchId?: string;
}

/**
 * Core XP rewards service — all XP awards flow through awardXP().
 * Phase 3+ subscribers and domain services inject this service.
 */
@Injectable()
export class RewardsService {
    private readonly logger = new Logger(RewardsService.name);

    /** Org/branch-scoped cache keys per module.standard.md */
    private readonly CACHE_KEYS = {
        USER_STATS: (userId: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:rewards:stats:${userId}`,
        USER_REWARDS: (userId: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:rewards:row:${userId}`,
        RANKINGS_MONTHLY: (orgId?: string, branchId?: string, month?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:rewards:rankings:monthly:${month || 'current'}`,
        RANKINGS_ALLTIME: (orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:rewards:rankings:alltime`,
    };

    private readonly CACHE_TTL = {
        STATS: 300,
        RANKINGS: 180,
    };

    constructor(
        @InjectRepository(UserRewards)
        private readonly userRewardsRepository: Repository<UserRewards>,
        @InjectRepository(XPTransaction)
        private readonly xpTransactionRepository: Repository<XPTransaction>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(CourseMaterial)
        private readonly courseMaterialRepository: Repository<CourseMaterial>,
        @InjectRepository(CourseMaterialView)
        private readonly courseMaterialViewRepository: Repository<CourseMaterialView>,
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER)
        private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
        private readonly configService: ConfigService,
        private readonly eventEmitter: EventEmitter2,
        private readonly trainingHoursService: TrainingHoursService,
    ) {}

    /** Returns true when REWARDS_XP_ENABLED is not explicitly set to false. */
    private isXpEnabled(): boolean {
        const flag = this.configService.get<string>('REWARDS_XP_ENABLED');
        return flag !== 'false';
    }

    /**
     * Central XP award entry point — single DB transaction for ledger + aggregate update.
     * Skips silently when user is missing/inactive; enforces idempotency when key provided.
     */
    async awardXP(
        dto: AwardXpDto,
        orgId: string,
        branchId?: string,
    ): Promise<UserRewardsStatsDto | AwardXpSkippedResult> {
        if (!orgId) {
            throw new BadRequestException(
                'orgId is required for all XP awards (tenant scope)',
            );
        }

        if (!this.isXpEnabled()) {
            this.logger.debug(
                `XP awards disabled (REWARDS_XP_ENABLED=false) — skipping ${dto.action} for user ${dto.userId}`,
            );
            return { skipped: true, reason: 'feature_disabled' };
        }

        return this.retryService.executeDatabase(
            async () =>
                this.dataSource.transaction(async (manager) =>
                    this.executeAwardXpTransaction(manager, dto, orgId, branchId),
                ),
            { operation: 'award_xp', userId: dto.userId },
        );
    }

    /** Loads user rewards stats for API read paths (GET /rewards/user-stats). */
    async getUserStats(
        userId: string,
        scope: OrgBranchScope,
    ): Promise<UserRewardsStatsDto | null> {
        if (!scope.orgId) {
            throw new BadRequestException('orgId is required');
        }

        const cacheKey = this.CACHE_KEYS.USER_STATS(
            userId,
            scope.orgId,
            scope.branchId,
        );
        const cached =
            await this.cacheManager.get<UserRewardsStatsDto>(cacheKey);
        if (cached) {
            return cached;
        }

        const rewards = await this.findUserRewardsScoped(
            userId,
            scope.orgId,
            scope.branchId,
        );

        if (!rewards) {
            return null;
        }

        const stats = this.mapToStatsDto(rewards);
        await this.cacheManager.set(cacheKey, stats, this.CACHE_TTL.STATS * 1000);
        return stats;
    }

    /**
     * Phase 4 — awards submit/pass/first-try/perfect/improve XP for one test result.
     * Non-blocking: callers should wrap in try/catch so result creation never fails.
     */
    async processTestResultXp(params: TestResultXpParams): Promise<void> {
        const sourceBase = {
            id: String(params.resultId),
            type: XP_SOURCE_TYPES.TEST_RESULT,
        };

        const awards: AwardXpDto[] = [
            {
                userId: params.userId,
                amount: XP_VALUES.SUBMIT_TEST,
                action: XP_ACTIONS.SUBMIT_TEST,
                source: {
                    ...sourceBase,
                    details: `Submitted ${params.testTitle}`,
                },
                idempotencyKey: `attempt-submit:${params.attemptId}`,
            },
        ];

        if (params.passed) {
            awards.push({
                userId: params.userId,
                amount: XP_VALUES.PASS_TEST,
                action: XP_ACTIONS.PASS_TEST,
                source: {
                    ...sourceBase,
                    details: `Passed ${params.testTitle} with ${params.percentage}%`,
                },
                idempotencyKey: `result:${params.resultId}:PASS_TEST`,
            });

            if (params.attemptNumber === 1) {
                awards.push({
                    userId: params.userId,
                    amount: XP_VALUES.PASS_TEST_FIRST_TRY,
                    action: XP_ACTIONS.PASS_TEST_FIRST_TRY,
                    source: {
                        ...sourceBase,
                        details: `First-try pass on ${params.testTitle}`,
                    },
                    idempotencyKey: `result:${params.resultId}:PASS_TEST_FIRST_TRY`,
                });
            }
        }

        if (params.percentage === 100) {
            awards.push({
                userId: params.userId,
                amount: XP_VALUES.PERFECT_SCORE,
                action: XP_ACTIONS.PERFECT_SCORE,
                source: {
                    ...sourceBase,
                    details: `Perfect score on ${params.testTitle}`,
                },
                idempotencyKey: `result:${params.resultId}:PERFECT_SCORE`,
            });
        }

        const previousBest = await this.resultRepository
            .createQueryBuilder('result')
            .where('result.userId = :userId', { userId: params.userId })
            .andWhere('result.testId = :testId', { testId: params.testId })
            .andWhere('result.resultId != :resultId', {
                resultId: params.resultId,
            })
            .orderBy('result.percentage', 'DESC')
            .getOne();

        if (
            previousBest &&
            params.percentage > Number(previousBest.percentage)
        ) {
            awards.push({
                userId: params.userId,
                amount: XP_VALUES.IMPROVE_SCORE,
                action: XP_ACTIONS.IMPROVE_SCORE,
                source: {
                    ...sourceBase,
                    details: `Improved ${params.testTitle} from ${previousBest.percentage}% to ${params.percentage}%`,
                },
                idempotencyKey: `result:${params.resultId}:IMPROVE_SCORE`,
            });
        }

        for (const award of awards) {
            await this.awardXP(award, params.orgId, params.branchId);
        }

        await this.evaluateAndAwardCourseCompletion(
            params.userId,
            params.courseId,
            params.orgId,
            params.branchId,
        );
    }

    /**
     * Phase 4 — one-time award when all active tests in a course are passed.
     */
    async evaluateAndAwardCourseCompletion(
        userId: string,
        courseId: number,
        orgId: string,
        branchId?: string,
    ): Promise<void> {
        const isComplete = await this.hasPassedAllActiveTests(
            userId,
            courseId,
        );

        if (!isComplete) {
            return;
        }

        await this.awardXP(
            {
                userId,
                amount: XP_VALUES.COMPLETE_COURSE,
                action: XP_ACTIONS.COMPLETE_COURSE,
                source: {
                    id: String(courseId),
                    type: XP_SOURCE_TYPES.COURSE,
                    details: `Completed all active tests in course ${courseId}`,
                },
                idempotencyKey: `course-complete:${userId}:${courseId}`,
            },
            orgId,
            branchId,
        );

        this.eventEmitter.emit(
            'course.completed',
            new CourseCompletedEvent(courseId, userId, orgId, branchId),
        );
    }

    /** Phase 4 — checks whether user has a passing result for every active test. */
    async hasPassedAllActiveTests(
        userId: string,
        courseId: number,
    ): Promise<boolean> {
        const activeTests = await this.testRepository.find({
            where: { courseId, isActive: true },
            select: { testId: true },
        });

        if (activeTests.length === 0) {
            return false;
        }

        const activeTestIds = activeTests.map((test) => test.testId);
        const passedRows = await this.resultRepository
            .createQueryBuilder('result')
            .select('DISTINCT result.testId', 'testId')
            .where('result.userId = :userId', { userId })
            .andWhere('result.courseId = :courseId', { courseId })
            .andWhere('result.passed = :passed', { passed: true })
            .andWhere('result.testId IN (:...activeTestIds)', { activeTestIds })
            .getRawMany<{ testId: number }>();

        return passedRows.length >= activeTests.length;
    }

    /** Phase 5 — org/branch XP leaderboard (all-time or monthly challenge). */
    async getRankings(
        scope: OrgBranchScope,
        queryScope: RewardsRankingScope = RewardsRankingScope.ALLTIME,
        month?: string,
        page = 1,
        limit = 20,
    ): Promise<RewardsRankingsResponseDto> {
        if (!scope.orgId) {
            throw new BadRequestException('orgId is required');
        }

        const cacheKey = this.CACHE_KEYS.RANKINGS_MONTHLY(
            scope.orgId,
            scope.branchId,
            queryScope === RewardsRankingScope.MONTHLY
                ? month || getCurrentChallengeMonthUtc()
                : 'alltime',
        );

        if (queryScope === RewardsRankingScope.ALLTIME) {
            const alltimeKey = this.CACHE_KEYS.RANKINGS_ALLTIME(
                scope.orgId,
                scope.branchId,
            );
            const cachedAlltime =
                await this.cacheManager.get<RewardsRankingsResponseDto>(
                    alltimeKey,
                );
            if (cachedAlltime) {
                return cachedAlltime;
            }
        }

        const skip = (page - 1) * limit;
        const qb = this.userRewardsRepository
            .createQueryBuilder('rewards')
            .leftJoinAndSelect('rewards.user', 'user')
            .leftJoin('rewards.orgId', 'org')
            .leftJoin('rewards.branchId', 'branch')
            .where('org.id = :orgId', { orgId: scope.orgId });

        if (scope.branchId) {
            qb.andWhere('branch.id = :branchId', { branchId: scope.branchId });
        }

        if (queryScope === RewardsRankingScope.MONTHLY) {
            const challengeMonth = month || getCurrentChallengeMonthUtc();
            qb.andWhere('rewards.challengeMonth = :challengeMonth', {
                challengeMonth,
            }).orderBy('rewards.challengeMonthXP', 'DESC');
        } else {
            qb.orderBy('rewards.totalXP', 'DESC');
        }

        const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();

        const rankings: RewardsRankingEntryDto[] = rows.map((row, index) => ({
            rank: skip + index + 1,
            userId: row.userId,
            totalXP:
                queryScope === RewardsRankingScope.MONTHLY
                    ? row.challengeMonthXP
                    : row.totalXP,
            level: row.level,
            rankTier: row.rank,
            firstName: row.user?.firstName,
            lastName: row.user?.lastName,
        }));

        const response: RewardsRankingsResponseDto = {
            rankings,
            total,
            page,
            limit,
            scope: queryScope,
            month:
                queryScope === RewardsRankingScope.MONTHLY
                    ? month || getCurrentChallengeMonthUtc()
                    : undefined,
        };

        const storeKey =
            queryScope === RewardsRankingScope.MONTHLY
                ? cacheKey
                : this.CACHE_KEYS.RANKINGS_ALLTIME(scope.orgId, scope.branchId);
        await this.cacheManager.set(
            storeKey,
            response,
            this.CACHE_TTL.RANKINGS * 1000,
        );

        return response;
    }

    /** Phase 5 — paginated XP transaction history for a user. */
    async getTransactions(
        userId: string,
        scope: OrgBranchScope,
        page = 1,
        limit = 20,
    ): Promise<RewardsTransactionsResponseDto> {
        if (!scope.orgId) {
            throw new BadRequestException('orgId is required');
        }

        const rewards = await this.findUserRewardsScoped(
            userId,
            scope.orgId,
            scope.branchId,
        );

        if (!rewards) {
            return { transactions: [], total: 0, page, limit };
        }

        const skip = (page - 1) * limit;
        const [rows, total] = await this.xpTransactionRepository.findAndCount({
            where: { userRewardsId: rewards.id },
            order: { timestamp: 'DESC' },
            skip,
            take: limit,
        });

        const transactions: XpTransactionResponseDto[] = rows.map((row) => ({
            id: row.id,
            action: row.action,
            xpAmount: row.xpAmount,
            metadata: row.metadata as Record<string, unknown>,
            idempotencyKey: row.idempotencyKey,
            timestamp: row.timestamp,
        }));

        return { transactions, total, page, limit };
    }

    /**
     * Phase 6 — closes stale challenge months for users who earned no XP this period.
     */
    async rollStaleChallengeMonths(): Promise<number> {
        const currentMonth = getCurrentChallengeMonthUtc();

        return this.retryService.executeDatabase(async () => {
            const staleRows = await this.userRewardsRepository
                .createQueryBuilder('rewards')
                .where('rewards.challengeMonth != :currentMonth', {
                    currentMonth,
                })
                .getMany();

            let rolled = 0;
            for (const row of staleRows) {
                const updated = this.rollChallengeMonthIfNeeded(row);
                if (updated.challengeMonth !== row.challengeMonth) {
                    await this.userRewardsRepository.save(updated);
                    rolled += 1;
                }
            }

            return rolled;
        });
    }

    /**
     * Phase 6 — awards LEARNING_STREAK_7 when user has XP activity 7 consecutive UTC days.
     */
    async evaluateLearningStreaks(): Promise<number> {
        const engagementSourceTypes = [
            XP_SOURCE_TYPES.AUTH,
            XP_SOURCE_TYPES.TEST_RESULT,
            XP_SOURCE_TYPES.TEST_ATTEMPT,
        ];

        return this.retryService.executeDatabase(async () => {
            const allRewards = await this.userRewardsRepository.find({
                relations: ['orgId', 'branchId'],
            });

            let awarded = 0;
            const todayUtc = this.getUtcDateString(new Date());

            for (const rewards of allRewards) {
                const orgId =
                    typeof rewards.orgId === 'object'
                        ? rewards.orgId.id
                        : String(rewards.orgId);
                const branchId =
                    rewards.branchId &&
                    typeof rewards.branchId === 'object'
                        ? rewards.branchId.id
                        : undefined;

                const recentTransactions = await this.xpTransactionRepository
                    .createQueryBuilder('tx')
                    .where('tx.userRewardsId = :rewardsId', {
                        rewardsId: rewards.id,
                    })
                    .andWhere(
                        `JSON_UNQUOTE(JSON_EXTRACT(tx.metadata, '$.sourceType')) IN (:...types)`,
                        { types: engagementSourceTypes },
                    )
                    .orderBy('tx.timestamp', 'DESC')
                    .limit(30)
                    .getMany();

                const activeDays = new Set<string>();
                for (const tx of recentTransactions) {
                    activeDays.add(this.getUtcDateString(tx.timestamp));
                }

                let consecutive = 0;
                const cursor = new Date(`${todayUtc}T00:00:00.000Z`);
                for (let day = 0; day < 7; day += 1) {
                    const key = this.getUtcDateString(cursor);
                    if (!activeDays.has(key)) {
                        break;
                    }
                    consecutive += 1;
                    cursor.setUTCDate(cursor.getUTCDate() - 1);
                }

                if (consecutive < 7) {
                    continue;
                }

                const weekKey = this.getIsoWeekKey(new Date());
                const result = await this.awardXP(
                    {
                        userId: rewards.userId,
                        amount: XP_VALUES.LEARNING_STREAK_7,
                        action: XP_ACTIONS.LEARNING_STREAK_7,
                        source: {
                            id: weekKey,
                            type: XP_SOURCE_TYPES.STREAK,
                            details: '7-day learning streak',
                        },
                        idempotencyKey: `streak-7:${rewards.userId}:${weekKey}`,
                    },
                    orgId,
                    branchId,
                );

                if (!('skipped' in result && result.skipped)) {
                    awarded += 1;
                }
            }

            return awarded;
        });
    }

    /**
     * Phase 6 — awards WEEKLY_TRAINING_GOAL when ≥3 tests submitted in rolling 7 days.
     */
    async evaluateWeeklyTrainingGoals(): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const since = new Date();
            since.setUTCDate(since.getUTCDate() - 7);

            const allRewards = await this.userRewardsRepository.find({
                relations: ['orgId', 'branchId'],
            });

            let awarded = 0;
            const weekKey = this.getIsoWeekKey(new Date());

            for (const rewards of allRewards) {
                const submitCount = await this.xpTransactionRepository
                    .createQueryBuilder('tx')
                    .where('tx.userRewardsId = :rewardsId', {
                        rewardsId: rewards.id,
                    })
                    .andWhere('tx.action = :action', {
                        action: XP_ACTIONS.SUBMIT_TEST,
                    })
                    .andWhere('tx.timestamp >= :since', { since })
                    .getCount();

                if (submitCount < 3) {
                    continue;
                }

                const orgId =
                    typeof rewards.orgId === 'object'
                        ? rewards.orgId.id
                        : String(rewards.orgId);
                const branchId =
                    rewards.branchId &&
                    typeof rewards.branchId === 'object'
                        ? rewards.branchId.id
                        : undefined;

                const result = await this.awardXP(
                    {
                        userId: rewards.userId,
                        amount: XP_VALUES.WEEKLY_TRAINING_GOAL,
                        action: XP_ACTIONS.WEEKLY_TRAINING_GOAL,
                        source: {
                            id: weekKey,
                            type: XP_SOURCE_TYPES.TRAINING_PROGRESS,
                            details: `${submitCount} tests submitted in 7 days`,
                        },
                        idempotencyKey: `weekly-goal:${rewards.userId}:${weekKey}`,
                    },
                    orgId,
                    branchId,
                );

                if (!('skipped' in result && result.skipped)) {
                    awarded += 1;
                }
            }

            return awarded;
        });
    }

    /** Awards hour-based XP when user reaches ≥2 hours in rolling 7 days. */
    async evaluateWeeklyTrainingHourGoals(): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const allRewards = await this.userRewardsRepository.find({
                relations: ['orgId', 'branchId'],
            });

            let awarded = 0;
            const weekKey = this.getIsoWeekKey(new Date());
            const since = new Date();
            since.setUTCDate(since.getUTCDate() - 7);
            const end = new Date();

            for (const rewards of allRewards) {
                const orgId =
                    typeof rewards.orgId === 'object'
                        ? rewards.orgId.id
                        : String(rewards.orgId);
                const branchId =
                    rewards.branchId &&
                    typeof rewards.branchId === 'object'
                        ? rewards.branchId.id
                        : undefined;

                const totalMinutes =
                    await this.trainingHoursService.sumUserMinutesInRange(
                        rewards.userId,
                        orgId,
                        since,
                        end,
                    );

                if (totalMinutes < TRAINING_HOURS_XP_THRESHOLDS.WEEKLY_MINUTES) {
                    continue;
                }

                const result = await this.awardXP(
                    {
                        userId: rewards.userId,
                        amount: XP_VALUES.WEEKLY_TRAINING_HOURS_2,
                        action: XP_ACTIONS.WEEKLY_TRAINING_HOURS_2,
                        source: {
                            id: weekKey,
                            type: XP_SOURCE_TYPES.TRAINING_PROGRESS,
                            details: `${totalMinutes} training minutes in 7 days`,
                        },
                        idempotencyKey: `weekly-hours-2:${rewards.userId}:${weekKey}`,
                    },
                    orgId,
                    branchId,
                );

                if (!('skipped' in result && result.skipped)) {
                    awarded += 1;
                    this.logger.log(
                        `Weekly training hours XP awarded to user ${rewards.userId}`,
                    );
                }
            }

            return awarded;
        });
    }

    /** Awards monthly hour milestones for the previous calendar month. */
    async evaluateMonthlyTrainingHourGoals(): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const now = new Date();
            const prevMonth = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
            );
            const yearMonth = formatYearMonthUtc(prevMonth);
            const monthStart = new Date(
                Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth(), 1),
            );
            const monthEnd = new Date(
                Date.UTC(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1, 1),
            );

            const allRewards = await this.userRewardsRepository.find({
                relations: ['orgId', 'branchId'],
            });

            let awarded = 0;

            for (const rewards of allRewards) {
                const orgId =
                    typeof rewards.orgId === 'object'
                        ? rewards.orgId.id
                        : String(rewards.orgId);
                const branchId =
                    rewards.branchId &&
                    typeof rewards.branchId === 'object'
                        ? rewards.branchId.id
                        : undefined;

                const totalMinutes =
                    await this.trainingHoursService.sumUserMinutesInRange(
                        rewards.userId,
                        orgId,
                        monthStart,
                        monthEnd,
                    );

                const milestones: Array<{
                    threshold: number;
                    action: (typeof XP_ACTIONS)[keyof typeof XP_ACTIONS];
                    amount: number;
                    key: string;
                }> = [
                    {
                        threshold:
                            TRAINING_HOURS_XP_THRESHOLDS.MONTHLY_5_HOURS_MINUTES,
                        action: XP_ACTIONS.MONTHLY_TRAINING_HOURS_5,
                        amount: XP_VALUES.MONTHLY_TRAINING_HOURS_5,
                        key: 'monthly-hours-5',
                    },
                    {
                        threshold:
                            TRAINING_HOURS_XP_THRESHOLDS.MONTHLY_10_HOURS_MINUTES,
                        action: XP_ACTIONS.MONTHLY_TRAINING_HOURS_10,
                        amount: XP_VALUES.MONTHLY_TRAINING_HOURS_10,
                        key: 'monthly-hours-10',
                    },
                ];

                for (const milestone of milestones) {
                    if (totalMinutes < milestone.threshold) {
                        continue;
                    }

                    const result = await this.awardXP(
                        {
                            userId: rewards.userId,
                            amount: milestone.amount,
                            action: milestone.action,
                            source: {
                                id: yearMonth,
                                type: XP_SOURCE_TYPES.TRAINING_PROGRESS,
                                details: `${totalMinutes} training minutes in ${yearMonth}`,
                            },
                            idempotencyKey: `${milestone.key}:${rewards.userId}:${yearMonth}`,
                        },
                        orgId,
                        branchId,
                    );

                    if (!('skipped' in result && result.skipped)) {
                        awarded += 1;
                        this.logger.log(
                            `Monthly training hours XP (${milestone.action}) awarded to user ${rewards.userId}`,
                        );
                    }
                }
            }

            return awarded;
        });
    }

    /** Awards daily XP when user logged ≥30 training minutes yesterday (UTC). */
    async evaluateDailyTrainingGoals(): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const yesterday = new Date();
            yesterday.setUTCDate(yesterday.getUTCDate() - 1);
            const activityDate = formatActivityDateUtc(yesterday);
            const dayKey = activityDate;

            const allRewards = await this.userRewardsRepository.find({
                relations: ['orgId', 'branchId'],
            });

            let awarded = 0;

            for (const rewards of allRewards) {
                const orgId =
                    typeof rewards.orgId === 'object'
                        ? rewards.orgId.id
                        : String(rewards.orgId);
                const branchId =
                    rewards.branchId &&
                    typeof rewards.branchId === 'object'
                        ? rewards.branchId.id
                        : undefined;

                const totalMinutes =
                    await this.trainingHoursService.sumUserMinutesOnDate(
                        rewards.userId,
                        orgId,
                        activityDate,
                    );

                if (totalMinutes < TRAINING_HOURS_XP_THRESHOLDS.DAILY_MINUTES) {
                    continue;
                }

                const result = await this.awardXP(
                    {
                        userId: rewards.userId,
                        amount: XP_VALUES.DAILY_TRAINING_30MIN,
                        action: XP_ACTIONS.DAILY_TRAINING_30MIN,
                        source: {
                            id: dayKey,
                            type: XP_SOURCE_TYPES.TRAINING_PROGRESS,
                            details: `${totalMinutes} training minutes on ${dayKey}`,
                        },
                        idempotencyKey: `daily-30min:${rewards.userId}:${dayKey}`,
                    },
                    orgId,
                    branchId,
                );

                if (!('skipped' in result && result.skipped)) {
                    awarded += 1;
                    this.logger.log(
                        `Daily training hours XP awarded to user ${rewards.userId}`,
                    );
                }
            }

            return awarded;
        });
    }

    /** Phase 4 — checks if all materials in a course have been viewed by user. */
    async hasViewedAllCourseMaterials(
        userId: string,
        courseId: number,
    ): Promise<boolean> {
        const materialCount = await this.courseMaterialRepository.count({
            where: { courseId, isActive: true },
        });

        if (materialCount === 0) {
            return false;
        }

        const viewCount = await this.courseMaterialViewRepository.count({
            where: { userId, courseId },
        });

        return viewCount >= materialCount;
    }

    private getUtcDateString(date: Date): string {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private getIsoWeekKey(date: Date): string {
        const utc = new Date(
            Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
        );
        const day = utc.getUTCDay() || 7;
        utc.setUTCDate(utc.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
        const week = Math.ceil(
            ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
        );
        return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }

    /** Transaction body for awardXP — isolated for testability. */
    private async executeAwardXpTransaction(
        manager: EntityManager,
        dto: AwardXpDto,
        orgId: string,
        branchId?: string,
    ): Promise<UserRewardsStatsDto | AwardXpSkippedResult> {
        const user = await this.resolveActiveUser(
            manager,
            dto.userId,
            orgId,
            branchId,
        );

        if (!user) {
            this.logger.warn(
                `Skipping XP award (${dto.action}): user ${dto.userId} not found or inactive in org ${orgId}`,
            );
            return { skipped: true, reason: 'user_not_found_or_inactive' };
        }

        let rewards = await this.findOrCreateUserRewards(
            manager,
            user,
            orgId,
            branchId,
        );

        if (dto.idempotencyKey) {
            const existing = await manager.findOne(XPTransaction, {
                where: {
                    userRewardsId: rewards.id,
                    idempotencyKey: dto.idempotencyKey,
                },
            });

            if (existing) {
                this.logger.debug(
                    `Idempotent skip: ${dto.idempotencyKey} already awarded for userRewards ${rewards.id}`,
                );
                const stats = this.mapToStatsDto(rewards);
                return { ...stats, skippedDuplicate: true };
            }
        }

        const previousLevel = rewards.level;

        rewards = this.rollChallengeMonthIfNeeded(rewards);

        const category = resolveXpCategory(
            dto.action,
            dto.source?.type,
        );

        const metadata = {
            sourceId: dto.source?.id,
            sourceType: dto.source?.type,
            details: dto.source?.details,
            idempotencyKey: dto.idempotencyKey,
        };

        const transaction = manager.create(XPTransaction, {
            userRewardsId: rewards.id,
            action: dto.action,
            xpAmount: dto.amount,
            metadata,
            idempotencyKey: dto.idempotencyKey,
            timestamp: new Date(),
        });
        await manager.save(XPTransaction, transaction);

        rewards.currentXP += dto.amount;
        rewards.totalXP += dto.amount;
        rewards.challengeMonthXP += dto.amount;
        rewards.xpBreakdown = addXpToBreakdown(
            normalizeXpBreakdown(rewards.xpBreakdown),
            category,
            dto.amount,
        );
        rewards.challengeMonthXpBreakdown = addXpToBreakdown(
            normalizeXpBreakdown(rewards.challengeMonthXpBreakdown),
            category,
            dto.amount,
        );

        const newLevel = this.calculateLevel(rewards.totalXP);
        const leveledUp = newLevel > rewards.level;
        rewards.level = newLevel;
        rewards.rank = this.calculateRank(newLevel);
        rewards.lastActionAt = new Date();

        const saved = await manager.save(UserRewards, rewards);

        await this.invalidateRewardsCache(
            dto.userId,
            orgId,
            branchId,
        );

        const stats = this.mapToStatsDto(saved);
        return {
            ...stats,
            leveledUp,
            previousLevel: leveledUp ? previousLevel : undefined,
            skippedDuplicate: false,
        };
    }

    /** Resolves an active user within org (and optional branch) scope. */
    private async resolveActiveUser(
        manager: EntityManager,
        userId: string,
        orgId: string,
        branchId?: string,
    ): Promise<User | null> {
        const query = manager
            .createQueryBuilder(User, 'user')
            .leftJoinAndSelect('user.orgId', 'org')
            .leftJoinAndSelect('user.branchId', 'branch')
            .where('user.id = :userId', { userId })
            .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
            .andWhere('org.id = :orgId', { orgId });

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        return query.getOne();
    }

    /** Finds existing UserRewards or lazy-creates with Phase 1 defaults. */
    private async findOrCreateUserRewards(
        manager: EntityManager,
        user: User,
        orgId: string,
        branchId?: string,
    ): Promise<UserRewards> {
        const existing = await manager.findOne(UserRewards, {
            where: {
                userId: user.id,
                orgId: { id: orgId },
            },
            relations: ['orgId', 'branchId'],
        });

        if (existing) {
            return existing;
        }

        const challengeMonth = getCurrentChallengeMonthUtc();
        const emptyBreakdown = createEmptyXpBreakdown();

        const created = manager.create(UserRewards, {
            userId: user.id,
            orgId: { id: orgId } as Organization,
            branchId: branchId
                ? ({ id: branchId } as Branch)
                : user.branchId
                  ? ({ id: user.branchId.id } as Branch)
                  : undefined,
            currentXP: 0,
            totalXP: 0,
            level: DEFAULT_LEVEL,
            rank: DEFAULT_RANK,
            xpBreakdown: emptyBreakdown,
            challengeMonth,
            challengeMonthXP: 0,
            challengeMonthXpBreakdown: { ...emptyBreakdown },
            monthlyChallengeHistory: [],
        });

        return manager.save(UserRewards, created);
    }

    /**
     * Archives the prior challenge month when UTC month has changed.
     * Resets challengeMonthXP and monthly breakdown for the new period.
     */
    private rollChallengeMonthIfNeeded(rewards: UserRewards): UserRewards {
        const currentMonth = getCurrentChallengeMonthUtc();

        if (rewards.challengeMonth === currentMonth) {
            return rewards;
        }

        const history = [...(rewards.monthlyChallengeHistory ?? [])];
        history.push({
            month: rewards.challengeMonth,
            xp: rewards.challengeMonthXP,
            breakdown: normalizeXpBreakdown(rewards.challengeMonthXpBreakdown),
            closedAt: new Date().toISOString(),
        });

        if (history.length > MONTHLY_CHALLENGE_HISTORY_CAP) {
            history.splice(
                0,
                history.length - MONTHLY_CHALLENGE_HISTORY_CAP,
            );
        }

        rewards.monthlyChallengeHistory = history;
        rewards.challengeMonth = currentMonth;
        rewards.challengeMonthXP = 0;
        rewards.challengeMonthXpBreakdown = createEmptyXpBreakdown();

        return rewards;
    }

    /** Derives level (1–10) from lifetime totalXP using LEVELS bands. */
    calculateLevel(totalXP: number): number {
        for (let index = LEVELS.length - 1; index >= 0; index -= 1) {
            if (totalXP >= LEVELS[index].minXp) {
                return LEVELS[index].level;
            }
        }
        return DEFAULT_LEVEL;
    }

    /** Maps level to rank tier per RANKS table in setup doc. */
    calculateRank(level: number): XpRank {
        if (level >= 10) {
            return RANKS.DIAMOND;
        }
        if (level >= 8) {
            return RANKS.PLATINUM;
        }
        if (level >= 6) {
            return RANKS.GOLD;
        }
        if (level >= 4) {
            return RANKS.SILVER;
        }
        if (level >= 2) {
            return RANKS.BRONZE;
        }
        return RANKS.ROOKIE;
    }

    private async findUserRewardsScoped(
        userId: string,
        orgId: string,
        branchId?: string,
    ): Promise<UserRewards | null> {
        const query = this.userRewardsRepository
            .createQueryBuilder('rewards')
            .leftJoinAndSelect('rewards.orgId', 'org')
            .leftJoinAndSelect('rewards.branchId', 'branch')
            .where('rewards.userId = :userId', { userId })
            .andWhere('org.id = :orgId', { orgId });

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        return query.getOne();
    }

    private mapToStatsDto(rewards: UserRewards): UserRewardsStatsDto {
        return {
            id: rewards.id,
            userId: rewards.userId,
            orgId:
                typeof rewards.orgId === 'object' && rewards.orgId !== null
                    ? rewards.orgId.id
                    : String(rewards.orgId),
            branchId:
                rewards.branchId &&
                typeof rewards.branchId === 'object'
                    ? rewards.branchId.id
                    : undefined,
            currentXP: rewards.currentXP,
            totalXP: rewards.totalXP,
            level: rewards.level,
            rank: rewards.rank,
            xpBreakdown: normalizeXpBreakdown(rewards.xpBreakdown),
            challengeMonth: rewards.challengeMonth,
            challengeMonthXP: rewards.challengeMonthXP,
            challengeMonthXpBreakdown: normalizeXpBreakdown(
                rewards.challengeMonthXpBreakdown,
            ),
            monthlyChallengeHistory: rewards.monthlyChallengeHistory ?? [],
            lastActionAt: rewards.lastActionAt,
        };
    }

    private async invalidateRewardsCache(
        userId: string,
        orgId: string,
        branchId?: string,
    ): Promise<void> {
        const keys = [
            this.CACHE_KEYS.USER_STATS(userId, orgId, branchId),
            this.CACHE_KEYS.USER_REWARDS(userId, orgId, branchId),
            this.CACHE_KEYS.RANKINGS_ALLTIME(orgId, branchId),
            this.CACHE_KEYS.RANKINGS_MONTHLY(orgId, branchId),
        ];

        await Promise.all(
            keys.map(async (key) => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(`Failed to delete cache key ${key}:`, error);
                }
            }),
        );
    }
}
