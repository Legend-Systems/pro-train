import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Result } from './entities/result.entity';
import { CreateResultDto } from './dto/create-result.dto';
import { UpdateResultDto } from './dto/update-result.dto';
import { ResultResponseDto } from './dto/result-response.dto';
import { ResultFilterDto } from './dto/result-filter.dto';
import { ResultAnalyticsDto } from './dto/result-analytics.dto';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Answer } from '../answers/entities/answer.entity';
import { Question } from '../questions/entities/question.entity';
import { plainToClass } from 'class-transformer';
import { AttemptStatus } from '../test_attempts/entities/test_attempt.entity';

@Injectable()
export class ResultsService {
    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
    ) {}

    async createFromAttempt(attemptId: number): Promise<ResultResponseDto> {
        try {
            // Get the test attempt with all related data
            const attempt = await this.testAttemptRepository.findOne({
                where: { attemptId },
                relations: ['test', 'test.course', 'user'],
            });

            if (!attempt) {
                throw new NotFoundException(`Test attempt with ID ${attemptId} not found`);
            }

            if (attempt.status !== AttemptStatus.SUBMITTED) {
                throw new BadRequestException('Cannot create result for incomplete attempt');
            }

            // Check if result already exists
            const existingResult = await this.resultRepository.findOne({
                where: { attemptId },
            });

            if (existingResult) {
                throw new BadRequestException('Result already exists for this attempt');
            }

            // Calculate the score
            const { score, maxScore, percentage } = await this.calculateScore(attemptId);

            // Determine if passed (assuming 60% pass rate)
            const passed = percentage >= 60;

            // Create the result
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

            const result = this.resultRepository.create(resultData);
            const savedResult = await this.resultRepository.save(result);

            return this.findOne(savedResult.resultId);
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof BadRequestException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to create result from attempt');
        }
    }

    async findUserResults(
        userId: string,
        filterDto: ResultFilterDto,
    ): Promise<{ results: ResultResponseDto[]; total: number; page: number; limit: number }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto;
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery({ ...filters, userId });
            
            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = results.map(result =>
                plainToClass(ResultResponseDto, result, { excludeExtraneousValues: true }),
            );

            return {
                results: responseResults,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch user results');
        }
    }

    async findTestResults(
        testId: number,
        userId?: string,
        filterDto?: ResultFilterDto,
    ): Promise<{ results: ResultResponseDto[]; total: number; page: number; limit: number }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto || {};
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery({ ...filters, testId });
            
            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = results.map(result =>
                plainToClass(ResultResponseDto, result, { excludeExtraneousValues: true }),
            );

            return {
                results: responseResults,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch test results');
        }
    }

    async findCourseResults(
        courseId: number,
        userId?: string,
        filterDto?: ResultFilterDto,
    ): Promise<{ results: ResultResponseDto[]; total: number; page: number; limit: number }> {
        try {
            const { page = 1, limit = 10, ...filters } = filterDto || {};
            const skip = (page - 1) * limit;

            const queryBuilder = this.buildFilterQuery({ ...filters, courseId });
            
            const [results, total] = await queryBuilder
                .skip(skip)
                .take(limit)
                .getManyAndCount();

            const responseResults = results.map(result =>
                plainToClass(ResultResponseDto, result, { excludeExtraneousValues: true }),
            );

            return {
                results: responseResults,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw new InternalServerErrorException('Failed to fetch course results');
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

            return plainToClass(ResultResponseDto, result, { excludeExtraneousValues: true });
        } catch (error) {
            if (error instanceof NotFoundException || error instanceof ForbiddenException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to fetch result');
        }
    }

    async getTestAnalytics(testId: number, userId?: string): Promise<ResultAnalyticsDto> {
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
            const averagePercentage = results.reduce((sum, r) => sum + Number(r.percentage), 0) / totalResults;
            const averageScore = results.reduce((sum, r) => sum + Number(r.score), 0) / totalResults;
            const percentages = results.map(r => Number(r.percentage)).sort((a, b) => a - b);
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
            throw new InternalServerErrorException('Failed to generate test analytics');
        }
    }

    async recalculateResult(resultId: number, userId?: string): Promise<ResultResponseDto> {
        try {
            const result = await this.resultRepository.findOne({
                where: { resultId },
                relations: ['attempt'],
            });

            if (!result) {
                throw new NotFoundException(`Result with ID ${resultId} not found`);
            }

            // Recalculate score
            const { score, maxScore, percentage } = await this.calculateScore(result.attemptId);

            // Update result
            result.score = score;
            result.maxScore = maxScore;
            result.percentage = percentage;
            result.passed = percentage >= 60;
            result.calculatedAt = new Date();

            await this.resultRepository.save(result);

            return this.findOne(resultId, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to recalculate result');
        }
    }

    private async calculateScore(attemptId: number): Promise<{
        score: number;
        maxScore: number;
        percentage: number;
    }> {
        // Get all answers for the attempt
        const answers = await this.answerRepository.find({
            where: { attemptId },
            relations: ['question', 'selectedOption'],
        });

        // Get all questions for the test
        const attempt = await this.testAttemptRepository.findOne({
            where: { attemptId },
            relations: ['test'],
        });

        const questions = await this.questionRepository.find({
            where: { testId: attempt?.testId },
        });

        let totalScore = 0;
        let maxScore = 0;

        for (const question of questions) {
            maxScore += question.points;
            
            const answer = answers.find(a => a.questionId === question.questionId);
            if (answer && answer.pointsAwarded !== null && answer.pointsAwarded !== undefined) {
                totalScore += answer.pointsAwarded;
            } else if (answer && answer.selectedOption) {
                // Auto-calculate for objective questions
                const isCorrect = answer.selectedOption.isCorrect;
                if (isCorrect) {
                    totalScore += question.points;
                }
            }
        }

        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

        return {
            score: totalScore,
            maxScore,
            percentage: Math.round(percentage * 100) / 100,
        };
    }

    private buildFilterQuery(filters: Partial<ResultFilterDto>): SelectQueryBuilder<Result> {
        const queryBuilder = this.resultRepository
            .createQueryBuilder('result')
            .leftJoinAndSelect('result.user', 'user')
            .leftJoinAndSelect('result.test', 'test')
            .leftJoinAndSelect('result.course', 'course')
            .leftJoinAndSelect('result.attempt', 'attempt');

        if (filters.userId) {
            queryBuilder.andWhere('result.userId = :userId', { userId: filters.userId });
        }

        if (filters.testId) {
            queryBuilder.andWhere('result.testId = :testId', { testId: filters.testId });
        }

        if (filters.courseId) {
            queryBuilder.andWhere('result.courseId = :courseId', { courseId: filters.courseId });
        }

        if (filters.passed !== undefined) {
            queryBuilder.andWhere('result.passed = :passed', { passed: filters.passed });
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
}
