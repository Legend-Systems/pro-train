import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
    Logger,
    Inject,
    forwardRef,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionFilterDto } from './dto/question-filter.dto';
import { QuestionResponseDto } from './dto/question-response.dto';
import { QuestionListResponseDto } from './dto/question-list-response.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { StandardOperationResponse } from '../user/dto/common-response.dto';
import { Question } from './entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { TestService } from '../test/test.service';
import { AnswersService } from '../answers/answers.service';
import { QuestionsOptionsService } from '../questions_options/questions_options.service';
import { MediaManagerService } from '../media-manager/media-manager.service';
import { MediaFileResponseDto } from '../media-manager/dto/media-response.dto';

// Type definitions for query results
interface MaxOrderResult {
    maxOrder: number | null;
}

interface TotalPointsResult {
    total: string | null;
}

@Injectable()
export class QuestionsService {
    private readonly logger = new Logger(QuestionsService.name);

    // Cache keys with comprehensive coverage
    private readonly CACHE_KEYS = {
        QUESTION_BY_ID: (id: number) => `question:${id}`,
        QUESTIONS_BY_TEST: (testId: number, filters: string) =>
            `questions:test:${testId}:${filters}`,
        QUESTION_STATS: (testId: number) => `question:stats:${testId}`,
        QUESTION_LIST: (filters: string) => `questions:list:${filters}`,
        QUESTION_COUNT: (testId: number) => `question:count:${testId}`,
        TEST_QUESTIONS_CACHE: (testId: number) => `test:${testId}:questions`,
        USER_QUESTIONS: (userId: string) => `user:${userId}:questions`,
        ALL_QUESTIONS: 'questions:all',
    };

    // Cache TTL in seconds with different durations for different data types
    private readonly CACHE_TTL = {
        QUESTION: 300, // 5 minutes
        QUESTION_LIST: 180, // 3 minutes
        STATS: 600, // 10 minutes
        COUNT: 120, // 2 minutes
        USER_DATA: 240, // 4 minutes
        ALL_QUESTIONS: 900, // 15 minutes
    };

