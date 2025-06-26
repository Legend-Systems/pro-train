import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Result } from '../../results/entities/result.entity';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';
import { Test } from '../../test/entities/test.entity';
import { Course } from '../../course/entities/course.entity';
import { Branch } from '../../branch/entities/branch.entity';
import {
    ResultsAnalyticsReportDto,
    ResultsStatsReportDto,
    ResultsPerformanceReportDto,
    ResultsQualityReportDto,
    GlobalResultsStatsReportDto,
    ScoreDistributionReportDto,
    PerformanceTrendReportDto,
    EnhancedPerformanceTrendReportDto,
    TrendFilterDto,
    BranchPerformanceComparisonDto,
} from '../dto/results-analytics.dto';

@Injectable()
export class ResultsReportsService {
    constructor(
        @InjectRepository(Result)
        private resultRepository: Repository<Result>,
        @InjectRepository(TestAttempt)
        private testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Test)
        private testRepository: Repository<Test>,
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
    ) {}

    async getResultsAnalytics(
        userId: string,
    ): Promise<ResultsAnalyticsReportDto> {
        const cacheKey = `results_analytics_${userId}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<ResultsAnalyticsReportDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Generate fresh analytics data
        const [stats, performance, quality] = await Promise.all([
            this.getResultsStats(userId),
            this.getResultsPerformance(userId),
            this.getResultsQuality(userId),
        ]);

        const analyticsData: ResultsAnalyticsReportDto = {
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

    async getCourseResultsAnalytics(
        courseId: number,
    ): Promise<ResultsAnalyticsReportDto> {
        const cacheKey = `course_results_${courseId}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<ResultsAnalyticsReportDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Verify course exists
        const course = await this.courseRepository.findOne({
            where: { courseId },
        });

        if (!course) {
            throw new Error(`Course with ID ${courseId} not found`);
        }

        // Generate fresh analytics data for course
        const [stats, performance, quality] = await Promise.all([
            this.getCourseResultsStats(courseId),
            this.getCourseResultsPerformance(courseId),
            this.getCourseResultsQuality(courseId),
        ]);

        const analyticsData: ResultsAnalyticsReportDto = {
            stats,
            performance,
            quality,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 45 minutes (2700 seconds)
        await this.cacheManager.set(cacheKey, analyticsData, 2700);

        return analyticsData;
    }

    async getGlobalResultsStats(): Promise<GlobalResultsStatsReportDto> {
        const cacheKey = 'global_results_stats';

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<GlobalResultsStatsReportDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Total results
        const totalResults = await this.resultRepository.count();

        // Passed vs Failed
        const passedResults = await this.resultRepository.count({
            where: { passed: true },
        });
        const failedResults = totalResults - passedResults;

        // Overall average score
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const overallAverageScore = Number(avgScoreResult?.avgScore || 0);

        // Score distribution
        const scoreDistribution = await this.getGlobalScoreDistribution();

        // Recent performance trends (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.submitTime >= :thirtyDaysAgo', { thirtyDaysAgo })
            .getCount();

        // Top performing courses (by average score)
        const topCourses = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .innerJoin('t.course', 'c')
            .select('c.courseId', 'courseId')
            .addSelect('c.title', 'title')
            .addSelect('AVG(r.score)', 'averageScore')
            .addSelect('COUNT(r.resultId)', 'totalResults')
            .groupBy('c.courseId, c.title')
            .having('COUNT(r.resultId) >= 10') // Only courses with at least 10 results
            .orderBy('AVG(r.score)', 'DESC')
            .limit(5)
            .getRawMany();

        const statsData: GlobalResultsStatsReportDto = {
            totalResults,
            passedResults,
            failedResults,
            passRate:
                totalResults > 0 ? (passedResults / totalResults) * 100 : 0,
            overallAverageScore: Math.round(overallAverageScore * 100) / 100,
            scoreDistribution,
            recentResults,
            topPerformingCourses: topCourses.map(course => ({
                courseId: course.courseId,
                title: course.title,
                averageScore:
                    Math.round(Number(course.averageScore) * 100) / 100,
                totalResults: Number(course.totalResults),
            })),
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 3 hours (10800 seconds)
        await this.cacheManager.set(cacheKey, statsData, 10800);

        return statsData;
    }

    async getPerformanceTrends(
        userId?: string,
        courseId?: number,
    ): Promise<PerformanceTrendReportDto[]> {
        const cacheKey = `performance_trends_${userId || 'global'}_${courseId || 'all'}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<PerformanceTrendReportDto[]>(cacheKey);

        if (cachedData) {
            return cachedData;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let query = this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.submitTime >= :thirtyDaysAgo', { thirtyDaysAgo });

        if (userId) {
            query = query.andWhere('ta.userId = :userId', { userId });
        }

        if (courseId) {
            query = query
                .innerJoin('ta.test', 't')
                .andWhere('t.courseId = :courseId', { courseId });
        }

        const trends = await query
            .select('DATE(ta.submitTime)', 'date')
            .addSelect('AVG(r.score)', 'averageScore')
            .addSelect('COUNT(r.resultId)', 'totalResults')
            .addSelect(
                'COUNT(CASE WHEN r.passed = true THEN 1 END)',
                'passedResults',
            )
            .groupBy('DATE(ta.submitTime)')
            .orderBy('DATE(ta.submitTime)', 'ASC')
            .getRawMany();

        const trendsData: PerformanceTrendReportDto[] = trends.map(trend => ({
            date: trend.date,
            averageScore: Math.round(Number(trend.averageScore) * 100) / 100,
            totalResults: Number(trend.totalResults),
            passedResults: Number(trend.passedResults),
            passRate:
                Number(trend.totalResults) > 0
                    ? Math.round(
                          (Number(trend.passedResults) /
                              Number(trend.totalResults)) *
                              100 *
                              100,
                      ) / 100
                    : 0,
        }));

        // Cache the result for 2 hours (7200 seconds)
        await this.cacheManager.set(cacheKey, trendsData, 7200);

        return trendsData;
    }

    /**
     * Enhanced Performance Trends with multi-dimensional filtering
     * Supports: branch, monthly/weekly/daily aggregation, user, test, course
     */
    async getEnhancedPerformanceTrends(
        filters: TrendFilterDto,
    ): Promise<EnhancedPerformanceTrendReportDto[]> {
        const {
            startDate,
            endDate,
            groupBy = 'monthly',
            branchId,
            userId,
            testId,
            courseId,
            includeImprovement = false,
            includeTimingMetrics = false,
        } = filters;

        // Build cache key based on all filters
        const cacheKey = `enhanced_trends_${JSON.stringify(filters)}`;
        
        // Try to get from cache first
        const cachedData = await this.cacheManager.get<EnhancedPerformanceTrendReportDto[]>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Set default date range if not provided
        const defaultEndDate = endDate ? new Date(endDate) : new Date();
        const defaultStartDate = startDate 
            ? new Date(startDate) 
            : new Date(defaultEndDate.getTime() - (365 * 24 * 60 * 60 * 1000)); // 1 year ago

        // Build the main query with proper joins and scoping
        let query = this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .leftJoinAndSelect('r.orgId', 'orgId')
            .leftJoinAndSelect('r.branchId', 'branchId')
            .leftJoinAndSelect('r.test', 'test')
            .leftJoinAndSelect('test.course', 'course')
            .where('ta.submitTime >= :startDate', { startDate: defaultStartDate })
            .andWhere('ta.submitTime <= :endDate', { endDate: defaultEndDate });

        // Apply dimensional filters
        if (branchId) {
            query = query.andWhere('branchId.id = :branchId', { branchId });
        }
        if (userId) {
            query = query.andWhere('r.userId = :userId', { userId });
        }
        if (testId) {
            query = query.andWhere('r.testId = :testId', { testId });
        }
        if (courseId) {
            query = query.andWhere('r.courseId = :courseId', { courseId });
        }

        // Determine grouping format based on aggregation type
        let dateFormat: string;
        let orderByFormat: string;
        
        switch (groupBy) {
            case 'daily':
                dateFormat = 'DATE(ta.submitTime)';
                orderByFormat = 'DATE(ta.submitTime)';
                break;
            case 'weekly':
                dateFormat = 'YEARWEEK(ta.submitTime, 1)';
                orderByFormat = 'YEARWEEK(ta.submitTime, 1)';
                break;
            case 'monthly':
            default:
                dateFormat = 'DATE_FORMAT(ta.submitTime, "%Y-%m")';
                orderByFormat = 'DATE_FORMAT(ta.submitTime, "%Y-%m")';
                break;
        }

        // Build select clauses
        const selectClauses = [
            `${dateFormat} as period`,
            'AVG(r.score) as averageScore',
            'COUNT(r.resultId) as totalResults',
            'COUNT(CASE WHEN r.passed = true THEN 1 END) as passedResults',
            'COUNT(CASE WHEN r.passed = false THEN 1 END) as failedResults',
            'COUNT(DISTINCT r.userId) as uniqueUsers',
        ];

        // Add timing metrics if requested
        if (includeTimingMetrics) {
            selectClauses.push(
                'AVG(TIMESTAMPDIFF(MINUTE, ta.startTime, ta.submitTime)) as averageCompletionTime'
            );
        }

        // Add branch/test/course context info
        if (branchId) {
            selectClauses.push('branchId.id as branchId', 'branchId.name as branchName');
        }
        if (testId) {
            selectClauses.push('test.testId as testId', 'test.title as testTitle');
        }
        if (courseId) {
            selectClauses.push('course.courseId as courseId', 'course.title as courseTitle');
        }

        // Apply selections and grouping
        query = query
            .select(selectClauses)
            .groupBy(dateFormat);

        // Add additional grouping for context
        if (branchId) {
            query = query.addGroupBy('branchId.id, branchId.name');
        }
        if (testId) {
            query = query.addGroupBy('test.testId, test.title');
        }
        if (courseId) {
            query = query.addGroupBy('course.courseId, course.title');
        }

        query = query.orderBy(orderByFormat, 'ASC');

        const rawResults = await query.getRawMany();

        // Process and calculate metrics
        const trendsData: EnhancedPerformanceTrendReportDto[] = [];
        
        for (let i = 0; i < rawResults.length; i++) {
            const current = rawResults[i];
            const previous = i > 0 ? rawResults[i - 1] : null;

            // Calculate basic metrics
            const totalResults = Number(current.totalResults) || 0;
            const passedResults = Number(current.passedResults) || 0;
            const failedResults = Number(current.failedResults) || 0;
            const averageScore = Math.round((Number(current.averageScore) || 0) * 100) / 100;
            const passRate = totalResults > 0 ? Math.round((passedResults / totalResults) * 100 * 100) / 100 : 0;

            // Calculate improvements if requested
            let scoreImprovement = 0;
            let passRateImprovement = 0;
            
            if (includeImprovement && previous) {
                const prevAvgScore = Number(previous.averageScore) || 0;
                const prevPassRate = Number(previous.totalResults) > 0 
                    ? (Number(previous.passedResults) / Number(previous.totalResults)) * 100 
                    : 0;
                
                scoreImprovement = Math.round((averageScore - prevAvgScore) * 100) / 100;
                passRateImprovement = Math.round((passRate - prevPassRate) * 100) / 100;
            }

            const trendItem: EnhancedPerformanceTrendReportDto = {
                period: current.period,
                aggregationType: groupBy,
                averageScore,
                medianScore: averageScore, // For now, using avg as median approximation
                totalResults,
                passedResults,
                failedResults,
                passRate,
                uniqueUsers: Number(current.uniqueUsers) || 0,
                totalAttempts: totalResults, // Each result represents one attempt
                scoreImprovement,
                passRateImprovement,
                averageCompletionTime: includeTimingMetrics 
                    ? Math.round((Number(current.averageCompletionTime) || 0) * 100) / 100 
                    : 0,
            };

            // Add contextual information
            if (branchId) {
                trendItem.branchId = current.branchId;
                trendItem.branchName = current.branchName;
            }
            if (testId) {
                trendItem.testId = Number(current.testId);
                trendItem.testTitle = current.testTitle;
            }
            if (courseId) {
                trendItem.courseId = Number(current.courseId);
                trendItem.courseTitle = current.courseTitle;
            }
            if (userId) {
                trendItem.userId = userId;
            }

            trendsData.push(trendItem);
        }

        // Cache the result for 2 hours (7200 seconds)
        await this.cacheManager.set(cacheKey, trendsData, 7200);

        return trendsData;
    }

    /**
     * Get branch performance comparison trends
     */
    async getBranchPerformanceComparison(
        filters: Omit<TrendFilterDto, 'branchId'>
    ): Promise<BranchPerformanceComparisonDto> {
        const cacheKey = `branch_comparison_trends_${JSON.stringify(filters)}`;
        
        // Try to get from cache first
        const cachedData = await this.cacheManager.get<BranchPerformanceComparisonDto>(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Get all active branches first
        const branches = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.branchId', 'branch')
            .select('DISTINCT branch.id', 'branchId')
            .addSelect('branch.name', 'branchName')
            .where('branch.isActive = true')
            .getRawMany();

        // Get trends for each branch
        const branchTrends: EnhancedPerformanceTrendReportDto[] = [];
        const branchAverages: { [branchName: string]: number } = {};

        for (const branch of branches) {
            const branchFilters: TrendFilterDto = {
                ...filters,
                branchId: branch.branchId,
            };

            const trends = await this.getEnhancedPerformanceTrends(branchFilters);
            branchTrends.push(...trends);

            // Calculate branch average score
            if (trends.length > 0) {
                const totalScore = trends.reduce((sum, trend) => sum + trend.averageScore, 0);
                branchAverages[branch.branchName] = totalScore / trends.length;
            }
        }

        // Rank branches by performance
        const sortedBranches = Object.entries(branchAverages)
            .sort(([,a], [,b]) => b - a);

        const branchRankings: { [branchName: string]: number } = {};
        sortedBranches.forEach(([branchName], index) => {
            branchRankings[branchName] = index + 1;
        });

        const result: BranchPerformanceComparisonDto = {
            branchTrends,
            topBranch: sortedBranches[0]?.[0] || 'No data',
            branchRankings,
        };

        // Cache the result for 2 hours (7200 seconds)
        await this.cacheManager.set(cacheKey, result, 7200);

        return result;
    }

    private async getResultsStats(
        userId: string,
    ): Promise<ResultsStatsReportDto> {
        // Total results for user
        const totalResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .getCount();

        // Passed vs Failed
        const passedResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('r.passed = true')
            .getCount();

        const failedResults = totalResults - passedResults;

        // Average score
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const averageScore = Number(avgScoreResult?.avgScore || 0);

        // Best score
        const bestScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .select('MAX(r.score)', 'bestScore')
            .getRawOne();

        const bestScore = Number(bestScoreResult?.bestScore || 0);

        // Recent performance (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .andWhere('ta.submitTime >= :sevenDaysAgo', { sevenDaysAgo })
            .getCount();

        return {
            totalResults,
            passedResults,
            failedResults,
            passRate:
                totalResults > 0 ? (passedResults / totalResults) * 100 : 0,
            averageScore: Math.round(averageScore * 100) / 100,
            bestScore: Math.round(bestScore * 100) / 100,
            recentResults,
        };
    }

    private async getCourseResultsStats(
        courseId: number,
    ): Promise<ResultsStatsReportDto> {
        // Total results for course
        const totalResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .getCount();

        // Passed vs Failed
        const passedResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('r.passed = true')
            .getCount();

        const failedResults = totalResults - passedResults;

        // Average score
        const avgScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const averageScore = Number(avgScoreResult?.avgScore || 0);

        // Best score
        const bestScoreResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('MAX(r.score)', 'bestScore')
            .getRawOne();

        const bestScore = Number(bestScoreResult?.bestScore || 0);

        // Recent results (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.submitTime >= :sevenDaysAgo', { sevenDaysAgo })
            .getCount();

        return {
            totalResults,
            passedResults,
            failedResults,
            passRate:
                totalResults > 0 ? (passedResults / totalResults) * 100 : 0,
            averageScore: Math.round(averageScore * 100) / 100,
            bestScore: Math.round(bestScore * 100) / 100,
            recentResults,
        };
    }

    private async getResultsPerformance(
        userId: string,
    ): Promise<ResultsPerformanceReportDto> {
        // Score trends over time
        const scoreHistory = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .select('DATE(ta.submitTime)', 'date')
            .addSelect('AVG(r.score)', 'averageScore')
            .groupBy('DATE(ta.submitTime)')
            .orderBy('DATE(ta.submitTime)', 'ASC')
            .limit(30) // Last 30 data points
            .getRawMany();

        // Subject performance (based on course performance)
        const subjectPerformance = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .innerJoin('t.course', 'c')
            .where('ta.userId = :userId', { userId })
            .select('c.title', 'subject')
            .addSelect('AVG(r.score)', 'averageScore')
            .addSelect('COUNT(r.resultId)', 'totalAttempts')
            .addSelect(
                'COUNT(CASE WHEN r.passed = true THEN 1 END)',
                'passedAttempts',
            )
            .groupBy('c.courseId, c.title')
            .orderBy('AVG(r.score)', 'DESC')
            .getRawMany();

        // Improvement analysis
        const firstResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .orderBy('ta.submitTime', 'ASC')
            .select('r.score')
            .getOne();

        const lastResult = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .orderBy('ta.submitTime', 'DESC')
            .select('r.score')
            .getOne();

        const improvement =
            firstResult && lastResult
                ? lastResult.score - firstResult.score
                : 0;

        return {
            scoreHistory: scoreHistory.map(sh => ({
                date: sh.date,
                averageScore: Math.round(Number(sh.averageScore) * 100) / 100,
            })),
            subjectPerformance: subjectPerformance.map(sp => ({
                subject: sp.subject,
                averageScore: Math.round(Number(sp.averageScore) * 100) / 100,
                totalAttempts: Number(sp.totalAttempts),
                passRate:
                    Number(sp.totalAttempts) > 0
                        ? Math.round(
                              (Number(sp.passedAttempts) /
                                  Number(sp.totalAttempts)) *
                                  100 *
                                  100,
                          ) / 100
                        : 0,
            })),
            improvement: Math.round(improvement * 100) / 100,
            improvementPercentage: firstResult?.score
                ? Math.round((improvement / firstResult.score) * 100 * 100) /
                  100
                : 0,
        };
    }

    private async getCourseResultsPerformance(
        courseId: number,
    ): Promise<ResultsPerformanceReportDto> {
        // Score trends over time for course
        const scoreHistory = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('DATE(ta.submitTime)', 'date')
            .addSelect('AVG(r.score)', 'averageScore')
            .groupBy('DATE(ta.submitTime)')
            .orderBy('DATE(ta.submitTime)', 'ASC')
            .limit(30) // Last 30 data points
            .getRawMany();

        // Test performance within course
        const testPerformance = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('t.title', 'subject')
            .addSelect('AVG(r.score)', 'averageScore')
            .addSelect('COUNT(r.resultId)', 'totalAttempts')
            .addSelect(
                'COUNT(CASE WHEN r.passed = true THEN 1 END)',
                'passedAttempts',
            )
            .groupBy('t.testId, t.title')
            .orderBy('AVG(r.score)', 'DESC')
            .getRawMany();

        // Overall course improvement over time
        const firstResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .orderBy('ta.submitTime', 'ASC')
            .limit(100)
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const lastResults = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .orderBy('ta.submitTime', 'DESC')
            .limit(100)
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

        const improvement =
            firstResults && lastResults
                ? Number(lastResults.avgScore) - Number(firstResults.avgScore)
                : 0;

        return {
            scoreHistory: scoreHistory.map(sh => ({
                date: sh.date,
                averageScore: Math.round(Number(sh.averageScore) * 100) / 100,
            })),
            subjectPerformance: testPerformance.map(tp => ({
                subject: tp.subject,
                averageScore: Math.round(Number(tp.averageScore) * 100) / 100,
                totalAttempts: Number(tp.totalAttempts),
                passRate:
                    Number(tp.totalAttempts) > 0
                        ? Math.round(
                              (Number(tp.passedAttempts) /
                                  Number(tp.totalAttempts)) *
                                  100 *
                                  100,
                          ) / 100
                        : 0,
            })),
            improvement: Math.round(improvement * 100) / 100,
            improvementPercentage: firstResults
                ? Math.round(
                      (improvement / Number(firstResults.avgScore)) * 100 * 100,
                  ) / 100
                : 0,
        };
    }

    private async getResultsQuality(
        userId: string,
    ): Promise<ResultsQualityReportDto> {
        // Score consistency analysis
        const scores = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .where('ta.userId = :userId', { userId })
            .select('r.score')
            .orderBy('ta.submitTime', 'ASC')
            .getMany();

        const scoreValues = scores.map(s => s.score);
        const standardDeviation = this.calculateStandardDeviation(scoreValues);
        const mean =
            scoreValues.reduce((sum, score) => sum + score, 0) /
            scoreValues.length;

        // Score reliability (lower standard deviation = more reliable)
        const reliability =
            mean > 0 ? Math.max(0, 100 - (standardDeviation / mean) * 100) : 0;

        // Outlier detection
        const outliers = scoreValues.filter(
            score => Math.abs(score - mean) > 2 * standardDeviation,
        );

        // Performance validation
        const expectedDifficulty = 70; // Assuming 70% is the expected average
        const actualPerformance = mean;
        const performanceVariance = Math.abs(
            actualPerformance - expectedDifficulty,
        );

        return {
            scoreConsistency: Math.round((100 - standardDeviation) * 100) / 100,
            reliability: Math.round(reliability * 100) / 100,
            outlierCount: outliers.length,
            performanceVariance: Math.round(performanceVariance * 100) / 100,
            standardDeviation: Math.round(standardDeviation * 100) / 100,
        };
    }

    private async getCourseResultsQuality(
        courseId: number,
    ): Promise<ResultsQualityReportDto> {
        // Score consistency analysis for course
        const scores = await this.resultRepository
            .createQueryBuilder('r')
            .innerJoin('r.attempt', 'ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('r.score')
            .orderBy('ta.submitTime', 'ASC')
            .getMany();

        const scoreValues = scores.map(s => s.score);
        if (scoreValues.length === 0) {
            return {
                scoreConsistency: 0,
                reliability: 0,
                outlierCount: 0,
                performanceVariance: 0,
                standardDeviation: 0,
            };
        }

        const standardDeviation = this.calculateStandardDeviation(scoreValues);
        const mean =
            scoreValues.reduce((sum, score) => sum + score, 0) /
            scoreValues.length;

        // Score reliability (lower standard deviation = more reliable)
        const reliability =
            mean > 0 ? Math.max(0, 100 - (standardDeviation / mean) * 100) : 0;

        // Outlier detection
        const outliers = scoreValues.filter(
            score => Math.abs(score - mean) > 2 * standardDeviation,
        );

        // Performance validation
        const expectedDifficulty = 70; // Assuming 70% is the expected average
        const actualPerformance = mean;
        const performanceVariance = Math.abs(
            actualPerformance - expectedDifficulty,
        );

        return {
            scoreConsistency: Math.round((100 - standardDeviation) * 100) / 100,
            reliability: Math.round(reliability * 100) / 100,
            outlierCount: outliers.length,
            performanceVariance: Math.round(performanceVariance * 100) / 100,
            standardDeviation: Math.round(standardDeviation * 100) / 100,
        };
    }

    private async getGlobalScoreDistribution(): Promise<ScoreDistributionReportDto> {
        const distribution = await this.resultRepository
            .createQueryBuilder('r')
            .select([
                'COUNT(CASE WHEN r.score >= 90 THEN 1 END) as a_grade',
                'COUNT(CASE WHEN r.score >= 80 AND r.score < 90 THEN 1 END) as b_grade',
                'COUNT(CASE WHEN r.score >= 70 AND r.score < 80 THEN 1 END) as c_grade',
                'COUNT(CASE WHEN r.score >= 60 AND r.score < 70 THEN 1 END) as d_grade',
                'COUNT(CASE WHEN r.score < 60 THEN 1 END) as f_grade',
            ])
            .getRawOne();

        return {
            aGrade: Number(distribution.a_grade),
            bGrade: Number(distribution.b_grade),
            cGrade: Number(distribution.c_grade),
            dGrade: Number(distribution.d_grade),
            fGrade: Number(distribution.f_grade),
        };
    }

    private calculateStandardDeviation(values: number[]): number {
        if (values.length === 0) return 0;

        const mean =
            values.reduce((sum, value) => sum + value, 0) / values.length;
        const squaredDifferences = values.map(value =>
            Math.pow(value - mean, 2),
        );
        const averageSquaredDifference =
            squaredDifferences.reduce((sum, diff) => sum + diff, 0) /
            values.length;

        return Math.sqrt(averageSquaredDifference);
    }
}
