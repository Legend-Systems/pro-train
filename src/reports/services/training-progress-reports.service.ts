import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TrainingProgress } from '../../training_progress/entities/training_progress.entity';
import { Result } from '../../results/entities/result.entity';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';
import { User } from '../../user/entities/user.entity';
import { Course } from '../../course/entities/course.entity';
import { Test } from '../../test/entities/test.entity';
import {
    TrainingProgressAnalyticsReportDto,
    TrainingProgressStatsReportDto,
    TrainingProgressPerformanceReportDto,
    GlobalTrainingProgressStatsReportDto,
    LearningPathCompletionReportDto,
    SkillDevelopmentReportDto,
    ProgressMilestoneReportDto,
} from '../dto/training-progress-analytics.dto';

@Injectable()
export class TrainingProgressReportsService {
    constructor(
        @InjectRepository(TrainingProgress)
        private trainingProgressRepository: Repository<TrainingProgress>,
        @InjectRepository(Result)
        private resultRepository: Repository<Result>,
        @InjectRepository(TestAttempt)
        private testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Course)
        private courseRepository: Repository<Course>,
        @InjectRepository(Test)
        private testRepository: Repository<Test>,
        @Inject(CACHE_MANAGER)
        private cacheManager: Cache,
    ) {}

    async getTrainingProgressAnalytics(
        userId: string,
        courseId?: number,
    ): Promise<TrainingProgressAnalyticsReportDto> {
        const cacheKey = `training_progress_analytics_${userId}_${courseId || 'all'}`;

        // Try to get from cache first
        const cachedData = await this.cacheManager.get<TrainingProgressAnalyticsReportDto>(
            cacheKey,
        );

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Generate fresh analytics data
        const [stats, performance] = await Promise.all([
            this.getTrainingProgressStats(userId, courseId),
            this.getTrainingProgressPerformance(userId, courseId),
        ]);

        const analyticsData: TrainingProgressAnalyticsReportDto = {
            stats,
            performance,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 30 minutes (1800 seconds)
        await this.cacheManager.set(cacheKey, analyticsData, 1800);

        return analyticsData;
    }

    async getGlobalTrainingProgressStats(): Promise<GlobalTrainingProgressStatsReportDto> {
        const cacheKey = 'global_training_progress_stats';

        // Try to get from cache first
        const cachedData = await this.cacheManager.get<GlobalTrainingProgressStatsReportDto>(
            cacheKey,
        );

        if (cachedData) {
            return {
                ...cachedData,
                cached: true,
            };
        }

        // Total learning paths
        const totalLearningPaths = await this.trainingProgressRepository.count();

        // Average completion percentage
        const avgCompletionResult = await this.trainingProgressRepository
            .createQueryBuilder('tp')
            .select('AVG(tp.completionPercentage)', 'avgCompletion')
            .getRawOne();

        const averageCompletion = Number(avgCompletionResult?.avgCompletion || 0);

        // Active learners (progress updated in last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const activeLearners = await this.trainingProgressRepository
            .createQueryBuilder('tp')
            .where('tp.lastUpdated >= :sevenDaysAgo', { sevenDaysAgo })
            .select('COUNT(DISTINCT tp.userId)')
            .getRawOne();

        // Completion distribution
        const completionDistribution = await this.trainingProgressRepository
            .createQueryBuilder('tp')
            .select([
                'COUNT(CASE WHEN tp.completionPercentage = 100 THEN 1 END) as completed',
                'COUNT(CASE WHEN tp.completionPercentage >= 75 AND tp.completionPercentage < 100 THEN 1 END) as nearly_completed',
                'COUNT(CASE WHEN tp.completionPercentage >= 50 AND tp.completionPercentage < 75 THEN 1 END) as halfway',
                'COUNT(CASE WHEN tp.completionPercentage >= 25 AND tp.completionPercentage < 50 THEN 1 END) as started',
                'COUNT(CASE WHEN tp.completionPercentage < 25 THEN 1 END) as just_started',
            ])
            .getRawOne();

        // Most popular learning paths
        const popularPaths = await this.trainingProgressRepository
            .createQueryBuilder('tp')
            .innerJoin('tp.course', 'c')
            .select('c.courseId', 'courseId')
            .addSelect('c.title', 'title')
            .addSelect('COUNT(tp.userId)', 'enrollments')
            .addSelect('AVG(tp.completionPercentage)', 'averageCompletion')
            .groupBy('c.courseId, c.title')
            .orderBy('COUNT(tp.userId)', 'DESC')
            .limit(5)
            .getRawMany();

        // Learning velocity trends
        const velocityTrends = await this.getGlobalLearningVelocity();

        const statsData: GlobalTrainingProgressStatsReportDto = {
            totalLearningPaths,
            averageCompletion: Math.round(averageCompletion * 100) / 100,
            activeLearners: Number(activeLearners?.count || 0),
            completionDistribution: {
                completed: Number(completionDistribution.completed),
                nearlyCompleted: Number(completionDistribution.nearly_completed),
                halfway: Number(completionDistribution.halfway),
                started: Number(completionDistribution.started),
                justStarted: Number(completionDistribution.just_started),
            },
            popularLearningPaths: popularPaths.map((path) => ({
                courseId: path.courseId,
                title: path.title,
                enrollments: Number(path.enrollments),
                averageCompletion: Math.round(Number(path.averageCompletion) * 100) / 100,
            })),
            learningVelocityTrends: velocityTrends,
            generatedAt: new Date(),
            cached: false,
        };

        // Cache the result for 2 hours (7200 seconds)
        await this.cacheManager.set(cacheKey, statsData, 7200);

        return statsData;
    }

    async getLearningPathCompletion(
        userId?: string,
        courseId?: number,
    ): Promise<LearningPathCompletionReportDto[]> {
        const cacheKey = `learning_path_completion_${userId || 'global'}_${courseId || 'all'}`;

        // Try to get from cache first
        const cachedData = await this.cacheManager.get<LearningPathCompletionReportDto[]>(
            cacheKey,
        );

        if (cachedData) {
            return cachedData;
        }

        let query = this.trainingProgressRepository
            .createQueryBuilder('tp')
            .innerJoin('tp.course', 'c')
            .select('c.courseId', 'courseId')
            .addSelect('c.title', 'title')
            .addSelect('tp.completionPercentage', 'completionPercentage')
            .addSelect('tp.currentModule', 'currentModule')
            .addSelect('tp.lastUpdated', 'lastUpdated')
            .addSelect('tp.timeSpentMinutes', 'timeSpentMinutes');

        if (userId) {
            query = query.where('tp.userId = :userId', { userId });
        }

        if (courseId) {
            const condition = userId ? 'AND' : 'WHERE';
            query = query.where(`${condition} tp.courseId = :courseId`, { courseId });
        }

        const completions = await query
            .orderBy('tp.completionPercentage', 'DESC')
            .getRawMany();

        const learningPaths: LearningPathCompletionReportDto[] = completions.map((completion) => ({
            courseId: completion.courseId,
            title: completion.title,
            completionPercentage: Number(completion.completionPercentage),
            currentModule: completion.currentModule,
            timeSpent: Number(completion.timeSpentMinutes || 0),
            lastActivity: completion.lastUpdated,
            estimatedTimeToComplete: this.calculateEstimatedTimeToComplete(
                Number(completion.completionPercentage),
                Number(completion.timeSpentMinutes || 0),
            ),
        }));

        // Cache the result for 45 minutes (2700 seconds)
        await this.cacheManager.set(cacheKey, learningPaths, 2700);

        return learningPaths;
    }

    async getSkillDevelopment(
        userId: string,
        courseId?: number,
    ): Promise<SkillDevelopmentReportDto[]> {
        const cacheKey = `skill_development_${userId}_${courseId || 'all'}`;

        // Try to get from cache first
        const cachedData = await this.cacheManager.get<SkillDevelopmentReportDto[]>(
            cacheKey,
        );

        if (cachedData) {
            return cachedData;
        }

        // Get training progress with related test results
        let query = this.trainingProgressRepository
            .createQueryBuilder('tp')
            .innerJoin('tp.course', 'c')
            .leftJoin('c.tests', 't')
            .leftJoin('t.attempts', 'ta', 'ta.userId = :userId', { userId })
            .leftJoin('ta.results', 'r')
            .select('c.title', 'courseName')
            .addSelect('tp.completionPercentage', 'progressPercentage')
            .addSelect('AVG(r.score)', 'averageTestScore')
            .addSelect('COUNT(ta.attemptId)', 'totalAttempts')
            .addSelect('tp.timeSpentMinutes', 'timeSpentMinutes')
            .where('tp.userId = :userId', { userId })
            .groupBy('c.courseId, c.title, tp.completionPercentage, tp.timeSpentMinutes');

        if (courseId) {
            query = query.andWhere('tp.courseId = :courseId', { courseId });
        }

        const skills = await query.getRawMany();

        const skillDevelopment: SkillDevelopmentReportDto[] = skills.map((skill) => {
            const averageScore = Number(skill.averageTestScore || 0);
            const progressPercentage = Number(skill.progressPercentage);
            const timeSpent = Number(skill.timeSpentMinutes || 0);

            // Calculate skill level based on progress and performance
            const skillLevel = this.calculateSkillLevel(progressPercentage, averageScore);

            return {
                skillArea: skill.courseName,
                skillLevel,
                progressPercentage,
                averageTestScore: Math.round(averageScore * 100) / 100,
                totalAttempts: Number(skill.totalAttempts || 0),
                timeSpent,
                improvementRate: this.calculateImprovementRate(progressPercentage, averageScore),
            };
        });

        // Cache the result for 1 hour (3600 seconds)
        await this.cacheManager.set(cacheKey, skillDevelopment, 3600);

        return skillDevelopment;
    }

    async getProgressMilestones(
        userId: string,
        courseId?: number,
    ): Promise<ProgressMilestoneReportDto[]> {
        const cacheKey = `progress_milestones_${userId}_${courseId || 'all'}`;

        // Try to get from cache first
        const cachedData = await this.cacheManager.get<ProgressMilestoneReportDto[]>(
            cacheKey,
        );

        if (cachedData) {
            return cachedData;
        }

        let query = this.trainingProgressRepository
            .createQueryBuilder('tp')
            .innerJoin('tp.course', 'c')
            .select('c.title', 'courseName')
            .addSelect('tp.completionPercentage', 'completionPercentage')
            .addSelect('tp.currentModule', 'currentModule')
            .addSelect('tp.lastUpdated', 'lastUpdated')
            .where('tp.userId = :userId', { userId });

        if (courseId) {
            query = query.andWhere('tp.courseId = :courseId', { courseId });
        }

        const progressData = await query.getRawMany();

        const milestones: ProgressMilestoneReportDto[] = progressData.map((progress) => {
            const completionPercentage = Number(progress.completionPercentage);
            const milestones = this.generateMilestones(completionPercentage);

            return {
                courseName: progress.courseName,
                currentProgress: completionPercentage,
                currentModule: progress.currentModule,
                milestonesAchieved: milestones.achieved,
                nextMilestone: milestones.next,
                lastUpdate: progress.lastUpdated,
            };
        });

        // Cache the result for 1 hour (3600 seconds)
        await this.cacheManager.set(cacheKey, milestones, 3600);

        return milestones;
    }

    private async getTrainingProgressStats(
        userId: string,
        courseId?: number,
    ): Promise<TrainingProgressStatsReportDto> {
        let query = this.trainingProgressRepository
            .createQueryBuilder('tp')
            .where('tp.userId = :userId', { userId });

        if (courseId) {
            query = query.andWhere('tp.courseId = :courseId', { courseId });
        }

        const progressData = await query.getMany();

        const totalCourses = progressData.length;
        const completedCourses = progressData.filter(p => p.completionPercentage === 100).length;
        const averageCompletion = totalCourses > 0 
            ? progressData.reduce((sum, p) => sum + p.completionPercentage, 0) / totalCourses
            : 0;

        const totalTimeSpent = progressData.reduce((sum, p) => sum + (p.timeSpentMinutes || 0), 0);

        // Recent activity
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentActivity = progressData.filter(
            p => p.lastUpdated && p.lastUpdated >= sevenDaysAgo
        ).length;

        return {
            totalCourses,
            completedCourses,
            averageCompletion: Math.round(averageCompletion * 100) / 100,
            totalTimeSpent: Math.round(totalTimeSpent),
            recentActivity,
        };
    }

    private async getTrainingProgressPerformance(
        userId: string,
        courseId?: number,
    ): Promise<TrainingProgressPerformanceReportDto> {
        // Learning velocity over time
        let query = this.trainingProgressRepository
            .createQueryBuilder('tp')
            .where('tp.userId = :userId', { userId })
            .select('DATE(tp.lastUpdated)', 'date')
            .addSelect('AVG(tp.completionPercentage)', 'averageCompletion')
            .groupBy('DATE(tp.lastUpdated)')
            .orderBy('DATE(tp.lastUpdated)', 'ASC')
            .limit(30);

        if (courseId) {
            query = query.andWhere('tp.courseId = :courseId', { courseId });
        }

        const velocityTrends = await query.getRawMany();

        // Course-specific progress
        let courseQuery = this.trainingProgressRepository
            .createQueryBuilder('tp')
            .innerJoin('tp.course', 'c')
            .where('tp.userId = :userId', { userId })
            .select('c.title', 'courseName')
            .addSelect('tp.completionPercentage', 'completionPercentage')
            .addSelect('tp.timeSpentMinutes', 'timeSpentMinutes')
            .orderBy('tp.completionPercentage', 'DESC');

        if (courseId) {
            courseQuery = courseQuery.andWhere('tp.courseId = :courseId', { courseId });
        }

        const courseProgress = await courseQuery.getRawMany();

        return {
            learningVelocity: velocityTrends.map((trend) => ({
                date: trend.date,
                averageCompletion: Math.round(Number(trend.averageCompletion) * 100) / 100,
            })),
            courseProgress: courseProgress.map((course) => ({
                courseName: course.courseName,
                completionPercentage: Number(course.completionPercentage),
                timeSpent: Number(course.timeSpentMinutes || 0),
            })),
        };
    }

    private async getGlobalLearningVelocity() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return await this.trainingProgressRepository
            .createQueryBuilder('tp')
            .where('tp.lastUpdated >= :thirtyDaysAgo', { thirtyDaysAgo })
            .select('DATE(tp.lastUpdated)', 'date')
            .addSelect('AVG(tp.completionPercentage)', 'averageCompletion')
            .addSelect('COUNT(tp.userId)', 'activeUsers')
            .groupBy('DATE(tp.lastUpdated)')
            .orderBy('DATE(tp.lastUpdated)', 'ASC')
            .getRawMany()
            .then(trends => trends.map(trend => ({
                date: trend.date,
                averageCompletion: Math.round(Number(trend.averageCompletion) * 100) / 100,
                activeUsers: Number(trend.activeUsers),
            })));
    }

    private calculateEstimatedTimeToComplete(
        completionPercentage: number,
        timeSpent: number,
    ): number {
        if (completionPercentage === 0) return 0;
        const remainingPercentage = 100 - completionPercentage;
        const timePerPercentage = timeSpent / completionPercentage;
        return Math.round(remainingPercentage * timePerPercentage);
    }

    private calculateSkillLevel(
        progressPercentage: number,
        averageScore: number,
    ): 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert' {
        const combinedScore = (progressPercentage + averageScore) / 2;
        
        if (combinedScore >= 90) return 'Expert';
        if (combinedScore >= 75) return 'Advanced';
        if (combinedScore >= 50) return 'Intermediate';
        return 'Beginner';
    }

    private calculateImprovementRate(
        progressPercentage: number,
        averageScore: number,
    ): number {
        // Simplified improvement rate calculation
        // In a real scenario, you'd track historical data
        return Math.round(((progressPercentage + averageScore) / 2) * 0.8);
    }

    private generateMilestones(
        completionPercentage: number,
    ): { achieved: string[]; next: string } {
        const milestones = [
            { threshold: 25, name: 'Getting Started' },
            { threshold: 50, name: 'Halfway Point' },
            { threshold: 75, name: 'Almost There' },
            { threshold: 100, name: 'Course Completed' },
        ];

        const achieved = milestones
            .filter(m => completionPercentage >= m.threshold)
            .map(m => m.name);

        const next = milestones
            .find(m => completionPercentage < m.threshold)?.name || 'All Milestones Achieved';

        return { achieved, next };
    }
} 