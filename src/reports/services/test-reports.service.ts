import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Test } from '../../test/entities/test.entity';
import {
    TestAttempt,
    AttemptStatus,
} from '../../test_attempts/entities/test_attempt.entity';
import { Result } from '../../results/entities/result.entity';
import { Question } from '../../questions/entities/question.entity';
import { Answer } from '../../answers/entities/answer.entity';
import {
    TestAnalyticsResponseDto,
    TestStatsDto,
    TestPerformanceDto,
    TestQualityDto,
    GlobalTestStatsDto,
} from '../dto/test-analytics.dto';

@Injectable()
export class TestReportsService {
    constructor(
        @InjectRepository(Test)
        private testRepository: Repository<Test>,
        @InjectRepository(TestAttempt)
        private testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Result)
        private resultRepository: Repository<Result>,
        @InjectRepository(Question)
        private questionRepository: Repository<Question>,
        @InjectRepository(Answer)
        private answerRepository: Repository<Answer>,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
    ) {}

    async getTestAnalytics(testId: number): Promise<TestAnalyticsResponseDto> {
        const cacheKey = `test_analytics_${testId}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<TestAnalyticsResponseDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Verify test exists
        const test = await this.testRepository.findOne({
            where: { testId },
        });

        if (!test) {
            throw new Error(`Test with ID ${testId} not found`);
        }

        // Generate fresh analytics data
        const [stats, performance, quality] = await Promise.all([
            this.getTestStats(testId),
            this.getTestPerformance(testId, test),
            this.getTestQuality(testId),
        ]);

        const analyticsData: TestAnalyticsResponseDto = {
            stats,
            performance,
            quality,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 1 hour (3600 seconds)
        await this.cacheManager.set(cacheKey, analyticsData, 3600);

        return analyticsData;
    }

    private async getTestStats(testId: number): Promise<TestStatsDto> {
        // Get total attempts
        const totalAttempts = await this.testAttemptRepository.count({
            where: { testId },
        });

        // Get completed attempts
        const completedAttempts = await this.testAttemptRepository.count({
            where: { testId, status: AttemptStatus.SUBMITTED },
        });

        // Calculate completion rate
        const completionRate =
            totalAttempts > 0 ? (completedAttempts / totalAttempts) * 100 : 0;

        // Calculate average duration
        const durationResult = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'AVG(TIMESTAMPDIFF(SECOND, ta.startTime, ta.submitTime))',
                'avgSeconds',
            )
            .getRawOne();

        const averageDurationMinutes =
            Number(durationResult?.avgSeconds || 0) / 60;

        // Get average score
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const averageScore = Number(avgScoreResult?.avgScore || 0);

        // Calculate pass rate (assuming 70% is passing)
        const passedResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .andWhere('r.passed = true')
            .getCount();

        const passRate =
            completedAttempts > 0
                ? (passedResults / completedAttempts) * 100
                : 0;

        // Calculate average attempts per user
        const attemptsPerUser = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.testId = :testId', { testId })
            .select('ta.userId')
            .addSelect('COUNT(*)', 'attemptCount')
            .groupBy('ta.userId')
            .getRawMany();

        const averageAttemptsPerUser =
            attemptsPerUser.length > 0
                ? attemptsPerUser.reduce(
                      (sum, user) => sum + Number(user.attemptCount),
                      0,
                  ) / attemptsPerUser.length
                : 0;

        // Calculate first attempt success rate
        const firstAttempts = await this.testAttemptRepository.count({
            where: {
                testId,
                attemptNumber: 1,
                status: AttemptStatus.SUBMITTED,
            },
        });

        const firstAttemptSuccesses = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.results', 'r')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.attemptNumber = 1')
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .andWhere('r.passed = true')
            .getCount();

        const firstAttemptSuccessRate =
            firstAttempts > 0
                ? (firstAttemptSuccesses / firstAttempts) * 100
                : 0;

        return {
            totalAttempts,
            completedAttempts,
            completionRate: Math.round(completionRate * 100) / 100,
            averageDurationMinutes:
                Math.round(averageDurationMinutes * 100) / 100,
            averageScore: Math.round(averageScore * 100) / 100,
            passRate: Math.round(passRate * 100) / 100,
            averageAttemptsPerUser:
                Math.round(averageAttemptsPerUser * 100) / 100,
            firstAttemptSuccessRate:
                Math.round(firstAttemptSuccessRate * 100) / 100,
        };
    }

    private async getTestPerformance(
        testId: number,
        test: Test,
    ): Promise<TestPerformanceDto> {
        // Get score statistics
        const scoreStats = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select('MAX(r.score)', 'highestScore')
            .addSelect('MIN(r.score)', 'lowestScore')
            .addSelect('STDDEV(r.score)', 'scoreStdDev')
            .getRawOne();

        const highestScore = Number(scoreStats?.highestScore || 0);
        const lowestScore = Number(scoreStats?.lowestScore || 0);
        const scoreStandardDeviation = Number(scoreStats?.scoreStdDev || 0);

        // Find most challenging and easiest questions
        const questionStats = await this.answerRepository
            .createQueryBuilder('a')
            .innerJoin('a.question', 'q')
            .innerJoin('a.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select('q.questionId', 'questionId')
            .addSelect('q.text', 'questionText')
            .addSelect('COUNT(*)', 'totalAnswers')
            .addSelect(
                'COUNT(CASE WHEN a.isCorrect = true THEN 1 END)',
                'correctAnswers',
            )
            .groupBy('q.questionId, q.text')
            .having('COUNT(*) > 0')
            .getRawMany();

        let mostChallengingQuestion = undefined;
        let easiestQuestion = undefined;
        let lowestSuccessRate = 100;
        let highestSuccessRate = 0;

        for (const question of questionStats) {
            const successRate =
                (Number(question.correctAnswers) /
                    Number(question.totalAnswers)) *
                100;
            if (successRate < lowestSuccessRate) {
                lowestSuccessRate = successRate;
                mostChallengingQuestion = question.questionText;
            }
            if (successRate > highestSuccessRate) {
                highestSuccessRate = successRate;
                easiestQuestion = question.questionText;
            }
        }

        // Calculate average time per question
        const avgTimeResult = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'AVG(TIMESTAMPDIFF(SECOND, ta.startTime, ta.submitTime))',
                'avgSeconds',
            )
            .getRawOne();

        // Get question count for this test
        const questionCount = await this.questionRepository.count({
            where: { testId },
        });

        const averageTimePerQuestion =
            questionCount > 0
                ? Number(avgTimeResult?.avgSeconds || 0) / questionCount
                : 0;

        return {
            testId,
            testTitle: test.title,
            testType: test.testType || 'UNKNOWN',
            highestScore,
            lowestScore,
            scoreStandardDeviation:
                Math.round(scoreStandardDeviation * 100) / 100,
            mostChallengingQuestion,
            easiestQuestion,
            averageTimePerQuestion:
                Math.round(averageTimePerQuestion * 100) / 100,
        };
    }

    private async getTestQuality(testId: number): Promise<TestQualityDto> {
        // Calculate difficulty score (inverse of average score)
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const avgScore = Number(avgScoreResult?.avgScore || 50);
        const difficultyScore = 100 - avgScore; // Inverse relationship

        // Calculate reliability coefficient (simplified Cronbach's alpha estimation)
        const results = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select(['r.score'])
            .getMany();

        let reliabilityCoefficient = 0.5; // Default moderate reliability
        if (results.length > 1) {
            const scores = results.map(r => r.score);
            const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
            const variance =
                scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
                scores.length;
            // Simplified reliability estimate
            reliabilityCoefficient = Math.min(
                1,
                Math.max(0, variance > 0 ? 1 - 1 / variance : 0.5),
            );
        }

        // Calculate discrimination index (how well test distinguishes performance)
        const discriminationIndex = reliabilityCoefficient; // Simplified

        // Calculate effective questions percentage
        const questionStats = await this.answerRepository
            .createQueryBuilder('a')
            .innerJoin('a.question', 'q')
            .innerJoin('a.attempt', 'ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .select('q.questionId', 'questionId')
            .addSelect('COUNT(*)', 'totalAnswers')
            .addSelect(
                'COUNT(CASE WHEN a.isCorrect = true THEN 1 END)',
                'correctAnswers',
            )
            .groupBy('q.questionId')
            .having('COUNT(*) > 0')
            .getRawMany();

        const effectiveQuestions = questionStats.filter(q => {
            const successRate =
                (Number(q.correctAnswers) / Number(q.totalAnswers)) * 100;
            return successRate >= 20 && successRate <= 80; // Good discrimination range
        });

        const effectiveQuestionsPercentage =
            questionStats.length > 0
                ? (effectiveQuestions.length / questionStats.length) * 100
                : 0;

        // Calculate optimal duration
        const avgDurationResult = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'AVG(TIMESTAMPDIFF(SECOND, ta.startTime, ta.submitTime))',
                'avgSeconds',
            )
            .getRawOne();

        const optimalDurationMinutes = Math.round(
            Number(avgDurationResult?.avgSeconds || 3600) / 60,
        ); // Default 1 hour

        // Determine time pressure factor
        const completionTimes = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.status = :status', {
                status: AttemptStatus.SUBMITTED,
            })
            .andWhere('ta.submitTime IS NOT NULL')
            .select(
                'TIMESTAMPDIFF(SECOND, ta.startTime, ta.submitTime)',
                'duration',
            )
            .getRawMany();

        let timePressureFactor = 'moderate';
        if (completionTimes.length > 0) {
            const durations = completionTimes.map(ct => Number(ct.duration));
            const avgDuration =
                durations.reduce((a, b) => a + b, 0) / durations.length;
            const variance =
                durations.reduce(
                    (a, b) => a + Math.pow(b - avgDuration, 2),
                    0,
                ) / durations.length;
            const stdDev = Math.sqrt(variance);

            // Low variance suggests time pressure
            if (stdDev < avgDuration * 0.2) {
                timePressureFactor = 'high';
            } else if (stdDev > avgDuration * 0.5) {
                timePressureFactor = 'low';
            }
        }

        return {
            difficultyScore:
                Math.round(Math.max(0, Math.min(100, difficultyScore)) * 100) /
                100,
            reliabilityCoefficient:
                Math.round(reliabilityCoefficient * 100) / 100,
            discriminationIndex: Math.round(discriminationIndex * 100) / 100,
            effectiveQuestionsPercentage:
                Math.round(effectiveQuestionsPercentage * 100) / 100,
            optimalDurationMinutes,
            timePressureFactor,
        };
    }

    async getGlobalTestStats(): Promise<GlobalTestStatsDto> {
        const cacheKey = 'global_test_stats';

        const cachedData =
            await this.cacheManager.get<GlobalTestStatsDto>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Total tests
        const totalTests = await this.testRepository.count();

        // Total attempts
        const totalAttempts = await this.testAttemptRepository.count();

        // Tests taken today
        const testsToday = await this.testAttemptRepository.count({
            where: {
                createdAt: oneDayAgo,
            },
        });

        // Tests taken this week
        const testsThisWeek = await this.testAttemptRepository.count({
            where: {
                createdAt: oneWeekAgo,
            },
        });

        // Average completion rate
        const completionStats = await this.testRepository
            .createQueryBuilder('t')
            .leftJoin('t.testAttempts', 'ta')
            .select('t.testId')
            .addSelect('COUNT(ta.attemptId)', 'totalAttempts')
            .addSelect(
                'COUNT(CASE WHEN ta.status = :submitted THEN 1 END)',
                'completedAttempts',
            )
            .setParameter('submitted', AttemptStatus.SUBMITTED)
            .groupBy('t.testId')
            .having('COUNT(ta.attemptId) > 0')
            .getRawMany();

        const averageCompletionRate =
            completionStats.length > 0
                ? completionStats.reduce((sum, test) => {
                      const rate =
                          (Number(test.completedAttempts) /
                              Number(test.totalAttempts)) *
                          100;
                      return sum + rate;
                  }, 0) / completionStats.length
                : 0;

        // Average score across all tests
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.status = :status', { status: AttemptStatus.SUBMITTED })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const averageScore = Number(avgScoreResult?.avgScore || 0);

        // Most popular test type
        const testTypeStats = await this.testRepository
            .createQueryBuilder('t')
            .select('t.testType', 'testType')
            .addSelect('COUNT(*)', 'count')
            .groupBy('t.testType')
            .orderBy('count', 'DESC')
            .limit(1)
            .getRawOne();

        const mostPopularTestType = testTypeStats?.testType || 'UNKNOWN';

        // Peak testing hours
        const hourlyStats = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .select('HOUR(ta.startTime)', 'hour')
            .addSelect('COUNT(*)', 'count')
            .groupBy('HOUR(ta.startTime)')
            .orderBy('count', 'DESC')
            .limit(3)
            .getRawMany();

        const peakTestingHours = hourlyStats.map(stat =>
            parseInt(String(stat.hour)),
        );

        const globalStats: GlobalTestStatsDto = {
            totalTests,
            totalAttempts,
            testsToday,
            testsThisWeek,
            averageCompletionRate:
                Math.round(averageCompletionRate * 100) / 100,
            averageScore: Math.round(averageScore * 100) / 100,
            mostPopularTestType,
            peakTestingHours,
        };

        // Cache for 3 hours
        await this.cacheManager.set(cacheKey, globalStats, 10800);

        return globalStats;
    }

    async getTestAttemptTrends(testId: number): Promise<any> {
        const cacheKey = `test_attempt_trends_${testId}`;

        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Get attempt trends over the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const trendData = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .where('ta.testId = :testId', { testId })
            .andWhere('ta.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
            .select('DATE(ta.createdAt)', 'date')
            .addSelect('COUNT(*)', 'attempts')
            .addSelect(
                'COUNT(CASE WHEN ta.status = :submitted THEN 1 END)',
                'completed',
            )
            .setParameter('submitted', AttemptStatus.SUBMITTED)
            .groupBy('DATE(ta.createdAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        // Cache for 30 minutes
        await this.cacheManager.set(cacheKey, trendData, 1800);

        return trendData;
    }
}
