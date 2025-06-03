import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
    Inject,
    forwardRef,
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
import { RetryService } from '../common/services/retry.service';

@Injectable()
export class QuestionsOptionsService {
    private readonly logger = new Logger(QuestionsOptionsService.name);

    // Cache keys with comprehensive coverage and org/branch scope
    private readonly CACHE_KEYS = {
        OPTION_BY_ID: (id: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question-option:${id}`,
        OPTIONS_BY_QUESTION: (
            questionId: number,
            orgId?: number,
            branchId?: number,
        ) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question-options:question:${questionId}`,
        OPTION_STATS: (questionId: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question-option:stats:${questionId}`,
        OPTION_LIST: (filters: string, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question-options:list:${filters}`,
        QUESTION_OPTIONS_COUNT: (
            questionId: number,
            orgId?: number,
            branchId?: number,
        ) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question:${questionId}:options:count`,
        USER_OPTIONS: (userId: string, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:user:${userId}:options`,
        ALL_OPTIONS: (orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question-options:all`,
        CORRECT_OPTIONS: (
            questionId: number,
            orgId?: number,
            branchId?: number,
        ) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question:${questionId}:correct-options`,
    };

    // Cache TTL in seconds with different durations for different data types
    private readonly CACHE_TTL = {
        OPTION: 300, // 5 minutes
        OPTION_LIST: 180, // 3 minutes
        STATS: 600, // 10 minutes
        COUNT: 120, // 2 minutes
        USER_DATA: 240, // 4 minutes
        ALL_OPTIONS: 900, // 15 minutes
        CORRECT_OPTIONS: 300, // 5 minutes
    };

    constructor(
        @InjectRepository(QuestionOption)
        private readonly questionOptionRepository: Repository<QuestionOption>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @Inject(forwardRef(() => QuestionsService))
        private readonly questionsService: QuestionsService,
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
    ) {}

    /**
     * Comprehensive cache invalidation methods with org/branch scope
     */
    private async invalidateOptionCache(
        optionId: number,
        questionId?: number,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.OPTION_BY_ID(optionId, orgId, branchId),
        ];

        if (questionId) {
            keysToDelete.push(
                this.CACHE_KEYS.OPTIONS_BY_QUESTION(
                    questionId,
                    orgId,
                    branchId,
                ),
                this.CACHE_KEYS.OPTION_STATS(questionId, orgId, branchId),
                this.CACHE_KEYS.QUESTION_OPTIONS_COUNT(
                    questionId,
                    orgId,
                    branchId,
                ),
                this.CACHE_KEYS.CORRECT_OPTIONS(questionId, orgId, branchId),
            );
        }

        // Also invalidate general option lists
        keysToDelete.push(this.CACHE_KEYS.ALL_OPTIONS(orgId, branchId));

        await Promise.all(
            keysToDelete.map(async key => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                }
            }),
        );
    }

    private async invalidateQuestionOptionsCache(
        questionId: number,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.OPTIONS_BY_QUESTION(questionId, orgId, branchId),
            this.CACHE_KEYS.OPTION_STATS(questionId, orgId, branchId),
            this.CACHE_KEYS.QUESTION_OPTIONS_COUNT(questionId, orgId, branchId),
            this.CACHE_KEYS.CORRECT_OPTIONS(questionId, orgId, branchId),
            this.CACHE_KEYS.ALL_OPTIONS(orgId, branchId),
        ];

