import {
    Injectable,
    NotFoundException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leaderboard } from './entities/leaderboard.entity';
import { CreateLeaderboardDto } from './dto/create-leaderboard.dto';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
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
    ): Promise<{ leaderboard: LeaderboardResponseDto[]; total: number; page: number; limit: number }> {
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
                plainToClass(LeaderboardResponseDto, entry, { excludeExtraneousValues: true }),
            );

            return {
                leaderboard: responseLeaderboard,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch course leaderboard');
        }
    }

    async getUserRank(courseId: number, userId: string): Promise<LeaderboardResponseDto | null> {
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
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch user rank');
        }
    }

    async updateLeaderboard(courseId: number): Promise<void> {
        try {
            // Get all results for the course
            const results = await this.resultRepository
                .createQueryBuilder('result')
                .where('result.courseId = :courseId', { courseId })
                .getMany();

            // Group results by user
            const userStats = new Map<string, {
                totalPoints: number;
                testsCompleted: number;
                averageScore: number;
            }>();

            results.forEach(result => {
                const userId = result.userId;
                const existing = userStats.get(userId) || {
                    totalPoints: 0,
                    testsCompleted: 0,
                    averageScore: 0,
                };

                existing.totalPoints += Number(result.score);
                existing.testsCompleted += 1;
                existing.averageScore = existing.totalPoints / existing.testsCompleted;

                userStats.set(userId, existing);
            });

            // Sort users by average score (descending)
            const sortedUsers = Array.from(userStats.entries())
                .sort((a, b) => b[1].averageScore - a[1].averageScore);

            // Clear existing leaderboard for this course
            await this.leaderboardRepository.delete({ courseId });

            // Create new leaderboard entries
            const leaderboardEntries: CreateLeaderboardDto[] = sortedUsers.map(([userId, stats], index) => ({
                courseId,
                userId,
                rank: index + 1,
                averageScore: Math.round(stats.averageScore * 100) / 100,
                testsCompleted: stats.testsCompleted,
                totalPoints: Math.round(stats.totalPoints * 100) / 100,
            }));

            if (leaderboardEntries.length > 0) {
                const entities = leaderboardEntries.map(dto => this.leaderboardRepository.create(dto));
                await this.leaderboardRepository.save(entities);
            }
        } catch (error) {
            throw new InternalServerErrorException('Failed to update leaderboard');
        }
    }

    async updateUserScore(courseId: number, userId: string): Promise<void> {
        try {
            // Get user's results for the course
            const userResults = await this.resultRepository
                .createQueryBuilder('result')
                .where('result.courseId = :courseId', { courseId })
                .andWhere('result.userId = :userId', { userId })
                .getMany();

            if (userResults.length === 0) {
                // Remove user from leaderboard if no results
                await this.leaderboardRepository.delete({ courseId, userId });
                return;
            }

            // Calculate user stats
            const totalPoints = userResults.reduce((sum, result) => sum + Number(result.score), 0);
            const testsCompleted = userResults.length;
            const averageScore = totalPoints / testsCompleted;

            // Find or create leaderboard entry
            let leaderboardEntry = await this.leaderboardRepository.findOne({
                where: { courseId, userId },
            });

            if (leaderboardEntry) {
                // Update existing entry
                leaderboardEntry.averageScore = Math.round(averageScore * 100) / 100;
                leaderboardEntry.testsCompleted = testsCompleted;
                leaderboardEntry.totalPoints = Math.round(totalPoints * 100) / 100;
                leaderboardEntry.lastUpdated = new Date();
            } else {
                // Create new entry with temporary rank
                const createDto: CreateLeaderboardDto = {
                    courseId,
                    userId,
                    rank: 999999, // Temporary rank, will be updated when recalculating ranks
                    averageScore: Math.round(averageScore * 100) / 100,
                    testsCompleted,
                    totalPoints: Math.round(totalPoints * 100) / 100,
                };
                leaderboardEntry = this.leaderboardRepository.create(createDto);
            }

            await this.leaderboardRepository.save(leaderboardEntry);

            // Recalculate ranks for the entire course
            await this.recalculateRanks(courseId);
        } catch (error) {
            throw new InternalServerErrorException('Failed to update user score');
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
}
