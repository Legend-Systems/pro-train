import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Result } from './entities/result.entity';
import { CreateResultDto } from './dto/create-result.dto';
import { ResultResponseDto } from './dto/result-response.dto';
import { ResultFilterDto } from './dto/result-filter.dto';
import { ResultAnalyticsDto } from './dto/result-analytics.dto';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Answer } from '../answers/entities/answer.entity';
import { Question } from '../questions/entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { plainToClass } from 'class-transformer';
import { AttemptStatus } from '../test_attempts/entities/test_attempt.entity';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { CommunicationsService } from '../communications/communications.service';

@Injectable()
export class ResultsService {
    private readonly logger = new Logger(ResultsService.name);

    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        private readonly leaderboardService: LeaderboardService,
        private readonly communicationsService: CommunicationsService,
    ) {}

    async createFromAttempt(attemptId: number): Promise<ResultResponseDto> {
        try {
            this.logger.log(`Creating result from attempt ${attemptId}`);

            // Use query builder for more reliable relation loading
            const attempt = await this.testAttemptRepository
                .createQueryBuilder('attempt')
                .leftJoinAndSelect('attempt.test', 'test')
                .leftJoinAndSelect('test.course', 'course')
                .leftJoinAndSelect('attempt.user', 'user')
                .leftJoinAndSelect('attempt.orgId', 'orgId')
                .leftJoinAndSelect('attempt.branchId', 'branchId')
                .where('attempt.attemptId = :attemptId', { attemptId })
                .getOne();

            if (!attempt) {
                this.logger.error(`Test attempt ${attemptId} not found`);
                throw new NotFoundException(
                    `Test attempt with ID ${attemptId} not found`,
                );
            }

            this.logger.debug(`Found attempt ${attemptId}:`, {
                status: attempt.status,
                testId: attempt.testId,
                userId: attempt.userId,
                orgId: attempt.orgId?.id || 'null',
                branchId: attempt.branchId?.id || 'null',
                hasTest: !!attempt.test,
                testTitle: attempt.test?.title || 'null',
                courseId: attempt.test?.courseId || 'null',
                hasCourse: !!attempt.test?.course,
            });

            if (attempt.status !== AttemptStatus.SUBMITTED) {
                this.logger.warn(
                    `Attempt ${attemptId} status is ${attempt.status}, not SUBMITTED`,
                );
                throw new BadRequestException(
                    'Cannot create result for incomplete attempt',
                );
            }

            // Check if result already exists
            const existingResult = await this.resultRepository.findOne({
                where: { attemptId },
            });

            if (existingResult) {
                this.logger.warn(
                    `Result already exists for attempt ${attemptId}: ${existingResult.resultId}`,
                );
                throw new BadRequestException(
                    'Result already exists for this attempt',
                );
            }

            // Validate required data with fallback mechanism
            if (!attempt.test) {
                this.logger.warn(
                    `Test relation not loaded for attempt ${attemptId}. TestId: ${attempt.testId}. Attempting manual fetch...`,
                );

                // Fallback: manually fetch test data
                try {
                    const test = await this.testRepository
                        .createQueryBuilder('test')
                        .leftJoinAndSelect('test.course', 'course')
                        .leftJoinAndSelect('test.orgId', 'orgId')
                        .leftJoinAndSelect('test.branchId', 'branchId')
                        .where('test.testId = :testId', {
                            testId: attempt.testId,
                        })
                        .getOne();

                    if (test) {
                        attempt.test = test;
                        this.logger.log(
                            `Successfully fetched test data manually for attempt ${attemptId}`,
                        );
                    } else {
                        this.logger.error(
                            `Test ${attempt.testId} not found in database for attempt ${attemptId}`,
                        );
                        throw new BadRequestException(
                            'Test not found for this attempt',
                        );
                    }
                } catch (fetchError) {
                    this.logger.error(
                        `Failed to manually fetch test data for attempt ${attemptId}:`,
                        fetchError,
                    );
                    throw new BadRequestException(
                        'Test data not found for attempt - relation not loaded',
                    );
                }
            }

            if (!attempt.test.courseId) {
                this.logger.error(
                    `Course ID missing for test ${attempt.test.testId} in attempt ${attemptId}`,
                );
                throw new BadRequestException('Course ID not found for test');
            }

            // Calculate the score
            this.logger.debug(`Calculating score for attempt ${attemptId}`);
            const { score, maxScore, percentage } =
                await this.calculateScore(attemptId);

            this.logger.debug(`Score calculated for attempt ${attemptId}:`, {
                score,
                maxScore,
                percentage,
            });

            // Determine if passed (assuming 60% pass rate)
            const passed = percentage >= 60;

            // Ensure we have org/branch data - inherit from attempt or use defaults
            let orgId = attempt.orgId;
            let branchId = attempt.branchId;

            // If attempt doesn't have org/branch, try to get from test or course
            if (!orgId && attempt.test?.course) {
                this.logger.debug(
                    `Attempting to inherit org/branch from test/course for attempt ${attemptId}`,
                );

                // Try to get org/branch from test first
                if (attempt.test.orgId) {
                    orgId = attempt.test.orgId;
                    this.logger.debug(`Inherited orgId from test: ${orgId.id}`);
                }

                if (attempt.test.branchId) {
                    branchId = attempt.test.branchId;
                    this.logger.debug(
                        `Inherited branchId from test: ${branchId.id}`,
                    );
                }

                // If still no org/branch, get from course
                if (!orgId && attempt.test.course.orgId) {
                    orgId = attempt.test.course.orgId;
                    this.logger.debug(
                        `Inherited orgId from course: ${orgId.id}`,
                    );
                }

                if (!branchId && attempt.test.course.branchId) {
                    branchId = attempt.test.course.branchId;
                    this.logger.debug(
                        `Inherited branchId from course: ${branchId.id}`,
                    );
                }
            }

            // If we still don't have org data, this is a critical error
            if (!orgId) {
                this.logger.error(
                    `No org data found for attempt ${attemptId} - cannot create result`,
                );
                throw new BadRequestException(
                    'Organization data required to create result',
                );
            }

            // Create the result with inherited org/branch from attempt
            const resultData: CreateResultDto = {
                attemptId,
                userId: attempt.userId,
                testId: attempt.testId,
                courseId: attempt.test.courseId,
                score,
                maxScore,
                percentage,
                passed,
                calculatedAt: new Date(),
            };

            this.logger.debug(
                `Creating result entity for attempt ${attemptId}:`,
                {
                    ...resultData,
                    orgId: orgId?.id || 'null',
                    branchId: branchId?.id || 'null',
                },
            );

            const result = this.resultRepository.create({
                ...resultData,
                // Inherit org/branch from the test attempt
                orgId: orgId,
                branchId: branchId,
            });

            this.logger.debug(`Saving result for attempt ${attemptId}`);
            const savedResult = await this.resultRepository.save(result);

            this.logger.log(
                `Result created successfully for attempt ${attemptId}: ${savedResult.resultId}`,
            );

            // Trigger leaderboard update for the course and user
            try {
                await this.leaderboardService.updateUserScore(
                    attempt.test.courseId,
                    attempt.userId,
                );
                this.logger.debug(
                    `Leaderboard updated for user ${attempt.userId} in course ${attempt.test.courseId}`,
                );
            } catch (leaderboardError) {
                // Log error but don't fail the result creation
                this.logger.error(
                    `Failed to update leaderboard for user ${attempt.userId} in course ${attempt.test.courseId}`,
                    leaderboardError instanceof Error
                        ? leaderboardError.stack
                        : String(leaderboardError),
                );
            }

            // Send results summary email to the user
            try {
                await this.sendResultsSummaryEmail(savedResult, attempt);
                this.logger.debug(
                    `Results summary email sent to user ${attempt.userId} for result ${savedResult.resultId}`,
                );
            } catch (emailError) {
                // Log error but don't fail the result creation
                this.logger.error(
                    `Failed to send results summary email for result ${savedResult.resultId}`,
                    emailError instanceof Error
                        ? emailError.stack
                        : String(emailError),
                );
            }

            return this.findOne(savedResult.resultId);
        } catch (error) {
            this.logger.error(
                `Failed to create result from attempt ${attemptId}:`,
                error instanceof Error ? error.stack : String(error),
            );

            if (
                error instanceof NotFoundException ||
                error instanceof BadRequestException
            ) {
                throw error;
            }

            // Provide more specific error information
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';
            throw new InternalServerErrorException(
                `Failed to create result from attempt: ${errorMessage}`,
            );
        }
    }

    async findUserResults(
        userId: string,
        filterDto: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto;
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery({ ...filters, userId });

            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = results.map(result =>
                plainToClass(ResultResponseDto, result, {
                    excludeExtraneousValues: true,
                }),
            );

            return {
                results: responseResults,
                total,
                page,
                limit,
            };
        } catch {
            throw new InternalServerErrorException(
                'Failed to fetch user results',
            );
        }
    }

    async findTestResults(
        testId: number,
        userId?: string,
        filterDto?: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto || {};
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery({ ...filters, testId });

            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = results.map(result =>
                plainToClass(ResultResponseDto, result, {
                    excludeExtraneousValues: true,
                }),
            );

            return {
                results: responseResults,
                total,
                page,
                limit,
            };
        } catch {
            throw new InternalServerErrorException(
                'Failed to fetch test results',
            );
        }
    }

    async findCourseResults(
        courseId: number,
        userId?: string,
        filterDto?: ResultFilterDto,
    ): Promise<{
        results: ResultResponseDto[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto || {};
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery({
                ...filters,
                courseId,
            });

            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = results.map(result =>
                plainToClass(ResultResponseDto, result, {
                    excludeExtraneousValues: true,
                }),
            );

            return {
                results: responseResults,
                total,
                page,
                limit,
            };
        } catch {
            throw new InternalServerErrorException(
                'Failed to fetch course results',
            );
        }
    }

    async findOne(id: number, userId?: string): Promise<ResultResponseDto> {
        try {
            const queryBuilder = this.resultRepository
                .createQueryBuilder('result')
                .leftJoinAndSelect('result.user', 'user')
                .leftJoinAndSelect('result.test', 'test')
                .leftJoinAndSelect('result.course', 'course')
                .leftJoinAndSelect('result.attempt', 'attempt')
                .where('result.resultId = :id', { id });

            const result = await queryBuilder.getOne();

            if (!result) {
                throw new NotFoundException(`Result with ID ${id} not found`);
            }

            // If userId is provided, check if user can access this result
            if (userId && result.userId !== userId) {
                // Check if user is instructor of the course
                // This would require additional validation logic
                throw new ForbiddenException('Access denied to this result');
            }

            return plainToClass(ResultResponseDto, result, {
                excludeExtraneousValues: true,
            });
        } catch (error) {
            if (
                error instanceof NotFoundException ||
                error instanceof ForbiddenException
            ) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch result');
        }
    }

    async getTestAnalytics(
        testId: number,
        userId?: string,
    ): Promise<ResultAnalyticsDto> {
        try {
            const results = await this.resultRepository.find({
                where: { testId },
            });

            if (results.length === 0) {
                return {
                    totalResults: 0,
                    averagePercentage: 0,
                    averageScore: 0,
                    highestPercentage: 0,
                    lowestPercentage: 0,
                    passedCount: 0,
                    failedCount: 0,
                    passRate: 0,
                    scoreDistribution: {},
                    gradeDistribution: {},
                };
            }

            const totalResults = results.length;
            const averagePercentage =
                results.reduce((sum, r) => sum + Number(r.percentage), 0) /
                totalResults;
            const averageScore =
                results.reduce((sum, r) => sum + Number(r.score), 0) /
                totalResults;
            const percentages = results
                .map(r => Number(r.percentage))
                .sort((a, b) => a - b);
            const highestPercentage = percentages[percentages.length - 1];
            const lowestPercentage = percentages[0];
            const passedCount = results.filter(r => r.passed).length;
            const failedCount = totalResults - passedCount;
            const passRate = (passedCount / totalResults) * 100;

            // Score distribution
            const scoreDistribution = {
                '0-20': 0,
                '21-40': 0,
                '41-60': 0,
                '61-80': 0,
                '81-100': 0,
            };

            results.forEach(result => {
                const percentage = Number(result.percentage);
                if (percentage <= 20) scoreDistribution['0-20']++;
                else if (percentage <= 40) scoreDistribution['21-40']++;
                else if (percentage <= 60) scoreDistribution['41-60']++;
                else if (percentage <= 80) scoreDistribution['61-80']++;
                else scoreDistribution['81-100']++;
            });

            // Grade distribution
            const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
            results.forEach(result => {
                const percentage = Number(result.percentage);
                if (percentage >= 90) gradeDistribution.A++;
                else if (percentage >= 80) gradeDistribution.B++;
                else if (percentage >= 70) gradeDistribution.C++;
                else if (percentage >= 60) gradeDistribution.D++;
                else gradeDistribution.F++;
            });

            return {
                totalResults,
                averagePercentage: Math.round(averagePercentage * 100) / 100,
                averageScore: Math.round(averageScore * 100) / 100,
                highestPercentage,
                lowestPercentage,
                passedCount,
                failedCount,
                passRate: Math.round(passRate * 100) / 100,
                scoreDistribution,
                gradeDistribution,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Failed to generate test analytics',
            );
        }
    }

    async recalculateResult(
        resultId: number,
        userId?: string,
    ): Promise<ResultResponseDto> {
        try {
            const result = await this.resultRepository.findOne({
                where: { resultId },
                relations: ['attempt'],
            });

            if (!result) {
                throw new NotFoundException(
                    `Result with ID ${resultId} not found`,
                );
            }

            // Recalculate score
            const { score, maxScore, percentage } = await this.calculateScore(
                result.attemptId,
            );

            // Update result
            result.score = score;
            result.maxScore = maxScore;
            result.percentage = percentage;
            result.passed = percentage >= 60;
            result.calculatedAt = new Date();

            await this.resultRepository.save(result);

            // Trigger leaderboard update for the course and user
            try {
                await this.leaderboardService.updateUserScore(
                    result.courseId,
                    result.userId,
                );
            } catch (leaderboardError) {
                // Log error but don't fail the result recalculation
                console.error(
                    `Failed to update leaderboard for user ${result.userId} in course ${result.courseId}`,
                    leaderboardError instanceof Error
                        ? leaderboardError.message
                        : leaderboardError,
                );
            }

            return this.findOne(resultId, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException(
                'Failed to recalculate result',
            );
        }
    }

    private async calculateScore(attemptId: number): Promise<{
        score: number;
        maxScore: number;
        percentage: number;
    }> {
        this.logger.debug(
            `Starting score calculation for attempt ${attemptId}`,
        );

        // Get the attempt with org/branch info for scoping
        const attempt = await this.testAttemptRepository.findOne({
            where: { attemptId },
            relations: ['test', 'orgId', 'branchId'],
        });

        if (!attempt) {
            throw new NotFoundException(`Attempt ${attemptId} not found`);
        }

        this.logger.debug(
            `Attempt found - testId: ${attempt.testId}, orgId: ${attempt.orgId?.id}, branchId: ${attempt.branchId?.id}`,
        );

        // Get all answers for the attempt with proper scoping
        const answersQuery = this.answerRepository
            .createQueryBuilder('answer')
            .leftJoinAndSelect('answer.question', 'question')
            .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
            .where('answer.attemptId = :attemptId', { attemptId });

        // Apply org/branch scoping to answers
        if (attempt.orgId) {
            answersQuery.andWhere('answer.orgId = :orgId', {
                orgId: attempt.orgId.id,
            });
        }
        if (attempt.branchId) {
            answersQuery.andWhere('answer.branchId = :branchId', {
                branchId: attempt.branchId.id,
            });
        }

        const answers = await answersQuery.getMany();
        this.logger.debug(
            `Found ${answers.length} scoped answers for attempt ${attemptId}`,
        );

        // Get all questions for the test with proper scoping
        const questionsQuery = this.questionRepository
            .createQueryBuilder('question')
            .where('question.testId = :testId', { testId: attempt.testId });

        // Apply org/branch scoping to questions
        if (attempt.orgId) {
            questionsQuery.andWhere('question.orgId = :orgId', {
                orgId: attempt.orgId.id,
            });
        }
        if (attempt.branchId) {
            questionsQuery.andWhere('question.branchId = :branchId', {
                branchId: attempt.branchId.id,
            });
        }

        const questions = await questionsQuery.getMany();
        this.logger.debug(
            `Found ${questions.length} scoped questions for test ${attempt.testId}`,
        );

        let totalScore = 0;
        let maxScore = 0;

        this.logger.debug(`Processing questions for score calculation:`);

        for (const question of questions) {
            const questionPoints = Number(question.points) || 0;
            maxScore += questionPoints;

            const answer = answers.find(
                a => a.questionId === question.questionId,
            );

            let pointsEarned = 0;

            if (answer) {
                // Check if answer has been marked with points
                if (
                    answer.pointsAwarded !== null &&
                    answer.pointsAwarded !== undefined
                ) {
                    pointsEarned = Number(answer.pointsAwarded) || 0;
                    this.logger.debug(
                        `Question ${question.questionId}: Using marked points ${pointsEarned}/${questionPoints}`,
                    );
                } else if (answer.selectedOption) {
                    // Auto-calculate for objective questions
                    const isCorrect = answer.selectedOption.isCorrect;
                    if (isCorrect) {
                        pointsEarned = questionPoints;
                    }
                    this.logger.debug(
                        `Question ${question.questionId}: Auto-calculated ${pointsEarned}/${questionPoints} (correct: ${isCorrect})`,
                    );
                } else {
                    this.logger.debug(
                        `Question ${question.questionId}: No answer or selection - 0/${questionPoints}`,
                    );
                }
            } else {
                this.logger.debug(
                    `Question ${question.questionId}: No answer found - 0/${questionPoints}`,
                );
            }

            totalScore += pointsEarned;
        }

        // Calculate percentage with proper validation
        let percentage = 0;
        if (maxScore > 0) {
            percentage = (totalScore / maxScore) * 100;
            // Round to 2 decimal places
            percentage = Math.round(percentage * 100) / 100;
        }

        this.logger.debug(
            `Score calculation completed for attempt ${attemptId}:`,
            {
                totalScore,
                maxScore,
                percentage,
                questionsProcessed: questions.length,
                answersFound: answers.length,
            },
        );

        return {
            score: totalScore,
            maxScore,
            percentage,
        };
    }

    private buildFilterQuery(
        filters: Partial<ResultFilterDto>,
    ): SelectQueryBuilder<Result> {
        const queryBuilder = this.resultRepository
            .createQueryBuilder('result')
            .leftJoinAndSelect('result.user', 'user')
            .leftJoinAndSelect('result.test', 'test')
            .leftJoinAndSelect('result.course', 'course')
            .leftJoinAndSelect('result.attempt', 'attempt');

        if (filters.userId) {
            queryBuilder.andWhere('result.userId = :userId', {
                userId: filters.userId,
            });
        }

        if (filters.testId) {
            queryBuilder.andWhere('result.testId = :testId', {
                testId: filters.testId,
            });
        }

        if (filters.courseId) {
            queryBuilder.andWhere('result.courseId = :courseId', {
                courseId: filters.courseId,
            });
        }

        if (filters.passed !== undefined) {
            queryBuilder.andWhere('result.passed = :passed', {
                passed: filters.passed,
            });
        }

        if (filters.minPercentage !== undefined) {
            queryBuilder.andWhere('result.percentage >= :minPercentage', {
                minPercentage: filters.minPercentage,
            });
        }

        if (filters.maxPercentage !== undefined) {
            queryBuilder.andWhere('result.percentage <= :maxPercentage', {
                maxPercentage: filters.maxPercentage,
            });
        }

        if (filters.startDate) {
            queryBuilder.andWhere('result.calculatedAt >= :startDate', {
                startDate: filters.startDate,
            });
        }

        if (filters.endDate) {
            queryBuilder.andWhere('result.calculatedAt <= :endDate', {
                endDate: filters.endDate,
            });
        }

        // Sorting
        const sortBy = filters.sortBy || 'createdAt';
        const sortOrder = filters.sortOrder || 'DESC';
        queryBuilder.orderBy(`result.${sortBy}`, sortOrder);

        return queryBuilder;
    }

    private async sendResultsSummaryEmail(
        result: Result,
        attempt: TestAttempt,
    ): Promise<void> {
        try {
            // Get user information
            if (!attempt.user) {
                this.logger.warn(
                    `User information not available for result ${result.resultId}`,
                );
                return;
            }

            // Calculate completion time (if available)
            let completionTime = 'Not available';
            if (attempt.startTime && attempt.submitTime) {
                const durationMs =
                    new Date(attempt.submitTime).getTime() -
                    new Date(attempt.startTime).getTime();
                const durationMinutes = Math.round(durationMs / (1000 * 60));
                completionTime = `${durationMinutes} minutes`;
            }

            // Get question count for more accurate data
            const questionCount = await this.questionRepository.count({
                where: { testId: attempt.testId },
            });

            // Get correct answers count by checking answers with points
            const allAnswers = await this.answerRepository.find({
                where: { attemptId: attempt.attemptId },
                relations: ['question'],
            });

            const correctAnswersCount = allAnswers.filter(
                answer =>
                    answer.pointsAwarded !== null &&
                    answer.pointsAwarded !== undefined &&
                    answer.pointsAwarded > 0,
            ).length;

            // Prepare template data with proper data types and fallbacks
            const templateData = {
                recipientName:
                    `${attempt.user.firstName || ''} ${attempt.user.lastName || ''}`.trim() ||
                    'Student',
                recipientEmail: attempt.user.email || '',
                testTitle: attempt.test?.title || 'Test',
                score: Number(result.score) || 0,
                totalQuestions: questionCount || 1,
                correctAnswers: correctAnswersCount || 0,
                percentage: Number(result.percentage) || 0,
                completionTime: completionTime || 'Not available',
                resultsUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/results/${result.resultId}`,
            };

            await this.communicationsService.sendResultsSummaryEmail(
                templateData,
            );

            this.logger.log(
                `Results summary email queued for user ${attempt.user.email} (Result ID: ${result.resultId})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send results summary email for result ${result.resultId}:`,
                error instanceof Error ? error.stack : String(error),
            );
            throw error;
        }
    }
}
