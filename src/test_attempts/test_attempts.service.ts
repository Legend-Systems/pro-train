import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateTestAttemptDto } from './dto/create-test_attempt.dto';
import { UpdateTestAttemptDto } from './dto/update-test_attempt.dto';
import { TestAttemptResponseDto } from './dto/test-attempt-response.dto';
import { TestAttempt, AttemptStatus } from './entities/test_attempt.entity';
import { Test } from '../test/entities/test.entity';
import { User } from '../user/entities/user.entity';
import { TestAttemptStatsDto } from './dto/test-attempt-stats.dto';
import { TestAttemptFilterDto } from './dto/test-attempt-filter.dto';
import { TestAttemptListResponseDto } from './dto/test-attempt-list-response.dto';
import { ResultsService } from '../results/results.service';
import { AnswersService } from '../answers/answers.service';

@Injectable()
export class TestAttemptsService {
    private readonly logger = new Logger(TestAttemptsService.name);

    constructor(
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly dataSource: DataSource,
        private readonly resultsService: ResultsService,
        private readonly answersService: AnswersService,
    ) {}

    /**
     * Retry database operations with exponential backoff
     */
    private async retryOperation<T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        delay: number = 1000,
    ): Promise<T> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                if (attempt === maxRetries) {
                    this.logger.error(
                        `Operation failed after ${maxRetries} attempts`,
                        error instanceof Error ? error.stack : String(error),
                    );
                    throw error;
                }
                this.logger.warn(
                    `Operation failed, attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`,
                );
                await new Promise(resolve =>
                    setTimeout(resolve, delay * attempt),
                );
            }
        }
        throw new Error('Retry operation failed unexpectedly');
    }

    /**
     * Start a new test attempt
     */
    async startAttempt(
        createAttemptDto: CreateTestAttemptDto,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryOperation(async () => {
            // Get test details
            const test = await this.testRepository.findOne({
                where: { testId: createAttemptDto.testId },
                relations: ['course'],
            });

            if (!test) {
                throw new NotFoundException('Test not found');
            }

            if (!test.isActive) {
                throw new BadRequestException('Test is not active');
            }

            // Check if user has exceeded max attempts
            const userAttempts = await this.testAttemptRepository.count({
                where: {
                    testId: createAttemptDto.testId,
                    userId,
                },
            });

            if (userAttempts >= test.maxAttempts) {
                throw new BadRequestException(
                    `Maximum attempts (${test.maxAttempts}) exceeded for this test`,
                );
            }

            // Check if user has an active attempt
            const activeAttempt = await this.testAttemptRepository.findOne({
                where: {
                    testId: createAttemptDto.testId,
                    userId,
                    status: AttemptStatus.IN_PROGRESS,
                },
            });

            if (activeAttempt) {
                throw new ConflictException(
                    'You already have an active attempt for this test',
                );
            }

            // Calculate expiration time
            const startTime = new Date();
            const expiresAt = test.durationMinutes
                ? new Date(startTime.getTime() + test.durationMinutes * 60000)
                : undefined;

            // Create new attempt
            const attempt = this.testAttemptRepository.create({
                testId: createAttemptDto.testId,
                userId,
                attemptNumber: userAttempts + 1,
                status: AttemptStatus.IN_PROGRESS,
                startTime,
                expiresAt,
                progressPercentage: 0,
            });

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Submit a test attempt
     */
    async submitAttempt(
        attemptId: number,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryOperation(async () => {
            const attempt = await this.findAttemptByIdAndUser(
                attemptId,
                userId,
            );

            if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Cannot submit attempt that is not in progress',
                );
            }

            // Update attempt status
            attempt.status = AttemptStatus.SUBMITTED;
            attempt.submitTime = new Date();
            attempt.progressPercentage = 100;

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            // Trigger auto-marking and result creation flow
            try {
                this.logger.log(
                    `Starting auto-processing for attempt ${attemptId}`,
                );

                // Step 1: Auto-mark objective questions
                await this.answersService.autoMark(attemptId);
                this.logger.log(
                    `Auto-marking completed for attempt ${attemptId}`,
                );

                // Step 2: Create result based on marked answers
                const result =
                    await this.resultsService.createFromAttempt(attemptId);
                this.logger.log(
                    `Result created for attempt ${attemptId}: ${result.resultId}`,
                );

                this.logger.log(
                    `Auto-processing completed successfully for attempt ${attemptId}`,
                );
            } catch (error) {
                this.logger.error(
                    `Error during auto-processing for attempt ${attemptId}`,
                    error instanceof Error ? error.stack : String(error),
                );
                // Don't throw here - the attempt submission itself was successful
                // The processing can be retried later if needed
            }

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Update test attempt progress
     */
    async updateProgress(
        attemptId: number,
        updateDto: UpdateTestAttemptDto,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryOperation(async () => {
            const attempt = await this.findAttemptByIdAndUser(
                attemptId,
                userId,
            );

            if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Cannot update progress for completed attempt',
                );
            }

            // Check if attempt has expired
            if (attempt.expiresAt && new Date() > attempt.expiresAt) {
                attempt.status = AttemptStatus.EXPIRED;
                await this.testAttemptRepository.save(attempt);
                throw new BadRequestException('Test attempt has expired');
            }

            // Update fields
            if (updateDto.progressPercentage !== undefined) {
                attempt.progressPercentage = updateDto.progressPercentage;
            }
            if (updateDto.status !== undefined) {
                attempt.status = updateDto.status;
                if (updateDto.status === AttemptStatus.SUBMITTED) {
                    attempt.submitTime = new Date();
                    attempt.progressPercentage = 100;
                }
            }

            const savedAttempt = await this.testAttemptRepository.save(attempt);

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Get user's test attempts
     */
    async getUserAttempts(
        userId: string,
        testId?: number,
        page: number = 1,
        pageSize: number = 10,
    ): Promise<{
        attempts: TestAttemptResponseDto[];
        total: number;
        page: number;
        pageSize: number;
    }> {
        return this.retryOperation(async () => {
            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('test.course', 'course')
                .where('attempt.userId = :userId', { userId });

            if (testId) {
                query.andWhere('attempt.testId = :testId', { testId });
            }

            query.orderBy('attempt.createdAt', 'DESC');

            const offset = (page - 1) * pageSize;
            const [attempts, total] = await query
                .skip(offset)
                .take(pageSize)
                .getManyAndCount();

            return {
                attempts: attempts.map(attempt =>
                    this.mapToResponseDto(attempt),
                ),
                total,
                page,
                pageSize,
            };
        });
    }

    /**
     * Get attempt by ID with access control
     */
    async findOne(
        attemptId: number,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryOperation(async () => {
            const attempt = await this.findAttemptByIdAndUser(
                attemptId,
                userId,
            );
            return this.mapToResponseDto(attempt);
        });
    }

    /**
     * Cancel an active attempt
     */
    async cancelAttempt(
        attemptId: number,
        userId: string,
    ): Promise<TestAttemptResponseDto> {
        return this.retryOperation(async () => {
            const attempt = await this.findAttemptByIdAndUser(
                attemptId,
                userId,
            );

            if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Can only cancel attempts that are in progress',
                );
            }

            attempt.status = AttemptStatus.CANCELLED;
            const savedAttempt = await this.testAttemptRepository.save(attempt);

            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Private helper to find attempt by ID and validate user access
     */
    private async findAttemptByIdAndUser(
        attemptId: number,
        userId: string,
    ): Promise<TestAttempt> {
        const attempt = await this.testAttemptRepository.findOne({
            where: { attemptId },
            relations: ['test', 'test.course', 'user', 'answers', 'results'],
        });

        if (!attempt) {
            throw new NotFoundException('Test attempt not found');
        }

        if (attempt.userId !== userId) {
            throw new ForbiddenException(
                'You do not have access to this test attempt',
            );
        }

        return attempt;
    }

    /**
     * Map entity to response DTO
     */
    private mapToResponseDto(attempt: TestAttempt): TestAttemptResponseDto {
        return {
            attemptId: attempt.attemptId,
            testId: attempt.testId,
            userId: attempt.userId,
            attemptNumber: attempt.attemptNumber,
            status: attempt.status,
            startTime: attempt.startTime,
            submitTime: attempt.submitTime,
            expiresAt: attempt.expiresAt,
            progressPercentage: attempt.progressPercentage,
            createdAt: attempt.createdAt,
            updatedAt: attempt.updatedAt,
            test: attempt.test
                ? {
                      testId: attempt.test.testId,
                      title: attempt.test.title,
                      testType: attempt.test.testType,
                      durationMinutes: attempt.test.durationMinutes,
                  }
                : undefined,
            user: attempt.user
                ? {
                      id: attempt.user.id,
                      email: attempt.user.email,
                      firstName: attempt.user.firstName,
                      lastName: attempt.user.lastName,
                  }
                : undefined,
        };
    }

    /**
     * Get attempts for a specific test (instructor view)
     */
    async findAttemptsByTest(
        testId: number,
        userId: string,
        filters?: TestAttemptFilterDto,
    ): Promise<TestAttemptListResponseDto> {
        return this.retryOperation(async () => {
            // Verify user has access to this test (is instructor/creator)
            const test = await this.testRepository.findOne({
                where: { testId },
                relations: ['course'],
            });

            if (!test) {
                throw new NotFoundException('Test not found');
            }

            // For now, allow any authenticated user to view attempts
            // In a real system, you'd check if user is instructor/admin

            const query = this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('attempt.user', 'user')
                .where('attempt.testId = :testId', { testId });

            // Apply filters
            if (filters?.status) {
                query.andWhere('attempt.status = :status', {
                    status: filters.status,
                });
            }
            if (filters?.userId) {
                query.andWhere('attempt.userId = :userId', {
                    userId: filters.userId,
                });
            }
            if (filters?.startDateFrom) {
                query.andWhere('attempt.startTime >= :startDateFrom', {
                    startDateFrom: filters.startDateFrom,
                });
            }
            if (filters?.startDateTo) {
                query.andWhere('attempt.startTime <= :startDateTo', {
                    startDateTo: filters.startDateTo,
                });
            }

            query.orderBy('attempt.createdAt', 'DESC');

            const page = filters?.page || 1;
            const pageSize = filters?.pageSize || 10;
            const offset = (page - 1) * pageSize;

            const [attempts, total] = await query
                .skip(offset)
                .take(pageSize)
                .getManyAndCount();

            const totalPages = Math.ceil(total / pageSize);

            return {
                attempts: attempts.map(attempt =>
                    this.mapToResponseDto(attempt),
                ),
                total,
                page,
                pageSize,
                totalPages,
                hasNext: page < totalPages,
                hasPrevious: page > 1,
            };
        });
    }

    /**
     * Validate if user can attempt a test
     */
    async validateAttemptLimits(
        testId: number,
        userId: string,
    ): Promise<{
        canAttempt: boolean;
        reason?: string;
        attemptsUsed: number;
        maxAttempts: number;
    }> {
        return this.retryOperation(async () => {
            const test = await this.testRepository.findOne({
                where: { testId },
            });

            if (!test) {
                throw new NotFoundException('Test not found');
            }

            if (!test.isActive) {
                return {
                    canAttempt: false,
                    reason: 'Test is not active',
                    attemptsUsed: 0,
                    maxAttempts: test.maxAttempts,
                };
            }

            const attemptsUsed = await this.testAttemptRepository.count({
                where: { testId, userId },
            });

            const activeAttempt = await this.testAttemptRepository.findOne({
                where: {
                    testId,
                    userId,
                    status: AttemptStatus.IN_PROGRESS,
                },
            });

            if (activeAttempt) {
                return {
                    canAttempt: false,
                    reason: 'Active attempt already exists',
                    attemptsUsed,
                    maxAttempts: test.maxAttempts,
                };
            }

            if (attemptsUsed >= test.maxAttempts) {
                return {
                    canAttempt: false,
                    reason: `Maximum attempts (${test.maxAttempts}) exceeded`,
                    attemptsUsed,
                    maxAttempts: test.maxAttempts,
                };
            }

            return {
                canAttempt: true,
                attemptsUsed,
                maxAttempts: test.maxAttempts,
            };
        });
    }

    /**
     * Calculate and update score for an attempt
     */
    async calculateScore(attemptId: number): Promise<TestAttemptResponseDto> {
        return this.retryOperation(async () => {
            const attempt = await this.testAttemptRepository.findOne({
                where: { attemptId },
                relations: [
                    'test',
                    'answers',
                    'answers.question',
                    'answers.selectedOption',
                ],
            });

            if (!attempt) {
                throw new NotFoundException('Test attempt not found');
            }

            if (attempt.status !== AttemptStatus.SUBMITTED) {
                throw new BadRequestException(
                    'Can only calculate score for submitted attempts',
                );
            }

            // This is a placeholder for score calculation
            // In a real implementation, you'd calculate based on answers
            // For now, we'll just update the progress to 100%
            attempt.progressPercentage = 100;

            const savedAttempt = await this.testAttemptRepository.save(attempt);
            return this.mapToResponseDto(savedAttempt);
        });
    }

    /**
     * Get statistics for test attempts
     */
    async getStats(
        testId?: number,
        userId?: string,
    ): Promise<TestAttemptStatsDto> {
        return this.retryOperation(async () => {
            const query =
                this.testAttemptRepository.createQueryBuilder('attempt');

            if (testId) {
                query.where('attempt.testId = :testId', { testId });
            }
            if (userId) {
                query.andWhere('attempt.userId = :userId', { userId });
            }

            const attempts = await query.getMany();

            const totalAttempts = attempts.length;
            const completedAttempts = attempts.filter(
                a => a.status === AttemptStatus.SUBMITTED,
            ).length;
            const inProgressAttempts = attempts.filter(
                a => a.status === AttemptStatus.IN_PROGRESS,
            ).length;
            const expiredAttempts = attempts.filter(
                a => a.status === AttemptStatus.EXPIRED,
            ).length;

            const statusBreakdown = attempts.reduce(
                (acc, attempt) => {
                    acc[attempt.status] = (acc[attempt.status] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );

            const completedWithTime = attempts.filter(
                a =>
                    a.status === AttemptStatus.SUBMITTED &&
                    a.submitTime &&
                    a.startTime,
            );

            const averageCompletionTime =
                completedWithTime.length > 0
                    ? completedWithTime.reduce((sum, attempt) => {
                          const duration =
                              attempt.submitTime!.getTime() -
                              attempt.startTime.getTime();
                          return sum + duration / (1000 * 60); // Convert to minutes
                      }, 0) / completedWithTime.length
                    : 0;

            const averageProgress =
                totalAttempts > 0
                    ? attempts.reduce(
                          (sum, attempt) => sum + attempt.progressPercentage,
                          0,
                      ) / totalAttempts
                    : 0;

            const completionRate =
                totalAttempts > 0
                    ? (completedAttempts / totalAttempts) * 100
                    : 0;

            const lastAttemptDate =
                attempts.length > 0
                    ? new Date(
                          Math.max(...attempts.map(a => a.createdAt.getTime())),
                      )
                    : new Date();

            return {
                totalAttempts,
                completedAttempts,
                inProgressAttempts,
                expiredAttempts,
                averageCompletionTime,
                averageProgress,
                completionRate,
                lastAttemptDate,
                statusBreakdown,
            };
        });
    }
}
