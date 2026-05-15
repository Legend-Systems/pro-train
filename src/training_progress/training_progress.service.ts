import {
    Injectable,
    NotFoundException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
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
                .where('progress.userId = :userId', { userId })
                // Course-level rows (testId null) break naive averages; UI uses per-test rows only.
                .andWhere('progress.testId IS NOT NULL');

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

    /**
     * Writes or replaces the per-test materialized row when a result is scored (Section 1.3).
     * Unlike {@link updateProgress}, time and question counts are replaced so retakes do not
     * accumulate duplicate minutes when syncing from the latest attempt snapshot.
     */
    async upsertPerTestSnapshotFromScoredResult(input: {
        readonly userId: string;
        readonly courseId: number;
        readonly testId: number;
        readonly completionPercentage: number;
        readonly timeSpentMinutes: number;
        readonly questionsCompleted: number;
        readonly totalQuestions: number;
    }): Promise<TrainingProgressResponseDto> {
        try {
            const course = await this.courseRepository.findOne({
                where: { courseId: input.courseId },
                relations: ['orgId', 'branchId'],
            });
            if (!course) {
                throw new NotFoundException(
                    `Course with ID ${input.courseId} not found`,
                );
            }

            let progressEntry = await this.progressRepository.findOne({
                where: {
                    userId: input.userId,
                    courseId: input.courseId,
                    testId: input.testId,
                },
                relations: ['user', 'course', 'test', 'orgId', 'branchId'],
            });

            if (progressEntry) {
                progressEntry.completionPercentage = input.completionPercentage;
                progressEntry.timeSpentMinutes = input.timeSpentMinutes;
                progressEntry.questionsCompleted = input.questionsCompleted;
                progressEntry.totalQuestions = input.totalQuestions;
                progressEntry.lastUpdated = new Date();
            } else {
                progressEntry = this.progressRepository.create({
                    userId: input.userId,
                    courseId: input.courseId,
                    testId: input.testId,
                    completionPercentage: input.completionPercentage,
                    timeSpentMinutes: input.timeSpentMinutes,
                    questionsCompleted: input.questionsCompleted,
                    totalQuestions: input.totalQuestions,
                    orgId: course.orgId,
                    branchId: course.branchId,
                });
            }

            const savedProgress =
                await this.progressRepository.save(progressEntry);
            const fullProgress = await this.progressRepository.findOne({
                where: { progressId: savedProgress.progressId },
                relations: ['user', 'course', 'test'],
            });

            return plainToClass(TrainingProgressResponseDto, fullProgress, {
                excludeExtraneousValues: true,
            });
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to upsert training progress snapshot',
            );
        }
    }

    /**
     * One-off reconciliation: replay latest scored result per (user,course,test) into training_progress.
     */
    async backfillFromLatestResults(): Promise<{ syncedRowCount: number }> {
        type RankedLatestRow = {
            userId: string;
            courseId: number;
            testId: number;
            percentage: string;
            attemptId: number;
        };

        try {
            const rankedRows: RankedLatestRow[] =
                await this.progressRepository.manager.query(
                    `
          SELECT ranked.userId AS userId,
                 ranked.courseId AS courseId,
                 ranked.testId AS testId,
                 ranked.percentage AS percentage,
                 ranked.attemptId AS attemptId
          FROM (
                 SELECT r.userId AS userId,
                        r.courseId AS courseId,
                        r.testId AS testId,
                        r.percentage AS percentage,
                        r.attemptId AS attemptId,
                        ROW_NUMBER() OVER (
                          PARTITION BY r.userId, r.courseId, r.testId
                          ORDER BY r.calculatedAt DESC, r.createdAt DESC, r.resultId DESC
                          ) AS rn
                 FROM results r
               ) ranked
          WHERE ranked.rn = 1
          `,
                );

            let syncedRowCount = 0;
            for (const rankedRow of rankedRows) {
                await this.upsertPerTestSnapshotFromScoredResult({
                    userId: rankedRow.userId,
                    courseId: rankedRow.courseId,
                    testId: rankedRow.testId,
                    completionPercentage:
                        Math.round(Number(rankedRow.percentage) * 100) / 100,
                    timeSpentMinutes: 0,
                    questionsCompleted: 0,
                    totalQuestions: 0,
                });
                syncedRowCount++;
            }

            return { syncedRowCount };
        } catch (error) {
            throw new InternalServerErrorException(
                `Failed to backfill training_progress from results: ${
                    error instanceof Error ? error.message : String(error)
                }`,
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

                /**
                 * Omitting legacy course rollup rows (`testId` undefined) keeps one row per
                 * learner/test and avoids polluted averages (Section 4).
                 */
                if (testId === undefined || testId === null) {
                    throw new BadRequestException(
                        'Course-level progress rows (without testId) are not supported; use per-test snapshots.',
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

            queryBuilder.andWhere('progress.testId IS NOT NULL');

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
                where: { userId, courseId, testId: Not(IsNull()) },
                relations: ['test'],
            });

            /**
             * Averages completion % across per-test materialized rows only.
             * Prefer {@link CourseService.getCourseLearnerProgress} for compliance completion and knowledge %.
             */
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
                .where('progress.userId = :userId', { userId })
                .andWhere('progress.testId IS NOT NULL');

            if (courseId) {
                queryBuilder.andWhere('progress.courseId = :courseId', {
                    courseId,
                });
            }

            /**
             * Legacy dashboard stats derived from training_progress snapshots.
             * Course completion gates and headline knowledge belong on results-backed APIs.
             */
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
