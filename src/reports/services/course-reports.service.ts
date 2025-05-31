import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    ) {}

    async getCourseAnalytics(
        courseId: number,
        scope?: OrgBranchScope,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        userId?: string,
    ): Promise<CourseAnalyticsResponseDto> {
        // TODO: Implement org/branch scoping validation here in the future
        // For now, we'll use the courseId as provided
        const cacheKey = `course_analytics_${courseId}_${scope?.orgId || 'global'}_${scope?.branchId || 'global'}`;

        // Try to get from cache first
        const cachedData =
            await this.cacheManager.get<CourseAnalyticsResponseDto>(cacheKey);

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Generate fresh analytics data
        const [stats, performance] = await Promise.all([
            this.getCourseStats(courseId),
            this.getCoursePerformance(courseId),
        ]);

        const analyticsData: CourseAnalyticsResponseDto = {
            stats,
            performance,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 1 hour (3600 seconds)
        await this.cacheManager.set(cacheKey, analyticsData, 3600);

        return analyticsData;
    }

    private async getCourseStats(courseId: number): Promise<CourseStatsDto> {
        // Get basic course info
        const course = await this.courseRepository.findOne({
            where: { courseId },
            relations: ['tests'],
        });

        if (!course) {
            throw new Error(`Course with ID ${courseId} not found`);
        }

        // Get total students enrolled (count unique users who attempted tests in this course)
        const totalStudentsEnrolled = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('COUNT(DISTINCT ta.userId)', 'count')
            .getRawOne()
            .then(
                (result: { count: string } | undefined) =>
                    parseInt(result?.count || '0') || 0,
            );

        // Get completion rate (students who completed all tests vs total enrolled)
        const totalTests = course.tests?.length || 0;
        let completionRate = 0;

        if (totalTests > 0 && totalStudentsEnrolled > 0) {
            const completedStudents = await this.testAttemptRepository
                .createQueryBuilder('ta')
                .innerJoin('ta.test', 't')
                .where('t.courseId = :courseId', { courseId })
                .andWhere('ta.status = :status', { status: 'submitted' })
                .groupBy('ta.userId')
                .having('COUNT(DISTINCT t.testId) = :totalTests', {
                    totalTests,
                })
                .select('ta.userId')
                .getCount();

            completionRate = (completedStudents / totalStudentsEnrolled) * 100;
        }

        // Calculate average study duration (time between first and last attempt per user)
        const avgStudyDuration = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('ta.userId')
            .addSelect('MIN(ta.startTime)', 'firstAttempt')
            .addSelect('MAX(ta.submitTime)', 'lastAttempt')
            .groupBy('ta.userId')
            .having('MAX(ta.submitTime) IS NOT NULL')
            .getRawMany();

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

        // Calculate popularity score (weighted by enrollments and completion rate)
        const popularityScore = Math.min(
            100,
            totalStudentsEnrolled * 0.7 + completionRate * 0.3,
        );

        // Get average test score
        const avgScore = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .innerJoin('ta.results', 'r')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.status = :status', { status: 'submitted' })
            .select('AVG(r.score)', 'avgScore')
            .getRawOne();

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
    ): Promise<CoursePerformanceDto> {
        const course = await this.courseRepository.findOne({
            where: { courseId },
        });

        if (!course) {
            throw new Error(`Course with ID ${courseId} not found`);
        }

        // Get total attempts
        const totalAttempts = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .getCount();

        // Get first attempt success rate
        const firstAttemptSuccess = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .innerJoin('ta.results', 'r')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.attemptNumber = 1')
            .andWhere('ta.status = :status', { status: 'submitted' })
            .andWhere('r.score >= 70') // Assuming 70% is passing
            .getCount();

        const totalFirstAttempts = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .andWhere('ta.attemptNumber = 1')
            .getCount();

        const firstAttemptSuccessRate =
            totalFirstAttempts > 0
                ? (firstAttemptSuccess / totalFirstAttempts) * 100
                : 0;

        // Get average attempts per student
        const attemptsPerStudent = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('ta.userId')
            .addSelect('COUNT(*)', 'attemptCount')
            .groupBy('ta.userId')
            .getRawMany();

        const averageAttemptsPerStudent =
            attemptsPerStudent.length > 0
                ? attemptsPerStudent.reduce(
                      (sum, student) => sum + parseInt(student.attemptCount),
                      0,
                  ) / attemptsPerStudent.length
                : 0;

        // Find most challenging test (lowest success rate)
        const testSuccessRates = await this.testRepository
            .createQueryBuilder('t')
            .leftJoin('t.testAttempts', 'ta')
            .leftJoin('ta.results', 'r')
            .where('t.courseId = :courseId', { courseId })
            .select('t.title')
            .addSelect('COUNT(ta.attemptId)', 'totalAttempts')
            .addSelect(
                'COUNT(CASE WHEN r.score >= 70 THEN 1 END)',
                'successfulAttempts',
            )
            .groupBy('t.testId, t.title')
            .having('COUNT(ta.attemptId) > 0')
            .getRawMany();

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
        const cacheKey = `course_enrollment_${courseId}`;

        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Get enrollment trends over time
        const enrollmentData = await this.testAttemptRepository
            .createQueryBuilder('ta')
            .innerJoin('ta.test', 't')
            .where('t.courseId = :courseId', { courseId })
            .select('DATE(ta.createdAt)', 'date')
            .addSelect('COUNT(DISTINCT ta.userId)', 'newEnrollments')
            .groupBy('DATE(ta.createdAt)')
            .orderBy('date', 'ASC')
            .getRawMany();

        // Cache for 30 minutes
        await this.cacheManager.set(cacheKey, enrollmentData, 1800);

        return enrollmentData;
    }

    async getAllCoursesPopularityRanking(): Promise<any> {
        const cacheKey = 'courses_popularity_global';

        const cachedData = await this.cacheManager.get(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        const popularityCourses = await this.courseRepository
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
            .limit(10)
            .getRawMany();

        // Cache for 6 hours
        await this.cacheManager.set(cacheKey, popularityCourses, 21600);

        return popularityCourses;
    }
}
