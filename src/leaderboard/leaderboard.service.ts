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

            const [leaderboardEntries, total] = await this.leaderboardRepository
                .createQueryBuilder('leaderboard')
                .leftJoinAndSelect('leaderboard.user', 'user')
                .leftJoinAndSelect('leaderboard.course', 'course')
                .where('leaderboard.courseId = :courseId', { courseId })
                .orderBy('leaderboard.rank', 'ASC')
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseLeaderboard = leaderboardEntries.map(entry =>
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
        } catch {
            throw new InternalServerErrorException(
                'Failed to fetch course leaderboard',
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
                .where('leaderboard.courseId = :courseId', { courseId })
                .andWhere('leaderboard.userId = :userId', { userId })
                .getOne();

            if (!leaderboardEntry) {
                return null;
            }

            return plainToClass(LeaderboardResponseDto, leaderboardEntry, {
                excludeExtraneousValues: true,
            });
        } catch (_error) {
            throw new InternalServerErrorException('Failed to fetch user rank');
        }
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

            // Find or create leaderboard entry
            let leaderboardEntry = await this.leaderboardRepository.findOne({
                where: { courseId, userId },
                relations: ['user', 'course', 'orgId', 'branchId'],
            });

            if (leaderboardEntry) {
                // Update existing entry
                leaderboardEntry.averageScore =
                    Math.round(averageScore * 100) / 100;
                leaderboardEntry.testsCompleted = testsCompleted;
                leaderboardEntry.totalPoints =
                    Math.round(totalPoints * 100) / 100;
                leaderboardEntry.lastUpdated = new Date();
            } else {
                // Create new entry with temporary rank
                leaderboardEntry = this.leaderboardRepository.create({
                    courseId,
                    userId,
                    rank: 999999, // Temporary rank, will be updated when recalculating ranks
                    averageScore: Math.round(averageScore * 100) / 100,
                    testsCompleted,
                    totalPoints: Math.round(totalPoints * 100) / 100,
                    orgId: orgEntity,
                    branchId: branchEntity,
                });
            }

            await this.leaderboardRepository.save(leaderboardEntry);

            // Recalculate ranks for the course
            await this.recalculateRanks(courseId);
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to update user score',
            );
        }
    }

    private async recalculateRanks(courseId: number): Promise<void> {
        // Get all leaderboard entries for the course, sorted by average score
        const entries = await this.leaderboardRepository
            .createQueryBuilder('leaderboard')
            .where('leaderboard.courseId = :courseId', { courseId })
            .orderBy('leaderboard.averageScore', 'DESC')
            .addOrderBy('leaderboard.totalPoints', 'DESC')
            .getMany();

        // Update ranks
        for (let i = 0; i < entries.length; i++) {
            entries[i].rank = i + 1;
        }

        if (entries.length > 0) {
            await this.leaderboardRepository.save(entries);
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
            // Get all leaderboard entries for the user
            const userLeaderboardEntries = await this.leaderboardRepository
                .createQueryBuilder('leaderboard')
                .leftJoinAndSelect('leaderboard.user', 'user')
                .leftJoinAndSelect('leaderboard.course', 'course')
                .where('leaderboard.userId = :userId', { userId })
                .orderBy('leaderboard.lastUpdated', 'DESC')
                .getMany();

            if (userLeaderboardEntries.length === 0) {
                return {
                    totalPoints: 0,
                    totalTestsCompleted: 0,
                    averageScore: 0,
                    coursesEnrolled: 0,
                    bestRank: null,
                    recentActivity: [],
                };
            }

            // Calculate overall stats
            const totalPoints = userLeaderboardEntries.reduce(
                (sum, entry) => sum + Number(entry.totalPoints),
                0,
            );
            const totalTestsCompleted = userLeaderboardEntries.reduce(
                (sum, entry) => sum + entry.testsCompleted,
                0,
            );
            const averageScore =
                totalTestsCompleted > 0
                    ? userLeaderboardEntries.reduce(
                          (sum, entry) =>
                              sum +
                              Number(entry.averageScore) * entry.testsCompleted,
                          0,
                      ) / totalTestsCompleted
                    : 0;

            const coursesEnrolled = userLeaderboardEntries.length;
            const bestRank = Math.min(
                ...userLeaderboardEntries.map(entry => entry.rank),
            );

            // Get recent activity (last 5 courses with activity)
            const recentActivity = userLeaderboardEntries
                .slice(0, 5)
                .map(entry =>
                    plainToClass(LeaderboardResponseDto, entry, {
                        excludeExtraneousValues: true,
                    }),
                );

            return {
                totalPoints: Math.round(totalPoints * 100) / 100,
                totalTestsCompleted,
                averageScore: Math.round(averageScore * 100) / 100,
                coursesEnrolled,
                bestRank,
                recentActivity,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to fetch user overall stats',
            );
        }
    }
}
