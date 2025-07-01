import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leaderboard } from './entities/leaderboard.entity';

import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { Result } from '../results/entities/result.entity';
import { plainToClass } from 'class-transformer';

@Injectable()
export class LeaderboardService {
    constructor(
        @InjectRepository(Leaderboard)
        private readonly leaderboardRepository: Repository<Leaderboard>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
    ) {}

    async getCourseLeaderboard(
        courseId: number,
        page: number = 1,
        limit: number = 10,
    ): Promise<{
        leaderboard: LeaderboardResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const skip = (page - 1) * limit;

            // Fetch leaderboard entries with comprehensive relations
            const [leaderboardEntries, total] = await this.leaderboardRepository
                .createQueryBuilder('leaderboard')
                .leftJoinAndSelect('leaderboard.user', 'user')
                .leftJoinAndSelect('leaderboard.course', 'course')
                .leftJoinAndSelect('course.orgId', 'courseOrg')
                .leftJoinAndSelect('course.branchId', 'courseBranch')
                .where('leaderboard.courseId = :courseId', { courseId })
                .orderBy('leaderboard.rank', 'ASC')
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            // Calculate class statistics for analytics
            const classStats = await this.calculateClassStatistics(courseId);

            // Enhance each entry with comprehensive data
            const enhancedLeaderboard = await Promise.all(
                leaderboardEntries.map(async (entry) => {
                    const enhancedEntry = await this.enhanceLeaderboardEntry(
                        entry,
                        classStats,
                    );
                    return enhancedEntry;
                }),
            );

            const responseLeaderboard = enhancedLeaderboard.map((entry) =>
                plainToClass(LeaderboardResponseDto, entry, {
                    excludeExtraneousValues: true,
                }),
            );

            return {
                leaderboard: responseLeaderboard,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to fetch course leaderboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    async getUserRank(
        courseId: number,
        userId: string,
    ): Promise<LeaderboardResponseDto | null> {
        try {
            const leaderboardEntry = await this.leaderboardRepository
                .createQueryBuilder('leaderboard')
                .leftJoinAndSelect('leaderboard.user', 'user')
                .leftJoinAndSelect('leaderboard.course', 'course')
                .leftJoinAndSelect('course.orgId', 'courseOrg')
                .leftJoinAndSelect('course.branchId', 'courseBranch')
                .where('leaderboard.courseId = :courseId', { courseId })
                .andWhere('leaderboard.userId = :userId', { userId })
                .getOne();

            if (!leaderboardEntry) {
                return null;
            }

            // Calculate class statistics for analytics
            const classStats = await this.calculateClassStatistics(courseId);

            // Enhance the entry with comprehensive data
            const enhancedEntry = await this.enhanceLeaderboardEntry(
                leaderboardEntry,
                classStats,
            );

            return plainToClass(LeaderboardResponseDto, enhancedEntry, {
                excludeExtraneousValues: true,
            });
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to fetch user rank: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    private async calculateClassStatistics(courseId: number): Promise<{
        classAverageScore: number;
        totalStudents: number;
        totalTests: number;
        highestScore: number;
        lowestScore: number;
        medianScore: number;
    }> {
        // Get all leaderboard entries for the course
        const entries = await this.leaderboardRepository.find({
            where: { courseId },
        });

        if (entries.length === 0) {
            return {
                classAverageScore: 0,
                totalStudents: 0,
                totalTests: 0,
                highestScore: 0,
                lowestScore: 0,
                medianScore: 0,
            };
        }

        const scores = entries.map((entry) => Number(entry.averageScore));
        const totalTests = Math.max(...entries.map((entry) => entry.testsCompleted));

        return {
            classAverageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
            totalStudents: entries.length,
            totalTests,
            highestScore: Math.max(...scores),
            lowestScore: Math.min(...scores),
            medianScore: this.calculateMedian(scores),
        };
    }

    private calculateMedian(scores: number[]): number {
        const sorted = scores.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    private async enhanceLeaderboardEntry(
        entry: Leaderboard,
        classStats: {
            classAverageScore: number;
            totalStudents: number;
            totalTests: number;
            highestScore: number;
            lowestScore: number;
            medianScore: number;
        },
    ): Promise<any> {
        // Get user's previous rank for rank change calculation
        const previousRank = await this.getPreviousRank(entry.userId, entry.courseId);

        // Calculate performance analytics
        const performanceAnalytics = await this.calculatePerformanceAnalytics(
            entry,
            classStats,
            previousRank,
        );

        // Calculate achievements and badges
        const achievements = this.calculateAchievements(entry, classStats);

        // Get additional course statistics
        const courseStats = await this.getCourseStatistics(entry.courseId);

        // Calculate estimated days to next rank
        const estimatedDaysToNextRank = await this.calculateDaysToNextRank(entry);

        // Determine competition status
        const competitionStatus = this.determineCompetitionStatus(entry);

        return {
            ...entry,
            // Enhanced user info (already in base entity relations)
            user: {
                ...entry.user,
                achievementLevel: this.getAchievementLevel(Number(entry.averageScore)),
            },
            // Enhanced course info
            course: {
                ...entry.course,
                enrolledStudents: classStats.totalStudents,
                totalTests: classStats.totalTests,
            },
            // Performance analytics
            performanceAnalytics: {
                ...performanceAnalytics,
                classAverageScore: classStats.classAverageScore,
                totalTestsInCourse: classStats.totalTests,
            },
            // Achievements
            achievements,
            // Additional calculated fields
            letterGrade: this.calculateLetterGrade(Number(entry.averageScore)),
            aboveAverage: Number(entry.averageScore) > classStats.classAverageScore,
            estimatedDaysToNextRank,
            competitionStatus,
            // Pass through data for transforms
            classAverageScore: classStats.classAverageScore,
            totalTestsInCourse: classStats.totalTests,
        };
    }

    private async getPreviousRank(userId: string, courseId: number): Promise<number | null> {
        // This would typically come from a rank history table
        // For now, we'll simulate by adding some variance
        const currentEntry = await this.leaderboardRepository.findOne({
            where: { userId, courseId },
        });
        
        if (!currentEntry) return null;
        
        // Simulate previous rank (in a real implementation, store rank history)
        const variance = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(1, currentEntry.rank + variance);
    }

    private async calculatePerformanceAnalytics(
        entry: Leaderboard,
        classStats: any,
        previousRank: number | null,
    ): Promise<any> {
        const rankChange = previousRank ? previousRank - entry.rank : 0;
        
        // Calculate percentile rank
        const percentileRank = Math.round(
            ((classStats.totalStudents - entry.rank + 1) / classStats.totalStudents) * 100,
        );

        // Calculate consistency rating (1-5)
        const consistencyRating = await this.calculateConsistencyRating(entry.userId, entry.courseId);

        // Determine trend
        const trend = this.determineTrend(rankChange, entry);

        // Calculate days since last activity
        const daysSinceLastActivity = Math.floor(
            (new Date().getTime() - new Date(entry.lastUpdated).getTime()) / (1000 * 60 * 60 * 24),
        );

        // Calculate points to next rank
        const pointsToNextRank = await this.calculatePointsToNextRank(entry);

        return {
            rankChange,
            previousRank,
            percentileRank,
            consistencyRating,
            trend,
            daysSinceLastActivity,
            pointsToNextRank,
        };
    }

    private async calculateConsistencyRating(userId: string, courseId: number): Promise<number> {
        // Get user's test results for variance calculation
        const results = await this.resultRepository.find({
            where: { userId, courseId },
            order: { createdAt: 'DESC' },
            take: 10, // Last 10 results
        });

        if (results.length < 2) return 3; // Default rating

        const scores = results.map((result) => Number(result.percentage));
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const standardDeviation = Math.sqrt(variance);

        // Convert to 1-5 scale (lower deviation = higher consistency)
        if (standardDeviation <= 5) return 5;
        if (standardDeviation <= 10) return 4;
        if (standardDeviation <= 15) return 3;
        if (standardDeviation <= 20) return 2;
        return 1;
    }

    private determineTrend(rankChange: number, entry: Leaderboard): string {
        if (rankChange > 0) return 'improving';
        if (rankChange < 0) return 'declining';
        
        // If no rank change, check recent performance
        const recentScore = Number(entry.averageScore);
        if (recentScore >= 85) return 'stable';
        if (recentScore >= 70) return 'stable';
        return 'stable';
    }

    private async calculatePointsToNextRank(entry: Leaderboard): Promise<number | undefined> {
        if (entry.rank === 1) return undefined; // Already first place

        const nextRankEntry = await this.leaderboardRepository.findOne({
            where: { courseId: entry.courseId, rank: entry.rank - 1 },
        });

        if (!nextRankEntry) return undefined;

        return Math.max(0, Number(nextRankEntry.totalPoints) - Number(entry.totalPoints) + 1);
    }

    private calculateAchievements(entry: Leaderboard, classStats: any): any {
        const badges: string[] = [];
        const recognitions: string[] = [];
        const milestones: string[] = [];

        const score = Number(entry.averageScore);
        const rank = entry.rank;
        const testsCompleted = entry.testsCompleted;

        // Badges based on performance
        if (score >= 95) badges.push('high_scorer');
        if (score >= 85) badges.push('consistent_performer');
        if (testsCompleted >= 10) badges.push('dedicated_learner');
        if (rank === 1) badges.push('champion');
        if (rank <= 3) badges.push('top_performer');

        // Recognitions
        if (rank === 1) recognitions.push('First Place');
        if (rank <= Math.ceil(classStats.totalStudents * 0.1)) recognitions.push('Top 10%');
        if (rank <= Math.ceil(classStats.totalStudents * 0.25)) recognitions.push('Top 25%');
        if (score > classStats.classAverageScore + 10) recognitions.push('Above Average');

        // Milestones
        if (testsCompleted >= 1) milestones.push('First Test Completed');
        if (testsCompleted >= 5) milestones.push('5 Tests Completed');
        if (testsCompleted >= 10) milestones.push('10 Tests Completed');
        if (score === 100) milestones.push('Perfect Score');

        return {
            badges,
            recognitions,
            milestones,
        };
    }

    private async getCourseStatistics(courseId: number): Promise<any> {
        // Get course-specific statistics
        const results = await this.resultRepository.count({
            where: { courseId },
        });

        return {
            totalResults: results,
        };
    }

    private async calculateDaysToNextRank(entry: Leaderboard): Promise<number | undefined> {
        if (entry.rank === 1) return undefined;

        // Simple estimation based on current progress
        // In a real implementation, use historical data and trends
        const baseEstimate = 7; // Base 7 days
        const rankDifference = entry.rank - 1;
        const scoreGap = await this.calculatePointsToNextRank(entry) || 0;

        return Math.ceil(baseEstimate + (rankDifference * 0.5) + (scoreGap * 0.1));
    }

    private determineCompetitionStatus(entry: Leaderboard): string {
        const daysSinceUpdate = Math.floor(
            (new Date().getTime() - new Date(entry.lastUpdated).getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysSinceUpdate <= 7) return 'active';
        if (daysSinceUpdate <= 30) return 'inactive';
        return 'completed';
    }

    private getAchievementLevel(score: number): string {
        if (score >= 90) return 'expert';
        if (score >= 80) return 'advanced';
        if (score >= 70) return 'intermediate';
        return 'beginner';
    }

    private calculateLetterGrade(percentage: number): string {
        if (percentage >= 97) return 'A+';
        if (percentage >= 93) return 'A';
        if (percentage >= 90) return 'A-';
        if (percentage >= 87) return 'B+';
        if (percentage >= 83) return 'B';
        if (percentage >= 80) return 'B-';
        if (percentage >= 77) return 'C+';
        if (percentage >= 73) return 'C';
        if (percentage >= 70) return 'C-';
        if (percentage >= 67) return 'D+';
        if (percentage >= 63) return 'D';
        if (percentage >= 60) return 'D-';
        return 'F';
    }

    async updateLeaderboard(courseId: number): Promise<void> {
        try {
            // Get all results for the course with org/branch data
            const results = await this.resultRepository
                .createQueryBuilder('result')
                .leftJoinAndSelect('result.orgId', 'org')
                .leftJoinAndSelect('result.branchId', 'branch')
                .where('result.courseId = :courseId', { courseId })
                .getMany();

            if (results.length === 0) {
                // Clear leaderboard if no results
                await this.leaderboardRepository.delete({ courseId });
                return;
            }

            // Get org/branch from first result (all should have same org/branch for a course)
            const orgEntity = results[0].orgId;
            const branchEntity = results[0].branchId;

            if (!orgEntity) {
                throw new Error(
                    `No organization data found for course ${courseId} results`,
                );
            }

            // Group results by user
            const userStats = new Map<
                string,
                {
                    totalPoints: number;
                    testsCompleted: number;
                    averageScore: number;
                }
            >();

            results.forEach(result => {
                const userId = result.userId;
                const existing = userStats.get(userId) || {
                    totalPoints: 0,
                    testsCompleted: 0,
                    averageScore: 0,
                };

                existing.totalPoints += Number(result.score);
                existing.testsCompleted += 1;
                existing.averageScore =
                    existing.totalPoints / existing.testsCompleted;

                userStats.set(userId, existing);
            });

            // Sort users by average score (descending)
            const sortedUsers = Array.from(userStats.entries()).sort(
                (a, b) => b[1].averageScore - a[1].averageScore,
            );

            // Clear existing leaderboard for this course
            await this.leaderboardRepository.delete({ courseId });

            // Create new leaderboard entries directly with entity objects
            if (sortedUsers.length > 0) {
                const entities = sortedUsers.map(([userId, stats], index) =>
                    this.leaderboardRepository.create({
                        courseId,
                        userId,
                        rank: index + 1,
                        averageScore:
                            Math.round(stats.averageScore * 100) / 100,
                        testsCompleted: stats.testsCompleted,
                        totalPoints: Math.round(stats.totalPoints * 100) / 100,
                        orgId: orgEntity,
                        branchId: branchEntity,
                    }),
                );
                await this.leaderboardRepository.save(entities);
            }
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to update leaderboard',
            );
        }
    }

    async updateUserScore(courseId: number, userId: string): Promise<void> {
        try {
            // Get user's results for the course with org/branch data
            const userResults = await this.resultRepository
                .createQueryBuilder('result')
                .leftJoinAndSelect('result.orgId', 'org')
                .leftJoinAndSelect('result.branchId', 'branch')
                .where('result.courseId = :courseId', { courseId })
                .andWhere('result.userId = :userId', { userId })
                .getMany();

            if (userResults.length === 0) {
                // Remove user from leaderboard if no results
                await this.leaderboardRepository.delete({ courseId, userId });
                return;
            }

            // Get org/branch data from the first result (all should have the same org/branch)
            const firstResult = userResults[0];
            const orgEntity = firstResult.orgId;
            const branchEntity = firstResult.branchId;

            if (!orgEntity) {
                throw new Error(
                    `No organization data found for user ${userId} results in course ${courseId}`,
                );
            }

            // Calculate user stats
            const totalPoints = userResults.reduce(
                (sum, result) => sum + Number(result.score),
                0,
            );
            const testsCompleted = userResults.length;
            const averageScore = totalPoints / testsCompleted;

            // Update or create leaderboard entry
            const existingEntry = await this.leaderboardRepository.findOne({
                where: { courseId, userId },
            });

            if (existingEntry) {
                await this.leaderboardRepository.update(
                    { leaderboardId: existingEntry.leaderboardId },
                    {
                        averageScore: Math.round(averageScore * 100) / 100,
                        testsCompleted,
                        totalPoints: Math.round(totalPoints * 100) / 100,
                        lastUpdated: new Date(),
                    },
                );
            } else {
                await this.leaderboardRepository.save(
                    this.leaderboardRepository.create({
                        courseId,
                        userId,
                        rank: 1, // Temporary rank, will be recalculated
                        averageScore: Math.round(averageScore * 100) / 100,
                        testsCompleted,
                        totalPoints: Math.round(totalPoints * 100) / 100,
                        orgId: orgEntity,
                        branchId: branchEntity,
                    }),
                );
            }

            // Recalculate ranks
            await this.recalculateRanks(courseId);
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to update user score: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }

    private async recalculateRanks(courseId: number): Promise<void> {
        const entries = await this.leaderboardRepository.find({
            where: { courseId },
            order: { averageScore: 'DESC', totalPoints: 'DESC' },
        });

        for (let i = 0; i < entries.length; i++) {
            await this.leaderboardRepository.update(
                { leaderboardId: entries[i].leaderboardId },
                { rank: i + 1 },
            );
        }
    }

    async getUserOverallStats(userId: string): Promise<{
        totalPoints: number;
        totalTestsCompleted: number;
        averageScore: number;
        coursesEnrolled: number;
        bestRank: number | null;
        recentActivity: LeaderboardResponseDto[];
    }> {
        try {
            const userEntries = await this.leaderboardRepository
                .createQueryBuilder('leaderboard')
                .leftJoinAndSelect('leaderboard.user', 'user')
                .leftJoinAndSelect('leaderboard.course', 'course')
                .where('leaderboard.userId = :userId', { userId })
                .orderBy('leaderboard.lastUpdated', 'DESC')
                .getMany();

            if (userEntries.length === 0) {
                return {
                    totalPoints: 0,
                    totalTestsCompleted: 0,
                    averageScore: 0,
                    coursesEnrolled: 0,
                    bestRank: null,
                    recentActivity: [],
                };
            }

            const totalPoints = userEntries.reduce(
                (sum, entry) => sum + Number(entry.totalPoints),
                0,
            );
            const totalTestsCompleted = userEntries.reduce(
                (sum, entry) => sum + entry.testsCompleted,
                0,
            );
            const averageScore = userEntries.reduce(
                (sum, entry) => sum + Number(entry.averageScore),
                0,
            ) / userEntries.length;
            const bestRank = Math.min(...userEntries.map(entry => entry.rank));

            // Get recent activity (last 5 courses)
            const recentEntries = userEntries.slice(0, 5);
            const classStats = { classAverageScore: 75, totalStudents: 25, totalTests: 8, highestScore: 100, lowestScore: 50, medianScore: 75 }; // Default stats

            const recentActivity = await Promise.all(
                recentEntries.map(async (entry) => {
                    const enhanced = await this.enhanceLeaderboardEntry(entry, classStats);
                    return plainToClass(LeaderboardResponseDto, enhanced, {
                        excludeExtraneousValues: true,
                    });
                }),
            );

            return {
                totalPoints: Math.round(totalPoints * 100) / 100,
                totalTestsCompleted,
                averageScore: Math.round(averageScore * 100) / 100,
                coursesEnrolled: userEntries.length,
                bestRank,
                recentActivity,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to get user stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }
}
