import {
    Injectable,
    NotFoundException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TrainingProgress } from './entities/training_progress.entity';
import { Course } from '../course/entities/course.entity';
import { CreateTrainingProgressDto } from './dto/create-training_progress.dto';
import { UpdateTrainingProgressDto } from './dto/update-training_progress.dto';
import { TrainingProgressResponseDto } from './dto/training-progress-response.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class TrainingProgressService {
    constructor(
        @InjectRepository(TrainingProgress)
        private readonly progressRepository: Repository<TrainingProgress>,
        @InjectRepository(Course)
        private readonly courseRepository: Repository<Course>,
    ) {}

    async getUserProgress(
        userId: string,
        courseId?: number,
    ): Promise<TrainingProgressResponseDto[]> {
        try {
            const queryBuilder = this.progressRepository
                .createQueryBuilder('progress')
                .leftJoinAndSelect('progress.user', 'user')
                .leftJoinAndSelect('progress.course', 'course')
                .leftJoinAndSelect('progress.test', 'test')
                .where('progress.userId = :userId', { userId });

            if (courseId) {
                queryBuilder.andWhere('progress.courseId = :courseId', {
                    courseId,
                });
            }

            const progressEntries = await queryBuilder
                .orderBy('progress.lastUpdated', 'DESC')
                .getMany();

            return progressEntries.map(entry =>
                plainToClass(TrainingProgressResponseDto, entry, {
                    excludeExtraneousValues: true,
                }),
            );
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to fetch user progress',
            );
        }
    }

    async updateProgress(
        userId: string,
        courseId: number,
        testId?: number,
        updateData?: Partial<CreateTrainingProgressDto>,
    ): Promise<TrainingProgressResponseDto> {
        try {
            // Find existing progress entry
            const whereCondition = {
                userId,
                courseId,
                testId: testId || IsNull(),
            };

            let progressEntry = await this.progressRepository.findOne({
                where: whereCondition,
                relations: ['user', 'course', 'test', 'orgId', 'branchId'],
            });

            if (progressEntry) {
                // Update existing entry
                if (updateData?.completionPercentage !== undefined) {
                    progressEntry.completionPercentage =
                        updateData.completionPercentage;
                }
                if (updateData?.timeSpentMinutes !== undefined) {
                    progressEntry.timeSpentMinutes +=
                        updateData.timeSpentMinutes;
                }
                if (updateData?.questionsCompleted !== undefined) {
                    progressEntry.questionsCompleted =
                        updateData.questionsCompleted;
                }
                if (updateData?.totalQuestions !== undefined) {
                    progressEntry.totalQuestions = updateData.totalQuestions;
                }
                progressEntry.lastUpdated = new Date();
            } else {
                // Need to get course with org/branch info to inherit
                const course = await this.courseRepository.findOne({
                    where: { courseId },
                    relations: ['orgId', 'branchId'],
                });

                if (!course) {
                    throw new NotFoundException(
                        `Course with ID ${courseId} not found`,
                    );
                }

                // Create new progress entry with inherited org/branch
                const createDto: CreateTrainingProgressDto = {
                    userId,
                    courseId,
                    testId,
                    completionPercentage: updateData?.completionPercentage || 0,
                    timeSpentMinutes: updateData?.timeSpentMinutes || 0,
                    questionsCompleted: updateData?.questionsCompleted || 0,
                    totalQuestions: updateData?.totalQuestions || 0,
                };
                progressEntry = this.progressRepository.create({
                    ...createDto,
                    // Inherit org/branch from course
                    orgId: course.orgId,
                    branchId: course.branchId,
                });
            }

            const savedProgress =
                await this.progressRepository.save(progressEntry);

            // Fetch with relations for response
            const fullProgress = await this.progressRepository.findOne({
                where: { progressId: savedProgress.progressId },
                relations: ['user', 'course', 'test'],
            });

            return plainToClass(TrainingProgressResponseDto, fullProgress, {
                excludeExtraneousValues: true,
            });
        } catch (error) {
            throw new InternalServerErrorException('Failed to update progress');
        }
    }

    async getCourseProgress(
        courseId: number,
        userId?: string,
    ): Promise<TrainingProgressResponseDto[]> {
        try {
            const queryBuilder = this.progressRepository
                .createQueryBuilder('progress')
                .leftJoinAndSelect('progress.user', 'user')
                .leftJoinAndSelect('progress.course', 'course')
                .leftJoinAndSelect('progress.test', 'test')
                .where('progress.courseId = :courseId', { courseId });

            if (userId) {
                queryBuilder.andWhere('progress.userId = :userId', { userId });
            }

            const progressEntries = await queryBuilder
                .orderBy('progress.lastUpdated', 'DESC')
                .getMany();

            return progressEntries.map(entry =>
                plainToClass(TrainingProgressResponseDto, entry, {
                    excludeExtraneousValues: true,
                }),
            );
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to fetch course progress',
            );
        }
    }

    async calculateCompletion(
        userId: string,
        courseId: number,
    ): Promise<{ overallCompletion: number; testCompletions: any[] }> {
        try {
            const progressEntries = await this.progressRepository.find({
                where: { userId, courseId },
                relations: ['test'],
            });

            if (progressEntries.length === 0) {
                return { overallCompletion: 0, testCompletions: [] };
            }

            const testCompletions = progressEntries.map(entry => ({
                testId: entry.testId,
                testTitle: entry.test?.title || 'Unknown Test',
                completionPercentage: entry.completionPercentage,
                questionsCompleted: entry.questionsCompleted,
                totalQuestions: entry.totalQuestions,
                timeSpentMinutes: entry.timeSpentMinutes,
            }));

            const overallCompletion =
                progressEntries.reduce(
                    (sum, entry) => sum + entry.completionPercentage,
                    0,
                ) / progressEntries.length;

            return {
                overallCompletion: Math.round(overallCompletion * 100) / 100,
                testCompletions,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to calculate completion',
            );
        }
    }

    async getProgressStats(
        userId: string,
        courseId?: number,
    ): Promise<{
        totalTimeSpent: number;
        totalQuestionsCompleted: number;
        averageCompletion: number;
        coursesInProgress: number;
        testsCompleted: number;
    }> {
        try {
            const queryBuilder = this.progressRepository
                .createQueryBuilder('progress')
                .where('progress.userId = :userId', { userId });

            if (courseId) {
                queryBuilder.andWhere('progress.courseId = :courseId', {
                    courseId,
                });
            }

            const progressEntries = await queryBuilder.getMany();

            const stats = {
                totalTimeSpent: progressEntries.reduce(
                    (sum, entry) => sum + entry.timeSpentMinutes,
                    0,
                ),
                totalQuestionsCompleted: progressEntries.reduce(
                    (sum, entry) => sum + entry.questionsCompleted,
                    0,
                ),
                averageCompletion:
                    progressEntries.length > 0
                        ? progressEntries.reduce(
                              (sum, entry) => sum + entry.completionPercentage,
                              0,
                          ) / progressEntries.length
                        : 0,
                coursesInProgress: new Set(
                    progressEntries.map(entry => entry.courseId),
                ).size,
                testsCompleted: progressEntries.filter(
                    entry => entry.completionPercentage >= 100,
                ).length,
            };

            stats.averageCompletion =
                Math.round(stats.averageCompletion * 100) / 100;

            return stats;
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to get progress stats',
            );
        }
    }

    async findOne(progressId: number): Promise<TrainingProgressResponseDto> {
        try {
            const progress = await this.progressRepository.findOne({
                where: { progressId },
                relations: ['user', 'course', 'test'],
            });

            if (!progress) {
                throw new NotFoundException(
                    `Training progress with ID ${progressId} not found`,
                );
            }

            return plainToClass(TrainingProgressResponseDto, progress, {
                excludeExtraneousValues: true,
            });
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to fetch training progress',
            );
        }
    }

    async update(
        progressId: number,
        updateTrainingProgressDto: UpdateTrainingProgressDto,
    ): Promise<TrainingProgressResponseDto> {
        try {
            const progress = await this.progressRepository.findOne({
                where: { progressId },
                relations: ['user', 'course', 'test'],
            });

            if (!progress) {
                throw new NotFoundException(
                    `Training progress with ID ${progressId} not found`,
                );
            }

            // Update fields
            Object.assign(progress, updateTrainingProgressDto);
            progress.lastUpdated = new Date();

            const updatedProgress =
                await this.progressRepository.save(progress);

            return plainToClass(TrainingProgressResponseDto, updatedProgress, {
                excludeExtraneousValues: true,
            });
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to update training progress',
            );
        }
    }

    async remove(progressId: number): Promise<void> {
        try {
            const progress = await this.progressRepository.findOne({
                where: { progressId },
            });

            if (!progress) {
                throw new NotFoundException(
                    `Training progress with ID ${progressId} not found`,
                );
            }

            await this.progressRepository.remove(progress);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to delete training progress',
            );
        }
    }
}