        await Promise.all(
            keysToDelete.map(async key => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                }
            }),
        );
    }

    private async invalidateUserOptionsCache(
        userId: string,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.USER_OPTIONS(userId, orgId, branchId),
            this.CACHE_KEYS.ALL_OPTIONS(orgId, branchId),
        ];

        await Promise.all(
            keysToDelete.map(async key => {
                try {
                    await this.cacheManager.del(key);
                } catch (error) {
                    this.logger.warn(
                        `Failed to delete cache key ${key}:`,
                        error,
                    );
                }
            }),
        );
    }

    /**
     * Create a new question option with comprehensive caching
     */
    async create(
        createQuestionOptionDto: CreateQuestionOptionDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                createQuestionOptionDto.questionId,
                scope,
            );

            // Get question information to inherit org and branch
            const question = await this.questionRepository.findOne({
                where: { questionId: createQuestionOptionDto.questionId },
                relations: ['orgId', 'branchId'],
            });

            if (!question) {
                throw new NotFoundException(
                    `Question with ID ${createQuestionOptionDto.questionId} not found`,
                );
            }

            const option = this.questionOptionRepository.create({
                ...createQuestionOptionDto,
                orgId: question.orgId,
                branchId: question.branchId,
            });
            const savedOption =
                await this.questionOptionRepository.save(option);

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateQuestionOptionsCache(
                    createQuestionOptionDto.questionId,
                    question.orgId
                        ? Number(question.orgId)
                        : scope.orgId
                          ? Number(scope.orgId)
                          : undefined,
                    question.branchId
                        ? Number(question.branchId)
                        : scope.branchId
                          ? Number(scope.branchId)
                          : undefined,
                ),
                this.invalidateUserOptionsCache(
                    scope.userId,
                    scope.orgId ? Number(scope.orgId) : undefined,
                    scope.branchId ? Number(scope.branchId) : undefined,
                ),
            ]);

            this.logger.log(
                `Question option ${savedOption.optionId} created successfully`,
            );

            return {
                message: 'Question option created successfully',
                status: 'success',
                code: 201,
            };
        });
    }

    /**
     * Create multiple options in bulk with comprehensive caching
     */
    async createBulk(
        bulkCreateDto: BulkCreateOptionsDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // Validate question access with scope
            await this.validateQuestionAccessWithScope(
                bulkCreateDto.questionId,
                scope,
            );

            // Get question information to inherit org and branch
            const question = await this.questionRepository.findOne({
                where: { questionId: bulkCreateDto.questionId },
                relations: ['orgId', 'branchId'],
            });

            if (!question) {
                throw new NotFoundException(
                    `Question with ID ${bulkCreateDto.questionId} not found`,
                );
            }

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const createdOptions: QuestionOption[] = [];

                for (const optionData of bulkCreateDto.options) {
                    const optionDto = {
                        questionId: bulkCreateDto.questionId,
                        optionText: optionData.optionText,
                        isCorrect: optionData.isCorrect,
                        orgId: question.orgId,
                        branchId: question.branchId,
                    };

                    const option = queryRunner.manager.create(
                        QuestionOption,
                        optionDto,
                    );
                    const savedOption = await queryRunner.manager.save(option);
                    createdOptions.push(savedOption);
                }

                await queryRunner.commitTransaction();

                // Comprehensive cache invalidation
                await Promise.all([
                    this.invalidateQuestionOptionsCache(
                        bulkCreateDto.questionId,
                        question.orgId
                            ? Number(question.orgId)
                            : scope.orgId
                              ? Number(scope.orgId)
                              : undefined,
                        question.branchId
                            ? Number(question.branchId)
                            : scope.branchId
                              ? Number(scope.branchId)
                              : undefined,
                    ),
                    this.invalidateUserOptionsCache(
                        scope.userId,
                        scope.orgId ? Number(scope.orgId) : undefined,
                        scope.branchId ? Number(scope.branchId) : undefined,
                    ),
                ]);

                this.logger.log(
                    `${createdOptions.length} question options created successfully in bulk`,
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
     * Find options by question with comprehensive caching
     */
    async findByQuestion(
        questionId: number,
        scope: OrgBranchScope,
    ): Promise<QuestionOptionListResponseDto> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.OPTIONS_BY_QUESTION(
                questionId,
                scope.orgId ? Number(scope.orgId) : undefined,
                scope.branchId ? Number(scope.branchId) : undefined,
            );

            try {
                const cachedResult =
                    await this.cacheManager.get<QuestionOptionListResponseDto>(
                        cacheKey,
                    );

                if (cachedResult) {
                    this.logger.debug(
                        `Cache hit for question options: ${cacheKey}`,
                    );
                    return cachedResult;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // Validate question access with scope
            await this.validateQuestionAccessWithScope(questionId, scope);

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

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.OPTION_LIST * 1000,
                );
                this.logger.debug(
                    `Cache set for question options: ${cacheKey}`,
                );
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return result;
        });
    }

    /**
     * Find a single option by ID with comprehensive caching
     */
    async findOne(
        id: number,
        scope: OrgBranchScope,
    ): Promise<QuestionOptionResponseDto> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.OPTION_BY_ID(
                id,
                scope.orgId ? Number(scope.orgId) : undefined,
                scope.branchId ? Number(scope.branchId) : undefined,
            );

            try {
                const cachedOption =
                    await this.cacheManager.get<QuestionOptionResponseDto>(
                        cacheKey,
                    );

                if (cachedOption) {
                    this.logger.debug(`Cache hit for option: ${cacheKey}`);
                    return cachedOption;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
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
            );

            const result = this.mapToResponseDto(option);

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.OPTION * 1000,
                );
                this.logger.debug(`Cache set for option: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return result;
        });
    }

    /**
     * Update a question option with comprehensive cache invalidation
     */
    async update(
        id: number,
        updateQuestionOptionDto: UpdateQuestionOptionDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
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
            );

            Object.assign(option, updateQuestionOptionDto);
            await this.questionOptionRepository.save(option);

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateOptionCache(
                    id,
                    option.questionId,
                    option.question?.orgId
                        ? Number(option.question.orgId)
                        : scope.orgId
                          ? Number(scope.orgId)
                          : undefined,
                    option.question?.branchId
                        ? Number(option.question.branchId)
                        : scope.branchId
                          ? Number(scope.branchId)
                          : undefined,
                ),
                this.invalidateUserOptionsCache(
                    scope.userId,
                    scope.orgId ? Number(scope.orgId) : undefined,
                    scope.branchId ? Number(scope.branchId) : undefined,
                ),
            ]);

            this.logger.log(`Question option ${id} updated successfully`);

            return {
                message: 'Question option updated successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Delete a question option with comprehensive cache invalidation
     */
    async remove(
        id: number,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
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
            );

            // TODO: Check if option has answers (will be implemented in Answers module)
            // const answersCount = await this.answersService.countByOption(id);
            // if (answersCount > 0) {
            //     throw new BadRequestException('Cannot delete option that has answers');
            // }

            const questionId = option.questionId;
            await this.questionOptionRepository.remove(option);

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateOptionCache(
                    id,
                    questionId,
                    option.question?.orgId
                        ? Number(option.question.orgId)
                        : scope.orgId
                          ? Number(scope.orgId)
                          : undefined,
                    option.question?.branchId
                        ? Number(option.question.branchId)
                        : scope.branchId
                          ? Number(scope.branchId)
                          : undefined,
                ),
                this.invalidateUserOptionsCache(
                    scope.userId,
                    scope.orgId ? Number(scope.orgId) : undefined,
                    scope.branchId ? Number(scope.branchId) : undefined,
                ),
            ]);

            this.logger.log(`Question option ${id} deleted successfully`);

            return {
                message: 'Question option deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Get option count for a question with caching
     */
    async getOptionCount(
        questionId: number,
        orgId?: number,
        branchId?: number,
    ): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const cacheKey = this.CACHE_KEYS.QUESTION_OPTIONS_COUNT(
                questionId,
                orgId,
                branchId,
            );

            try {
                const cachedCount =
                    await this.cacheManager.get<number>(cacheKey);
                if (cachedCount !== undefined && cachedCount !== null) {
                    this.logger.debug(
                        `Cache hit for option count: ${cacheKey}`,
                    );
                    return cachedCount;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            const count = await this.questionOptionRepository.count({
                where: { questionId },
            });

            try {
                await this.cacheManager.set(
                    cacheKey,
                    count,
                    this.CACHE_TTL.COUNT * 1000,
                );
                this.logger.debug(`Cache set for option count: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return count;
        });
    }

    /**
     * Get correct options for a question with caching
     */
    async getCorrectOptions(
        questionId: number,
        orgId?: number,
        branchId?: number,
    ): Promise<QuestionOption[]> {
        return this.retryService.executeDatabase(async () => {
            const cacheKey = this.CACHE_KEYS.CORRECT_OPTIONS(
                questionId,
                orgId,
                branchId,
            );

            try {
                const cachedOptions =
                    await this.cacheManager.get<QuestionOption[]>(cacheKey);
                if (cachedOptions) {
                    this.logger.debug(
                        `Cache hit for correct options: ${cacheKey}`,
                    );
                    return cachedOptions;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            const correctOptions = await this.questionOptionRepository.find({
                where: { questionId, isCorrect: true },
                order: { optionId: 'ASC' },
            });

            try {
                await this.cacheManager.set(
                    cacheKey,
                    correctOptions,
                    this.CACHE_TTL.CORRECT_OPTIONS * 1000,
                );
                this.logger.debug(`Cache set for correct options: ${cacheKey}`);
            } catch (error) {
                this.logger.warn(
                    `Cache set failed for key ${cacheKey}:`,
                    error,
                );
            }

            return correctOptions;
        });
    }

    /**
     * Validate question access and ownership (deprecated - use validateQuestionAccessWithScope)
     */
    private async validateQuestionAccess(
        questionId: number,
        userId: string,
    ): Promise<void> {
        // Create a minimal scope for backward compatibility
        const scope: OrgBranchScope = {
            userId,
            orgId: undefined,
            branchId: undefined,
        };

        try {
            await this.questionsService.findOne(questionId, scope);
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
    ): Promise<void> {
        try {
            // Use questions service to validate access with scope
            await this.questionsService.findOne(questionId, scope);
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
