import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Course } from '../../course/entities/course.entity';
import { Test } from '../../test/entities/test.entity';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';
import { User } from '../../user/entities/user.entity';
import { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import {
    CourseAnalyticsResponseDto,
    CourseStatsDto,
    CoursePerformanceDto,
} from '../dto/course-analytics.dto';
import { ReportAudienceService } from './report-audience.service';

@Injectable()
export class CourseReportsService {
    constructor(
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
        @InjectRepository(Test)
        private testRepository: Repository<Test>,
        @InjectRepository(TestAttempt)
        private testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
        private readonly reportAudienceService: ReportAudienceService,
    ) {}

    async getCourseAnalytics(
        courseId: number,
        scope?: OrgBranchScope,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        userId?: string,
    ): Promise<CourseAnalyticsResponseDto> {
        const reportOrgId = scope?.orgId ?? (await this.resolveCourseOrgId(courseId));
        const cacheKey = `course_analytics_excl_v1_${courseId}_${reportOrgId || 'global'}_${scope?.branchId || 'global'}`;

        const cachedData =
            await this.cacheManager.get<CourseAnalyticsResponseDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        const [stats, performance] = await Promise.all([
            this.getCourseStats(courseId, reportOrgId),
            this.getCoursePerformance(courseId, reportOrgId),
        ]);

        const analyticsData: CourseAnalyticsResponseDto = {
            stats,
            performance,
            generatedAt: new Date(),
            cached: false,
        };

        await this.cacheManager.set(cacheKey, analyticsData, 3600);

        return analyticsData;
    }

    private async resolveCourseOrgId(courseId: number): Promise<string | null> {
        const row = await this.courseRepository
            .createQueryBuilder('course')
            .leftJoin('course.orgId', 'org')
            .where('course.courseId = :courseId', { courseId })
            .select('org.id', 'orgId')
            .getRawOne<{ orgId: string | null }>();
        return row?.orgId ?? null;
    }

    private async omitAudience<Entity extends ObjectLiteral>(
        query: SelectQueryBuilder<Entity>,
        userIdExpression: string,
        reportOrgId: string | null,
    ): Promise<void> {
        await this.reportAudienceService.omitFromQuery(
            query,
            userIdExpression,
            reportOrgId,
        );
    }

    private async getCourseStats(
        courseId: number,
        reportOrgId: string | null,
    ): Promise<CourseStatsDto> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
            relations: ['tests'],
        });

        if (!course) {
            throw new Error(`Course with ID ${courseId} not found`);
        }

        const enrolledQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('COUNT(DISTINCT ta.userId)', 'count');
        await this.omitAudience(enrolledQuery, 'ta.userId', reportOrgId);
        const totalStudentsEnrolled = await enrolledQuery
            .getRawOne()
            .then(
                (result: { count: string } | undefined) =>
                    parseInt(result?.count || '0') || 0,
            );

        const totalTests = course.tests?.length || 0;
        let completionRate = 0;

        if (totalTests > 0 && totalStudentsEnrolled > 0) {
            const completedQuery = this.testAttemptRepository
                .createQueryBuilder('ta')
                .innerJoin('ta.test', 't')
                .where('t.courseId = :courseId', { courseId })
                .andWhere('ta.status = :status', { status: 'submitted' })
                .groupBy('ta.userId')
                .having('COUNT(DISTINCT t.testId) = :totalTests', {
                    totalTests,
                })
                .select('ta.userId');
            await this.omitAudience(completedQuery, 'ta.userId', reportOrgId);
            const completedStudents = await completedQuery.getCount();

            completionRate = (completedStudents / totalStudentsEnrolled) * 100;
        }

        const avgStudyQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('ta.userId')
            .addSelect('MIN(ta.startTime)', 'firstAttempt')
            .addSelect('MAX(ta.submitTime)', 'lastAttempt')
            .groupBy('ta.userId')
            .having('MAX(ta.submitTime) IS NOT NULL');
        await this.omitAudience(avgStudyQuery, 'ta.userId', reportOrgId);
        const avgStudyDuration = await avgStudyQuery.getRawMany();

        let averageStudyDurationHours = 0;
        if (avgStudyDuration.length > 0) {
            const totalHours = avgStudyDuration.reduce(
                (
                    sum: number,
                    student: { lastAttempt: string; firstAttempt: string },
                ) => {
                    const duration =
                        (new Date(student.lastAttempt).getTime() -
                            new Date(student.firstAttempt).getTime()) /
                        (1000 * 60 * 60);
                    return sum + duration;
                },
                0,
            );
            averageStudyDurationHours = totalHours / avgStudyDuration.length;
        }

        const popularityScore = Math.min(
            100,
            totalStudentsEnrolled * 0.7 + completionRate * 0.3,
        );

        const avgScoreQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .innerJoin('ta.results', 'r')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.status = :status', { status: 'submitted' })
            .select('AVG(r.score)', 'avgScore');
        await this.omitAudience(avgScoreQuery, 'ta.userId', reportOrgId);
        const avgScore = await avgScoreQuery.getRawOne();

        return {
            totalStudentsEnrolled,
            completionRate: Math.round(completionRate * 100) / 100,
            averageStudyDurationHours:
                Math.round(averageStudyDurationHours * 100) / 100,
            popularityScore: Math.round(popularityScore * 100) / 100,
            totalTests,
            averageTestScore: Math.round((avgScore?.avgScore || 0) * 100) / 100,
        };
    }

    private async getCoursePerformance(
        courseId: number,
        reportOrgId: string | null,
    ): Promise<CoursePerformanceDto> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
        });

        if (!course) {
            throw new Error(`Course with ID ${courseId} not found`);
        }

        const totalAttemptsQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId });
        await this.omitAudience(totalAttemptsQuery, 'ta.userId', reportOrgId);
        const totalAttempts = await totalAttemptsQuery.getCount();

        const firstAttemptSuccessQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .innerJoin('ta.results', 'r')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.attemptNumber = 1')
            .andWhere('ta.status = :status', { status: 'submitted' })
            .andWhere('r.passed = true');
        await this.omitAudience(
            firstAttemptSuccessQuery,
            'ta.userId',
            reportOrgId,
        );
        const firstAttemptSuccess = await firstAttemptSuccessQuery.getCount();

        const totalFirstAttemptsQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.attemptNumber = 1');
        await this.omitAudience(
            totalFirstAttemptsQuery,
            'ta.userId',
            reportOrgId,
        );
        const totalFirstAttempts = await totalFirstAttemptsQuery.getCount();

        const firstAttemptSuccessRate =
            totalFirstAttempts > 0
                ? (firstAttemptSuccess / totalFirstAttempts) * 100
                : 0;

        const attemptsPerStudentQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('ta.userId')
            .addSelect('COUNT(*)', 'attemptCount')
            .groupBy('ta.userId');
        await this.omitAudience(
            attemptsPerStudentQuery,
            'ta.userId',
            reportOrgId,
        );
        const attemptsPerStudent = await attemptsPerStudentQuery.getRawMany();

        const averageAttemptsPerStudent =
            attemptsPerStudent.length > 0
                ? attemptsPerStudent.reduce(
                      (sum, student) => sum + parseInt(student.attemptCount),
                      0,
                  ) / attemptsPerStudent.length
                : 0;

        const testSuccessRatesQuery = this.testRepository
            .createQueryBuilder('t')
            .leftJoin('t.testAttempts', 'ta')
            .leftJoin('ta.results', 'r')
            .where('t.courseId = :courseId', { courseId })
            .select('t.title')
            .addSelect('COUNT(ta.attemptId)', 'totalAttempts')
            .addSelect(
                'COUNT(CASE WHEN r.passed = true THEN 1 END)',
                'successfulAttempts',
            )
            .groupBy('t.testId, t.title')
            .having('COUNT(ta.attemptId) > 0');
        await this.omitAudience(testSuccessRatesQuery, 'ta.userId', reportOrgId);
        const testSuccessRates = await testSuccessRatesQuery.getRawMany();

        let mostChallengingTest = undefined;
        let lowestSuccessRate = 100;

        for (const test of testSuccessRates) {
            const successRate =
                (test.successfulAttempts / test.totalAttempts) * 100;
            if (successRate < lowestSuccessRate) {
                lowestSuccessRate = successRate;
                mostChallengingTest = test.title;
            }
        }

        return {
            courseId,
            courseTitle: course.title,
            totalAttempts,
            firstAttemptSuccessRate:
                Math.round(firstAttemptSuccessRate * 100) / 100,
            averageAttemptsPerStudent:
                Math.round(averageAttemptsPerStudent * 100) / 100,
            mostChallengingTest,
        };
    }

    async getCourseEnrollmentStats(courseId: number): Promise<any> {
        const reportOrgId = await this.resolveCourseOrgId(courseId);
        const cacheKey = `course_enrollment_excl_v1_${courseId}_${reportOrgId || 'global'}`;

        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const enrollmentQuery = this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('DATE(ta.createdAt)', 'date')
            .addSelect('COUNT(DISTINCT ta.userId)', 'newEnrollments')
            .groupBy('DATE(ta.createdAt)')
            .orderBy('date', 'ASC');
        await this.omitAudience(enrollmentQuery, 'ta.userId', reportOrgId);
        const enrollmentData = await enrollmentQuery.getRawMany();

        await this.cacheManager.set(cacheKey, enrollmentData, 1800);

        return enrollmentData;
    }

    async getAllCoursesPopularityRanking(): Promise<any> {
        const cacheKey = 'courses_popularity_global_excl_v1';

        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const popularityQuery = this.courseRepository
            .createQueryBuilder('c')
            .leftJoin('c.tests', 't')
            .leftJoin('t.testAttempts', 'ta')
            .select('c.courseId')
            .addSelect('c.title')
            .addSelect('COUNT(DISTINCT ta.userId)', 'enrollments')
            .addSelect('COUNT(DISTINCT ta.attemptId)', 'totalAttempts')
            .groupBy('c.courseId, c.title')
            .orderBy('enrollments', 'DESC')
            .addOrderBy('totalAttempts', 'DESC')
            .limit(10);
        await this.omitAudience(popularityQuery, 'ta.userId', null);
        const popularityCourses = await popularityQuery.getRawMany();

        await this.cacheManager.set(cacheKey, popularityCourses, 21600);

        return popularityCourses;
    }
}
