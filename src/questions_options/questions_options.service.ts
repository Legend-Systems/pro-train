import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
    Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateQuestionOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionOptionDto } from './dto/update-questions_option.dto';
import { QuestionOptionResponseDto } from './dto/question-option-response.dto';
import { QuestionOptionListResponseDto } from './dto/question-option-list-response.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';
import { QuestionOption } from './entities/questions_option.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionsService } from '../questions/questions.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { StandardOperationResponse } from '../user/dto/common-response.dto';

@Injectable()
export class QuestionsOptionsService {
    private readonly logger = new Logger(QuestionsOptionsService.name);

    // Cache keys
    private readonly CACHE_KEYS = {
        OPTION_BY_ID: (id: number) => `question-option:${id}`,
        OPTIONS_BY_QUESTION: (questionId: number) =>
            `question-options:question:${questionId}`,
        QUESTION_OPTIONS_LIST: (filters: string) =>
            `question-options:list:${filters}`,
        OPTION_STATS: (questionId: number) =>
            `question-option:stats:${questionId}`,
    };

    // Cache TTL in seconds
    private readonly CACHE_TTL = {
        OPTION: 300, // 5 minutes
        OPTION_LIST: 180, // 3 minutes
        STATS: 600, // 10 minutes
    };

    constructor(
        @InjectRepository(QuestionOption)
        private readonly questionOptionRepository: Repository<QuestionOption>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        private readonly questionsService: QuestionsService,
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    /**
     * Cache helper methods
     */
    private async invalidateOptionCache(
        optionId: number,
        questionId?: number,
    ): Promise<void> {
        const keysToDelete = [this.CACHE_KEYS.OPTION_BY_ID(optionId)];

        if (questionId) {
            keysToDelete.push(this.CACHE_KEYS.OPTIONS_BY_QUESTION(questionId));
            keysToDelete.push(this.CACHE_KEYS.OPTION_STATS(questionId));
        }

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

    private async invalidateQuestionOptionsCache(
        questionId: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.OPTIONS_BY_QUESTION(questionId),
            this.CACHE_KEYS.OPTION_STATS(questionId),
        ];

        await Promise.all(keysToDelete.map(key => this.cacheManager.del(key)));
    }

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
            } catch (error) {
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
     * Create a new question option
     */
    async create(
        createQuestionOptionDto: CreateQuestionOptionDto,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                createQuestionOptionDto.questionId,
                scope,
                userId,
            );

            const option = this.questionOptionRepository.create(
                createQuestionOptionDto,
            );
            await this.questionOptionRepository.save(option);

            // Invalidate caches
            await this.invalidateQuestionOptionsCache(
                createQuestionOptionDto.questionId,
            );

            return {
                message: 'Question option created successfully',
                status: 'success',
                code: 201,
            };
        });
    }

    /**
     * Create multiple options in bulk
     */
    async createBulk(
        bulkCreateDto: BulkCreateOptionsDto,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                bulkCreateDto.questionId,
                scope,
                userId,
            );

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                for (const optionData of bulkCreateDto.options) {
                    const optionDto: CreateQuestionOptionDto = {
                        questionId: bulkCreateDto.questionId,
                        optionText: optionData.optionText,
                        isCorrect: optionData.isCorrect,
                    };

                    const option = queryRunner.manager.create(
                        QuestionOption,
                        optionDto,
                    );
                    await queryRunner.manager.save(option);
                }

                await queryRunner.commitTransaction();

                // Invalidate caches
                await this.invalidateQuestionOptionsCache(
                    bulkCreateDto.questionId,
                );

                return {
                    message: 'Question options created successfully in bulk',
                    status: 'success',
                    code: 201,
                };
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        });
    }

    /**
     * Find options by question
     */
    async findByQuestion(
        questionId: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<QuestionOptionListResponseDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.OPTIONS_BY_QUESTION(questionId);
            const cachedResult =
                await this.cacheManager.get<QuestionOptionListResponseDto>(
                    cacheKey,
                );

            if (cachedResult) {
                return cachedResult;
            }

            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                questionId,
                scope,
                userId,
            );

            const [options, total] = await this.questionOptionRepository
                .createQueryBuilder('option')
                .leftJoinAndSelect('option.question', 'question')
                .where('option.questionId = :questionId', { questionId })
                .orderBy('option.optionId', 'ASC')
                .getManyAndCount();

            const correctCount = options.filter(
                option => option.isCorrect,
            ).length;

            const question = options.length > 0 ? options[0].question : null;

            const result = {
                options: options.map(option => this.mapToResponseDto(option)),
                total,
                correctCount,
                question: question
                    ? {
                          questionId: question.questionId,
                          questionText: question.questionText,
                          questionType: question.questionType,
                          points: question.points,
                      }
                    : undefined,
            };

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.OPTION_LIST * 1000,
            );

            return result;
        });
    }

    /**
     * Find a single option by ID
     */
    async findOne(
        id: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<QuestionOptionResponseDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.OPTION_BY_ID(id);
            const cachedOption =
                await this.cacheManager.get<QuestionOptionResponseDto>(
                    cacheKey,
                );

            if (cachedOption) {
                return cachedOption;
            }

            const option = await this.questionOptionRepository.findOne({
                where: { optionId: id },
                relations: ['question'],
            });

            if (!option) {
                throw new NotFoundException(
                    `Question option with ID ${id} not found`,
                );
            }

            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                option.questionId,
                scope,
                userId,
            );

            const result = this.mapToResponseDto(option);

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.OPTION * 1000,
            );

            return result;
        });
    }

    /**
     * Update a question option
     */
    async update(
        id: number,
        updateQuestionOptionDto: UpdateQuestionOptionDto,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const option = await this.questionOptionRepository.findOne({
                where: { optionId: id },
                relations: ['question'],
            });

            if (!option) {
                throw new NotFoundException(
                    `Question option with ID ${id} not found`,
                );
            }

            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                option.questionId,
                scope,
                userId,
            );

            Object.assign(option, updateQuestionOptionDto);
            await this.questionOptionRepository.save(option);

            // Invalidate caches
            await this.invalidateOptionCache(id, option.questionId);

            return {
                message: 'Question option updated successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Delete a question option
     */
    async remove(
        id: number,
        scope: OrgBranchScope,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const option = await this.questionOptionRepository.findOne({
                where: { optionId: id },
                relations: ['question'],
            });

            if (!option) {
                throw new NotFoundException(
                    `Question option with ID ${id} not found`,
                );
            }

            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                option.questionId,
                scope,
                userId,
            );

            // TODO: Check if option has answers (will be implemented in Answers module)
            // const answersCount = await this.answersService.countByOption(id);
            // if (answersCount > 0) {
            //     throw new BadRequestException('Cannot delete option that has answers');
            // }

            const questionId = option.questionId;
            await this.questionOptionRepository.remove(option);

            // Invalidate caches
            await this.invalidateOptionCache(id, questionId);

            return {
                message: 'Question option deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Validate question access and ownership
     */
    private async validateQuestionAccess(
        questionId: number,
        userId: string,
    ): Promise<void> {
        try {
            await this.questionsService.findOne(questionId, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw new NotFoundException(
                    `Question with ID ${questionId} not found`,
                );
            }
            throw new ForbiddenException(
                'You do not have access to this question',
            );
        }
    }

    /**
     * Validate question access with org/branch scope
     */
    private async validateQuestionAccessWithScope(
        questionId: number,
        scope: OrgBranchScope,
        userId?: string,
    ): Promise<void> {
        try {
            // Use questions service to validate access (it only accepts 2 params)
            await this.questionsService.findOne(questionId, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw new NotFoundException(
                    `Question with ID ${questionId} not found`,
                );
            } else if (error instanceof ForbiddenException) {
                throw new ForbiddenException(
                    'Access denied to the specified question',
                );
            }
            throw error;
        }
    }

    /**
     * Map QuestionOption entity to response DTO
     */
    private mapToResponseDto(
        option: QuestionOption,
    ): QuestionOptionResponseDto {
        return {
            optionId: option.optionId,
            questionId: option.questionId,
            optionText: option.optionText,
            isCorrect: option.isCorrect,
            createdAt: option.createdAt,
            updatedAt: option.updatedAt,
            question: option.question
                ? {
                      questionId: option.question.questionId,
                      questionText: option.question.questionText,
                      questionType: option.question.questionType,
                      points: option.question.points,
                  }
                : undefined,
            // TODO: Add statistics when implementing Answers module
            timesSelected: 0, // Will be calculated when Answers module is implemented
            selectionPercentage: 0, // Will be calculated when Answers module is implemented
        };
    }
}
