import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User } from '../../user/entities/user.entity';
import {
    TestAttempt,
    AttemptStatus,
} from '../../test_attempts/entities/test_attempt.entity';
import { Result } from '../../results/entities/result.entity';
import { Test } from '../../test/entities/test.entity';
import {
    UserAnalyticsResponseDto,
    UserStatsDto,
    UserEngagementDto,
    UserPerformanceDto,
    GlobalUserStatsDto,
} from '../dto/user-analytics.dto';

@Injectable()
export class UserReportsService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(TestAttempt)
        private testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private resultRepository: Repository<Result>,
        @InjectRepository(Test)
        private testRepository: Repository<Test>,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
    ) {}

    async getUserAnalytics(userId: string): Promise<UserAnalyticsResponseDto> {
        const cacheKey = `user_analytics_${userId}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<UserAnalyticsResponseDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Verify user exists
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }

        // Generate fresh analytics data
        const [stats, engagement, performance] = await Promise.all([
            this.getUserStats(userId),
            this.getUserEngagement(userId, user),
            this.getUserPerformance(userId),
        ]);

        const analyticsData: UserAnalyticsResponseDto = {
            stats,
            engagement,
            performance,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 45 minutes (2700 seconds)
        await this.cacheManager.set(cacheKey, analyticsData, 2700);

        return analyticsData;
    }

    private async getUserStats(userId: string): Promise<UserStatsDto> {
        // Get total test attempts
        const totalTestsAttempted = await this.testAttemptRepository.count({
            where: { userId },
        });

        // Get completed tests
        const testsCompleted = await this.testAttemptRepository.count({
            where: { userId, status: AttemptStatus.SUBMITTED },
        });

        // Calculate success rate
        const successRate =
            totalTestsAttempted > 0
                ? (testsCompleted / totalTestsAttempted) * 100
                : 0;

        // Get average score from results
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const averageScore = Number(avgScoreResult?.avgScore) || 0;

        // Calculate total study time (sum of all attempt durations)
        const studyTimeResult = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'SUM(EXTRACT(EPOCH FROM (ta.submitTime - ta.startTime)))',
                'totalSeconds',
            )
            .getRawOne();

        const totalStudyTimeHours =
            Number(studyTimeResult?.totalSeconds || 0) / 3600;

        // Calculate average session duration
        const sessionDurations = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'EXTRACT(EPOCH FROM (ta.submitTime - ta.startTime))',
                'duration',
            )
            .getRawMany();

        const averageSessionDurationMinutes =
            sessionDurations.length > 0
                ? sessionDurations.reduce(
                      (sum, session) => sum + Number(session.duration || 0),
                      0,
                  ) /
                  sessionDurations.length /
                  60
                : 0;

        // Get number of different courses engaged with
        const coursesEngaged = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('ta.userId = :userId', { userId })
            .select('COUNT(DISTINCT t.courseId)', 'count')
            .getRawOne()
            .then(result => parseInt(String(result?.count)) || 0);

        // Calculate current streak (consecutive successful tests)
        const recentAttempts = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .leftJoin('ta.results', 'r')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .orderBy('ta.submitTime', 'DESC')
            .select(['ta.attemptId', 'r.passed'])
            .limit(20)
            .getMany();

        let currentStreak = 0;
        for (const attempt of recentAttempts) {
            if (attempt.results?.[0]?.passed) {
                currentStreak++;
            } else {
                break;
            }
        }

        return {
            totalTestsAttempted,
            testsCompleted,
            averageScore: Math.round(averageScore * 100) / 100,
            successRate: Math.round(successRate * 100) / 100,
            totalStudyTimeHours: Math.round(totalStudyTimeHours * 100) / 100,
            averageSessionDurationMinutes:
                Math.round(averageSessionDurationMinutes * 100) / 100,
            coursesEngaged,
            currentStreak,
        };
    }

    private async getUserEngagement(
        userId: string,
        user: User,
    ): Promise<UserEngagementDto> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Count login sessions (distinct days with activity)
        const loginSessions = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
            .select('COUNT(DISTINCT DATE(ta.createdAt))', 'count')
            .getRawOne()
            .then(result => parseInt(result.count) || 0);

        // Active days in last 30 days
        const activeDays = loginSessions; // Same as login sessions for now

        // Calculate engagement score based on activity frequency
        const engagementScore = Math.min(100, (activeDays / 30) * 100);

        // Get last activity
        const lastActivityResult = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .orderBy('ta.createdAt', 'DESC')
            .limit(1)
            .getOne();

        const lastActivity = lastActivityResult?.createdAt || user.createdAt;

        // Analyze preferred study time (hour of day with most activity)
        const hourlyActivity = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .select('EXTRACT(HOUR FROM ta.startTime)', 'hour')
            .addSelect('COUNT(*)', 'count')
            .groupBy('EXTRACT(HOUR FROM ta.startTime)')
            .orderBy('count', 'DESC')
            .limit(1)
            .getRawOne();

        const preferredStudyHour = hourlyActivity
            ? parseInt(hourlyActivity.hour)
            : undefined;

        // Analyze most active day of week
        const dailyActivity = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .select('EXTRACT(DOW FROM ta.startTime)', 'dayOfWeek')
            .addSelect('COUNT(*)', 'count')
            .groupBy('EXTRACT(DOW FROM ta.startTime)')
            .orderBy('count', 'DESC')
            .limit(1)
            .getRawOne();

        const mostActiveDayOfWeek = dailyActivity
            ? parseInt(dailyActivity.dayOfWeek)
            : undefined;

        return {
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            loginSessions,
            activeDays,
            engagementScore: Math.round(engagementScore * 100) / 100,
            lastActivity,
            preferredStudyHour,
            mostActiveDayOfWeek,
        };
    }

    private async getUserPerformance(
        userId: string,
    ): Promise<UserPerformanceDto> {
        // Get recent results for trend analysis
        const recentResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.status = :status', { status: 'submitted' })
            .orderBy('ta.submitTime', 'ASC')
            .select(['r.score', 'ta.submitTime'])
            .limit(10)
            .getMany();

        // Calculate performance trend
        let performanceTrend = 'stable';
        let improvementRate = 0;

        if (recentResults.length >= 3) {
            const firstHalf =
                recentResults
                    .slice(0, Math.floor(recentResults.length / 2))
                    .reduce((sum, r) => sum + r.score, 0) /
                Math.floor(recentResults.length / 2);
            const secondHalf =
                recentResults
                    .slice(Math.floor(recentResults.length / 2))
                    .reduce((sum, r) => sum + r.score, 0) /
                Math.ceil(recentResults.length / 2);

            improvementRate = ((secondHalf - firstHalf) / firstHalf) * 100;

            if (improvementRate > 5) {
                performanceTrend = 'improving';
            } else if (improvementRate < -5) {
                performanceTrend = 'declining';
            }
        }

        // Find strongest and weakest subjects (by course)
        const coursePerformance = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .innerJoin('t.course', 'c')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.status = :status', { status: 'submitted' })
            .select('c.title', 'courseTitle')
            .addSelect('AVG(r.score)', 'avgScore')
            .addSelect('COUNT(*)', 'testCount')
            .groupBy('c.courseId, c.title')
            .having('COUNT(*) >= 2') // At least 2 tests for statistical relevance
            .orderBy('avgScore', 'DESC')
            .getRawMany();

        const strongestSubject =
            coursePerformance.length > 0
                ? coursePerformance[0].courseTitle
                : undefined;
        const weakestSubject =
            coursePerformance.length > 1
                ? coursePerformance[coursePerformance.length - 1].courseTitle
                : undefined;

        // Calculate average attempts to success
        const attemptsToSuccess = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.results', 'r')
            .where('ta.userId = :userId', { userId })
            .andWhere('r.passed = true')
            .select('ta.testId')
            .addSelect('MIN(ta.attemptNumber)', 'attemptsNeeded')
            .groupBy('ta.testId')
            .getRawMany();

        const averageAttemptsToSuccess =
            attemptsToSuccess.length > 0
                ? attemptsToSuccess.reduce(
                      (sum, test) => sum + test.attemptsNeeded,
                      0,
                  ) / attemptsToSuccess.length
                : 0;

        // Calculate first attempt success rate
        const firstAttempts = await this.testAttemptRepository.count({
            where: {
                userId,
                attemptNumber: 1,
                status: AttemptStatus.SUBMITTED,
            },
        });

        const firstAttemptSuccesses = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.results', 'r')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.attemptNumber = 1')
            .andWhere('ta.status = :status', { status: 'submitted' })
            .andWhere('r.passed = true')
            .getCount();

        const firstAttemptSuccessRate =
            firstAttempts > 0
                ? (firstAttemptSuccesses / firstAttempts) * 100
                : 0;

        // Calculate time efficiency score (based on completion time vs average)
        const userAvgTime = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'AVG(EXTRACT(EPOCH FROM (ta.submitTime - ta.startTime)))',
                'avgTime',
            )
            .getRawOne();

        const globalAvgTime = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.submitTime IS NOT NULL')
            .select(
                'AVG(EXTRACT(EPOCH FROM (ta.submitTime - ta.startTime)))',
                'avgTime',
            )
            .getRawOne();

        const timeEfficiencyScore =
            userAvgTime?.avgTime && globalAvgTime?.avgTime
                ? Math.min(
                      100,
                      100 -
                          ((userAvgTime.avgTime - globalAvgTime.avgTime) /
                              globalAvgTime.avgTime) *
                              100,
                  )
                : 50; // Default neutral score

        return {
            performanceTrend,
            improvementRate: Math.round(improvementRate * 100) / 100,
            strongestSubject,
            weakestSubject,
            averageAttemptsToSuccess:
                Math.round(averageAttemptsToSuccess * 100) / 100,
            firstAttemptSuccessRate:
                Math.round(firstAttemptSuccessRate * 100) / 100,
            timeEfficiencyScore: Math.max(
                0,
                Math.round(timeEfficiencyScore * 100) / 100,
            ),
        };
    }

    async getGlobalUserStats(): Promise<GlobalUserStatsDto> {
        const cacheKey = 'global_user_stats';

        const cachedData =
            await this.cacheManager.get<GlobalUserStatsDto>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Total users
        const totalUsers = await this.userRepository.count();

        // Daily active users (users with test attempts in last 24 hours)
        const dailyActiveUsers = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.createdAt >= :oneDayAgo', { oneDayAgo })
            .select('COUNT(DISTINCT ta.userId)', 'count')
            .getRawOne()
            .then(result => parseInt(result.count) || 0);

        // Weekly active users
        const weeklyActiveUsers = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.createdAt >= :oneWeekAgo', { oneWeekAgo })
            .select('COUNT(DISTINCT ta.userId)', 'count')
            .getRawOne()
            .then(result => parseInt(result.count) || 0);

        // Monthly active users
        const monthlyActiveUsers = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.createdAt >= :oneMonthAgo', { oneMonthAgo })
            .select('COUNT(DISTINCT ta.userId)', 'count')
            .getRawOne()
            .then(result => parseInt(result.count) || 0);

        // New users this week
        const newUsersThisWeek = await this.userRepository.count({
            where: {
                createdAt: oneWeekAgo,
            },
        });

        // Average session duration
        const avgSessionResult = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.submitTime IS NOT NULL')
            .select(
                'AVG(EXTRACT(EPOCH FROM (ta.submitTime - ta.startTime)))',
                'avgSeconds',
            )
            .getRawOne();

        const averageSessionDuration = (avgSessionResult?.avgSeconds || 0) / 60; // Convert to minutes

        // User retention rate (users active in last 30 days / total users)
        const retentionRate =
            totalUsers > 0 ? (monthlyActiveUsers / totalUsers) * 100 : 0;

        const globalStats: GlobalUserStatsDto = {
            totalUsers,
            dailyActiveUsers,
            weeklyActiveUsers,
            monthlyActiveUsers,
            newUsersThisWeek,
            averageSessionDuration:
                Math.round(averageSessionDuration * 100) / 100,
            retentionRate: Math.round(retentionRate * 100) / 100,
        };

        // Cache for 2 hours
        await this.cacheManager.set(cacheKey, globalStats, 7200);

        return globalStats;
    }

    async getUserRegistrationTrends(): Promise<any> {
        const cacheKey = 'user_registration_trends';

        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Get registration trends over the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const registrationData = await this.userRepository
            .createQueryBuilder('u')
            .where('u.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
            .select('DATE(u.createdAt)', 'date')
            .addSelect('COUNT(*)', 'newRegistrations')
            .groupBy('DATE(u.createdAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        // Cache for 1 hour
        await this.cacheManager.set(cacheKey, registrationData, 3600);

        return registrationData;
    }
}