    constructor(
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        private readonly testService: TestService,
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly answersService: AnswersService,
        @Inject(forwardRef(() => QuestionsOptionsService))
        private readonly questionsOptionsService: QuestionsOptionsService,
        private readonly mediaManagerService: MediaManagerService,
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
     * Comprehensive cache invalidation methods
     */
    private async invalidateQuestionCache(
        questionId: number,
        testId?: number,
    ): Promise<void> {
        const keysToDelete = [this.CACHE_KEYS.QUESTION_BY_ID(questionId)];

        if (testId) {
            // Invalidate all test-related caches
            keysToDelete.push(
                this.CACHE_KEYS.QUESTION_STATS(testId),
                this.CACHE_KEYS.QUESTION_COUNT(testId),
                this.CACHE_KEYS.TEST_QUESTIONS_CACHE(testId),
            );

            // Invalidate pattern-based keys for test questions with different filters
            // Note: In production, you might want to use Redis SCAN or similar for pattern-based deletion
            this.logger.debug(`Invalidating cache patterns for test ${testId}`);
        }

        // Also invalidate general question lists
        keysToDelete.push(this.CACHE_KEYS.ALL_QUESTIONS);

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

    private async invalidateTestQuestionsCache(testId: number): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.QUESTION_STATS(testId),
            this.CACHE_KEYS.QUESTION_COUNT(testId),
            this.CACHE_KEYS.TEST_QUESTIONS_CACHE(testId),
            this.CACHE_KEYS.ALL_QUESTIONS,
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

    private async invalidateUserQuestionsCache(userId: string): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.USER_QUESTIONS(userId),
            this.CACHE_KEYS.ALL_QUESTIONS,
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

    private generateCacheKeyForTestQuestions(
        testId: number,
        filters?: QuestionFilterDto,
    ): string {
        const filterKey = JSON.stringify({
            questionType: filters?.questionType,
            minPoints: filters?.minPoints,
            maxPoints: filters?.maxPoints,
            createdFrom: filters?.createdFrom,
            createdTo: filters?.createdTo,
            page: filters?.page,
            pageSize: filters?.pageSize,
        });
        return this.CACHE_KEYS.QUESTIONS_BY_TEST(testId, filterKey);
    }

    /**
     * Create a new question
     */
    async create(
        createQuestionDto: CreateQuestionDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate test access
            await this.validateTestAccess(
                createQuestionDto.testId,
                scope.userId,
            );

            // Validate media file if provided
            if (createQuestionDto.mediaFileId) {
                try {
                    await this.mediaManagerService.getFileById(
                        createQuestionDto.mediaFileId,
                        scope,
                    );
                } catch {
                    throw new BadRequestException(
                        `Invalid media file ID: ${createQuestionDto.mediaFileId}`,
                    );
                }
            }

            // Get test information to inherit org and branch
            const test = await this.testRepository.findOne({
                where: { testId: createQuestionDto.testId },
                relations: ['orgId', 'branchId'],
            });

            if (!test) {
                throw new NotFoundException(
                    `Test with ID ${createQuestionDto.testId} not found`,
                );
            }

            // Auto-increment order index if not provided
            if (!createQuestionDto.orderIndex) {
                const maxOrder = await this.questionRepository
                    .createQueryBuilder('question')
                    .select('MAX(question.orderIndex)', 'maxOrder')
                    .where('question.testId = :testId', {
                        testId: createQuestionDto.testId,
                    })
                    .getRawOne<MaxOrderResult>();

                createQuestionDto.orderIndex = (maxOrder?.maxOrder || 0) + 1;
            } else {
                // Check for duplicate order index
                const existingQuestion = await this.questionRepository.findOne({
                    where: {
                        testId: createQuestionDto.testId,
                        orderIndex: createQuestionDto.orderIndex,
                    },
                });

                if (existingQuestion) {
                    throw new ConflictException(
                        `Question with order index ${createQuestionDto.orderIndex} already exists in this test`,
                    );
                }
            }

            const question = this.questionRepository.create({
                ...createQuestionDto,
                hasMedia: !!createQuestionDto.mediaFileId,
                orgId: test.orgId,
                branchId: test.branchId,
            });
            const savedQuestion = await this.questionRepository.save(question);

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateTestQuestionsCache(createQuestionDto.testId),
                this.invalidateUserQuestionsCache(scope.userId),
            ]);

            this.logger.log(
                `Question ${savedQuestion.questionId} created successfully`,
            );

            return {
                message: 'Question created successfully',
                status: 'success',
                code: 201,
            };
        });
    }

    /**
     * Create multiple questions in bulk
     */
    async createBulk(
        bulkCreateDto: BulkCreateQuestionsDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const testIds = new Set<number>();
                const createdQuestions: Question[] = [];

                for (const questionDto of bulkCreateDto.questions) {
                    // Validate test access for each question
                    await this.validateTestAccess(
                        questionDto.testId,
                        scope.userId,
                    );

                    const question = await this.createQuestionInTransaction(
                        questionDto,
                        queryRunner,
                    );
                    createdQuestions.push(question);
                    testIds.add(questionDto.testId);
                }

                await queryRunner.commitTransaction();

                // Comprehensive cache invalidation for all affected tests
                await Promise.all([
                    ...Array.from(testIds).map(testId =>
                        this.invalidateTestQuestionsCache(testId),
                    ),
                    this.invalidateUserQuestionsCache(scope.userId),
                ]);

                this.logger.log(
                    `${createdQuestions.length} questions created successfully in bulk`,
                );

                return {
                    message: `${createdQuestions.length} questions created successfully`,
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
     * Find questions by test with optional filters and comprehensive caching
     */
    async findByTest(
        testId: number,
        userId?: string,
        filters?: QuestionFilterDto,
    ): Promise<QuestionListResponseDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.generateCacheKeyForTestQuestions(
                testId,
                filters,
            );

            try {
                const cachedResult =
                    await this.cacheManager.get<QuestionListResponseDto>(
                        cacheKey,
                    );

                if (cachedResult) {
                    this.logger.debug(
                        `Cache hit for test questions: ${cacheKey}`,
                    );
                    return cachedResult;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            // Validate test access if userId provided
            if (userId) {
                await this.validateTestAccess(testId, userId);
            }

            const query = this.questionRepository
                .createQueryBuilder('question')
                .leftJoinAndSelect('question.test', 'test')
                .where('question.testId = :testId', { testId });

            // Apply filters
            if (filters?.questionType) {
                query.andWhere('question.questionType = :questionType', {
                    questionType: filters.questionType,
                });
            }
            if (filters?.minPoints) {
                query.andWhere('question.points >= :minPoints', {
                    minPoints: filters.minPoints,
                });
            }
            if (filters?.maxPoints) {
                query.andWhere('question.points <= :maxPoints', {
                    maxPoints: filters.maxPoints,
                });
            }
            if (filters?.createdFrom) {
                query.andWhere('question.createdAt >= :createdFrom', {
                    createdFrom: filters.createdFrom,
                });
            }
            if (filters?.createdTo) {
                query.andWhere('question.createdAt <= :createdTo', {
                    createdTo: filters.createdTo,
                });
            }

            // Order by index
            query.orderBy('question.orderIndex', 'ASC');

            // Pagination
            const page = filters?.page || 1;
            const pageSize = filters?.pageSize || 10;
            const offset = (page - 1) * pageSize;

            const [questions, total] = await query
                .skip(offset)
                .take(pageSize)
                .getManyAndCount();

            const totalPointsResult = await this.questionRepository
                .createQueryBuilder('question')
                .select('SUM(question.points)', 'total')
                .where('question.testId = :testId', { testId })
                .getRawOne<TotalPointsResult>();

            const result = {
                questions: await Promise.all(
                    questions.map(q => this.mapToResponseDto(q)),
                ),
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                totalPoints: parseInt(totalPointsResult?.total || '0'),
            };

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.QUESTION_LIST * 1000,
                );
                this.logger.debug(`Cache set for test questions: ${cacheKey}`);
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
     * Find a single question by ID with comprehensive caching
     */
    async findOne(id: number, userId?: string): Promise<QuestionResponseDto> {
        return this.retryOperation(async () => {
            // Check cache first
            const cacheKey = this.CACHE_KEYS.QUESTION_BY_ID(id);

            try {
                const cachedQuestion =
                    await this.cacheManager.get<QuestionResponseDto>(cacheKey);

                if (cachedQuestion) {
                    this.logger.debug(`Cache hit for question: ${cacheKey}`);
                    return cachedQuestion;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            const question = await this.questionRepository.findOne({
                where: { questionId: id },
                relations: [
                    'test',
                    'test.course',
                    'test.course.orgId',
                    'test.course.branchId',
                    'orgId',
                    'branchId',
                ],
            });

            if (!question) {
                throw new NotFoundException(`Question with ID ${id} not found`);
            }

            // Validate test access if userId provided
            if (userId) {
                await this.validateTestAccess(question.testId, userId);
            }

            const result = await this.mapToResponseDto(question);

            // Cache the result with error handling
            try {
                await this.cacheManager.set(
                    cacheKey,
                    result,
                    this.CACHE_TTL.QUESTION * 1000,
                );
                this.logger.debug(`Cache set for question: ${cacheKey}`);
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
     * Update a question with comprehensive cache invalidation
     */
    async update(
        id: number,
        updateQuestionDto: UpdateQuestionDto,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const question = await this.questionRepository.findOne({
                where: { questionId: id },
                relations: ['test'],
            });

            if (!question) {
                throw new NotFoundException(`Question with ID ${id} not found`);
            }

            // Validate test access
            await this.validateTestAccess(question.testId, userId);

            // Check for order index conflicts if updating
            if (
                updateQuestionDto.orderIndex &&
                updateQuestionDto.orderIndex !== question.orderIndex
            ) {
                const existingQuestion = await this.questionRepository.findOne({
                    where: {
                        testId: question.testId,
                        orderIndex: updateQuestionDto.orderIndex,
                    },
                });

                if (existingQuestion) {
                    throw new ConflictException(
                        `Question with order index ${updateQuestionDto.orderIndex} already exists in this test`,
                    );
                }
            }

            Object.assign(question, updateQuestionDto);
            await this.questionRepository.save(question);

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateQuestionCache(id, question.testId),
                this.invalidateUserQuestionsCache(userId),
            ]);

            this.logger.log(`Question ${id} updated successfully`);

            return {
                message: 'Question updated successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Reorder questions in a test with cache invalidation
     */
    async reorder(
        testId: number,
        reorderData: { questionId: number; newOrderIndex: number }[],
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            // Validate test access
            await this.validateTestAccess(testId, userId);

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                for (const { questionId, newOrderIndex } of reorderData) {
                    await queryRunner.manager.update(
                        Question,
                        { questionId, testId },
                        { orderIndex: newOrderIndex },
                    );
                }

                await queryRunner.commitTransaction();

                // Comprehensive cache invalidation
                await Promise.all([
                    this.invalidateTestQuestionsCache(testId),
                    this.invalidateUserQuestionsCache(userId),
                    // Invalidate individual question caches
                    ...reorderData.map(({ questionId }) =>
                        this.invalidateQuestionCache(questionId, testId),
                    ),
                ]);

                this.logger.log(
                    `Questions reordered successfully in test ${testId}`,
                );

                return {
                    message: 'Questions reordered successfully',
                    status: 'success',
                    code: 200,
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
     * Delete a question with comprehensive cache invalidation
     */
    async remove(
        id: number,
        userId: string,
    ): Promise<StandardOperationResponse> {
        return this.retryOperation(async () => {
            const question = await this.questionRepository.findOne({
                where: { questionId: id },
                relations: ['test'],
            });

            if (!question) {
                throw new NotFoundException(`Question with ID ${id} not found`);
            }

            // Validate test access
            await this.validateTestAccess(question.testId, userId);

            // Check if question has answers
            const answersCount = await this.answersService.countByQuestion(id);
            if (answersCount > 0) {
                throw new ConflictException(
                    'Cannot delete question that has answers',
                );
            }

            const testId = question.testId;
            await this.questionRepository.remove(question);

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateQuestionCache(id, testId),
                this.invalidateUserQuestionsCache(userId),
            ]);

            this.logger.log(`Question ${id} deleted successfully`);

            return {
                message: 'Question deleted successfully',
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Get question count for a test with caching
     */
    async getQuestionCount(testId: number): Promise<number> {
        return this.retryOperation(async () => {
            const cacheKey = this.CACHE_KEYS.QUESTION_COUNT(testId);

            try {
                const cachedCount =
                    await this.cacheManager.get<number>(cacheKey);
                if (cachedCount !== undefined && cachedCount !== null) {
                    this.logger.debug(
                        `Cache hit for question count: ${cacheKey}`,
                    );
                    return cachedCount;
                }
            } catch (error) {
                this.logger.warn(
                    `Cache get failed for key ${cacheKey}:`,
                    error,
                );
            }

            const count = await this.questionRepository.count({
                where: { testId },
            });

            try {
                await this.cacheManager.set(
                    cacheKey,
                    count,
                    this.CACHE_TTL.COUNT * 1000,
                );
                this.logger.debug(`Cache set for question count: ${cacheKey}`);
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
     * Validate test access and ownership
     */
    private async validateTestAccess(
        testId: number,
        userId: string,
    ): Promise<void> {
        try {
            await this.testService.validateCourseAccess(testId, userId);
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw new NotFoundException(`Test with ID ${testId} not found`);
            }
            throw new ForbiddenException('You do not have access to this test');
        }
    }

    /**
     * Create question within transaction
     */
    private async createQuestionInTransaction(
        createQuestionDto: CreateQuestionDto,
        queryRunner: QueryRunner,
    ): Promise<Question> {
        // Auto-increment order index if not provided
        if (!createQuestionDto.orderIndex) {
            const maxOrder = await queryRunner.manager
                .createQueryBuilder(Question, 'question')
                .select('MAX(question.orderIndex)', 'maxOrder')
                .where('question.testId = :testId', {
                    testId: createQuestionDto.testId,
                })
                .getRawOne<MaxOrderResult>();

            createQuestionDto.orderIndex = (maxOrder?.maxOrder || 0) + 1;
        }

        const question = queryRunner.manager.create(
            Question,
            createQuestionDto,
        );
        return await queryRunner.manager.save(question);
    }

    /**
     * Map Question entity to response DTO
     */
    private async mapToResponseDto(
        question: Question,
    ): Promise<QuestionResponseDto> {
        // Get actual counts from related services
        const [optionsCount, answersCount] = await Promise.all([
            this.questionsOptionsService.getOptionCount(question.questionId),
            this.answersService.countByQuestion(question.questionId),
        ]);

        // Get media file information if the question has media
        let mediaFile: MediaFileResponseDto | undefined = undefined;
        if (question.mediaFileId) {
            try {
                mediaFile = await this.mediaManagerService.getFileById(
                    question.mediaFileId,
                );
            } catch (error) {
                this.logger.warn(
                    `Failed to load media file ${question.mediaFileId} for question ${question.questionId}:`,
                    error,
                );
                // Media file might be deleted or inaccessible, continue without it
            }
        }

        return {
            questionId: question.questionId,
            testId: question.testId,
            questionText: question.questionText,
            questionType: question.questionType,
            points: question.points,
            orderIndex: question.orderIndex,
            mediaFileId: question.mediaFileId,
            hasMedia: question.hasMedia || false,
            mediaInstructions: question.mediaInstructions,
            mediaFile,
            createdAt: question.createdAt,
            updatedAt: question.updatedAt,
            test: question.test
                ? {
                      testId: question.test.testId,
                      title: question.test.title,
                      testType: question.test.testType,
                  }
                : undefined,
            optionsCount,
            answersCount,
        };
    }
}
