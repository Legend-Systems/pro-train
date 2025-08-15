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
import { RetryService } from '../common/services/retry.service';

// Type definitions for query results
interface MaxOrderResult {
    maxOrder: number | null;
}

@Injectable()
export class QuestionsService {
    private readonly logger = new Logger(QuestionsService.name);

    // Cache keys with comprehensive coverage and org/branch scope
    private readonly CACHE_KEYS = {
        QUESTION_BY_ID: (id: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question:${id}`,
        QUESTIONS_BY_TEST: (
            testId: number,
            filters: string,
            orgId?: number,
            branchId?: number,
        ) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:questions:test:${testId}:${filters}`,
        QUESTION_STATS: (testId: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question:stats:${testId}`,
        QUESTION_LIST: (filters: string, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:questions:list:${filters}`,
        QUESTION_COUNT: (testId: number, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:question:count:${testId}`,
        TEST_QUESTIONS_CACHE: (
            testId: number,
            orgId?: number,
            branchId?: number,
        ) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:test:${testId}:questions`,
        USER_QUESTIONS: (userId: string, orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:user:${userId}:questions`,
        ALL_QUESTIONS: (orgId?: number, branchId?: number) =>
            `org:${orgId || 'global'}:branch:${
                branchId || 'global'
            }:questions:all`,
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
        private readonly retryService: RetryService,
    ) {}

    /**
     * Comprehensive cache invalidation methods with org/branch scope
     */
    private async invalidateQuestionCache(
        questionId: number,
        testId?: number,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.QUESTION_BY_ID(questionId, orgId, branchId),
        ];

        if (testId) {
            // Invalidate all test-related caches
            keysToDelete.push(
                this.CACHE_KEYS.QUESTION_STATS(testId, orgId, branchId),
                this.CACHE_KEYS.QUESTION_COUNT(testId, orgId, branchId),
                this.CACHE_KEYS.TEST_QUESTIONS_CACHE(testId, orgId, branchId),
            );

            // Invalidate pattern-based keys for test questions with different filters
            // Note: In production, you might want to use Redis SCAN or similar for pattern-based deletion
            this.logger.debug(`Invalidating cache patterns for test ${testId}`);
        }

        // Also invalidate general question lists
        keysToDelete.push(this.CACHE_KEYS.ALL_QUESTIONS(orgId, branchId));

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

    private async invalidateTestQuestionsCache(
        testId: number,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.QUESTION_STATS(testId, orgId, branchId),
            this.CACHE_KEYS.QUESTION_COUNT(testId, orgId, branchId),
            this.CACHE_KEYS.TEST_QUESTIONS_CACHE(testId, orgId, branchId),
            this.CACHE_KEYS.ALL_QUESTIONS(orgId, branchId),
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

    private async invalidateUserQuestionsCache(
        userId: string,
        orgId?: number,
        branchId?: number,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.USER_QUESTIONS(userId, orgId, branchId),
            this.CACHE_KEYS.ALL_QUESTIONS(orgId, branchId),
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
        orgId?: number,
        branchId?: number,
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
        return this.CACHE_KEYS.QUESTIONS_BY_TEST(
            testId,
            filterKey,
            orgId,
            branchId,
        );
    }

    /**
     * Create a new question
     */
    async create(
        createQuestionDto: CreateQuestionDto,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
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
                this.invalidateTestQuestionsCache(
                    createQuestionDto.testId,
                    test.orgId
                        ? Number(test.orgId)
                        : scope.orgId
                          ? Number(scope.orgId)
                          : undefined,
                    test.branchId
                        ? Number(test.branchId)
                        : scope.branchId
                          ? Number(scope.branchId)
                          : undefined,
                ),
                this.invalidateUserQuestionsCache(
                    scope.userId,
                    scope.orgId ? Number(scope.orgId) : undefined,
                    scope.branchId ? Number(scope.branchId) : undefined,
                ),
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
        return this.retryService.executeDatabase(async () => {
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
                        this.invalidateTestQuestionsCache(
                            testId,
                            scope.orgId ? Number(scope.orgId) : undefined,
                            scope.branchId ? Number(scope.branchId) : undefined,
                        ),
                    ),
                    this.invalidateUserQuestionsCache(
                        scope.userId,
                        scope.orgId ? Number(scope.orgId) : undefined,
                        scope.branchId ? Number(scope.branchId) : undefined,
                    ),
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
        scope: OrgBranchScope,
        filters?: QuestionFilterDto,
    ): Promise<QuestionListResponseDto> {
        return this.retryService.executeDatabase(async () => {
            // Check cache first
            const cacheKey = this.generateCacheKeyForTestQuestions(
                testId,
                filters,
                scope.orgId ? Number(scope.orgId) : undefined,
                scope.branchId ? Number(scope.branchId) : undefined,
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

            // Validate test access with scope
            await this.validateTestAccessWithScope(testId, scope);

            const query = this.questionRepository
                .createQueryBuilder('question')
                .leftJoinAndSelect('question.test', 'test')
                .leftJoinAndSelect('question.orgId', 'org')
                .leftJoinAndSelect('question.branchId', 'branch')
                .where('question.testId = :testId', { testId });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

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

            // Apply sorting (use orderIndex by default)
            query.orderBy('question.orderIndex', 'ASC');

            // Apply pagination
            const page = filters?.page || 1;
            const pageSize = Math.min(filters?.pageSize || 50, 100); // Cap at 100
            const skip = (page - 1) * pageSize;

            query.skip(skip).take(pageSize);

            const [questions, total] = await query.getManyAndCount();

            // Map to response DTOs
            const questionDtos = await Promise.all(
                questions.map(question => this.mapToResponseDto(question)),
            );

            const result: QuestionListResponseDto = {
                questions: questionDtos,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                totalPoints: questions.reduce((sum, q) => sum + q.points, 0),
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
    /**
     * Validate that all question IDs exist and are accessible within the given scope
     * Returns validation results with detailed error information
     */
    async validateQuestionsExist(
        questionIds: number[],
        scope: OrgBranchScope,
        context?: { testId?: number; attemptId?: number; userId?: string }
    ): Promise<{
        valid: boolean;
        validQuestionIds: number[];
        invalidQuestionIds: number[];
        errors: string[];
        timing: { startTime: Date; endTime: Date; durationMs: number };
    }> {
        const startTime = new Date();
        const logContext = context ? 
            `[Test: ${context.testId}, Attempt: ${context.attemptId}, User: ${context.userId}]` : 
            '[Bulk Validation]';

        this.logger.log(`${logContext} Validating ${questionIds.length} question IDs: [${questionIds.join(', ')}]`);

        return this.retryService.executeDatabase(async () => {
            const validQuestionIds: number[] = [];
            const invalidQuestionIds: number[] = [];
            const errors: string[] = [];

            try {
                // Build query to check all questions at once for efficiency
                const query = this.questionRepository
                    .createQueryBuilder('question')
                    .select(['question.questionId', 'question.testId'])
                    .where('question.questionId IN (:...questionIds)', { questionIds });

                // Apply org/branch scoping
                if (scope.orgId) {
                    query.andWhere('question.orgId = :orgId', { orgId: scope.orgId });
                }
                if (scope.branchId) {
                    query.andWhere('question.branchId = :branchId', { branchId: scope.branchId });
                }

                const existingQuestions = await query.getMany();
                const foundQuestionIds = existingQuestions.map(q => q.questionId);

                // Categorize question IDs
                questionIds.forEach(questionId => {
                    if (foundQuestionIds.includes(questionId)) {
                        validQuestionIds.push(questionId);
                    } else {
                        invalidQuestionIds.push(questionId);
                        errors.push(`Question ID ${questionId} not found or not accessible in current scope`);
                    }
                });

                const endTime = new Date();
                const durationMs = endTime.getTime() - startTime.getTime();

                this.logger.log(
                    `${logContext} Question validation completed in ${durationMs}ms: ` +
                    `${validQuestionIds.length} valid, ${invalidQuestionIds.length} invalid`
                );

                if (invalidQuestionIds.length > 0) {
                    this.logger.warn(
                        `${logContext} Invalid question IDs detected: [${invalidQuestionIds.join(', ')}]`
                    );
                }

                return {
                    valid: invalidQuestionIds.length === 0,
                    validQuestionIds,
                    invalidQuestionIds,
                    errors,
                    timing: { startTime, endTime, durationMs }
                };

            } catch (error) {
                const endTime = new Date();
                const durationMs = endTime.getTime() - startTime.getTime();
                
                this.logger.error(
                    `${logContext} Question validation failed after ${durationMs}ms:`,
                    error
                );
                
                throw error;
            }
        });
    }

    async findOne(
        id: number,
        scope: OrgBranchScope,
    ): Promise<QuestionResponseDto> {
        return this.retryService.executeDatabase(async () => {
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

            const query = this.questionRepository
                .createQueryBuilder('question')
                .leftJoinAndSelect('question.test', 'test')
                .leftJoinAndSelect('test.course', 'course')
                .leftJoinAndSelect('course.orgId', 'course_org')
                .leftJoinAndSelect('course.branchId', 'course_branch')
                .leftJoinAndSelect('question.orgId', 'org')
                .leftJoinAndSelect('question.branchId', 'branch')
                .where('question.questionId = :id', { id });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const question = await query.getOne();

            if (!question) {
                throw new NotFoundException(`Question with ID ${id} not found`);
            }

            // Validate test access with scope
            await this.validateTestAccessWithScope(question.testId, scope);

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
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            const query = this.questionRepository
                .createQueryBuilder('question')
                .leftJoinAndSelect('question.test', 'test')
                .leftJoinAndSelect('question.orgId', 'org')
                .leftJoinAndSelect('question.branchId', 'branch')
                .where('question.questionId = :id', { id });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const question = await query.getOne();

            if (!question) {
                throw new NotFoundException(`Question with ID ${id} not found`);
            }

            // Validate test access with scope
            await this.validateTestAccessWithScope(question.testId, scope);

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
                this.invalidateQuestionCache(
                    id,
                    question.testId,
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
                this.invalidateUserQuestionsCache(
                    scope.userId,
                    scope.orgId ? Number(scope.orgId) : undefined,
                    scope.branchId ? Number(scope.branchId) : undefined,
                ),
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
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        return this.retryService.executeDatabase(async () => {
            // Validate test access with scope
            await this.validateTestAccessWithScope(testId, scope);

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                for (const { questionId, newOrderIndex } of reorderData) {
                    // Verify each question belongs to the correct org/branch
                    const question = await this.questionRepository.findOne({
                        where: { questionId, testId },
                        relations: ['orgId', 'branchId'],
                    });

                    if (!question) {
                        throw new NotFoundException(
                            `Question with ID ${questionId} not found`,
                        );
                    }

                    // Validate org/branch scope for each question
                    if (scope.orgId && question.orgId?.id !== scope.orgId) {
                        throw new ForbiddenException(
                            `Question ${questionId} does not belong to your organization`,
                        );
                    }
                    if (
                        scope.branchId &&
                        question.branchId?.id !== scope.branchId
                    ) {
                        throw new ForbiddenException(
                            `Question ${questionId} does not belong to your branch`,
                        );
                    }

                    await queryRunner.manager.update(
                        Question,
                        { questionId, testId },
                        { orderIndex: newOrderIndex },
                    );
                }

                await queryRunner.commitTransaction();

                // Comprehensive cache invalidation
                await Promise.all([
                    this.invalidateTestQuestionsCache(
                        testId,
                        scope.orgId ? Number(scope.orgId) : undefined,
                        scope.branchId ? Number(scope.branchId) : undefined,
                    ),
                    this.invalidateUserQuestionsCache(
                        scope.userId,
                        scope.orgId ? Number(scope.orgId) : undefined,
                        scope.branchId ? Number(scope.branchId) : undefined,
                    ),
                    // Invalidate individual question caches
                    ...reorderData.map(({ questionId }) =>
                        this.invalidateQuestionCache(
                            questionId,
                            testId,
                            scope.orgId ? Number(scope.orgId) : undefined,
                            scope.branchId ? Number(scope.branchId) : undefined,
                        ),
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
     * Delete a question with comprehensive validation, logging, and cache invalidation
     */
    async remove(
        id: number,
        scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        const startTime = new Date();
        const logContext = `[Question: ${id}, User: ${scope.userId}]`;
        
        this.logger.log(`${logContext} Initiating question deletion process`);

        return this.retryService.executeDatabase(async () => {
            const query = this.questionRepository
                .createQueryBuilder('question')
                .leftJoinAndSelect('question.test', 'test')
                .leftJoinAndSelect('question.orgId', 'org')
                .leftJoinAndSelect('question.branchId', 'branch')
                .where('question.questionId = :id', { id });

            // Apply org/branch scoping
            if (scope.orgId) {
                query.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                query.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const question = await query.getOne();

            if (!question) {
                this.logger.warn(`${logContext} Question not found or not accessible`);
                throw new NotFoundException(`Question with ID ${id} not found`);
            }

            this.logger.log(
                `${logContext} Found question "${question.questionText.substring(0, 50)}..." ` +
                `in test ${question.testId}, order ${question.orderIndex}`
            );

            // Validate test access with scope
            await this.validateTestAccessWithScope(question.testId, scope);

            // Step 1: Check for active test attempts that might reference this question
            const activeAttemptsQuery = this.dataSource
                .createQueryBuilder()
                .select(['attempt.attemptId', 'attempt.userId', 'attempt.startTime', 'attempt.status'])
                .from('test_attempts', 'attempt')
                .where('attempt.testId = :testId', { testId: question.testId })
                .andWhere('attempt.status = :status', { status: 'in_progress' });

            const activeAttempts = await activeAttemptsQuery.getRawMany();

            if (activeAttempts.length > 0) {
                this.logger.error(
                    `${logContext} DELETION BLOCKED: ${activeAttempts.length} active test attempts detected ` +
                    `for test ${question.testId}. Active attempts: ${activeAttempts.map(a => a.attemptId).join(', ')}`
                );
                
                // Log detailed information about each active attempt
                for (const attempt of activeAttempts) {
                    this.logger.warn(
                        `${logContext} Active attempt ${attempt.attemptId} by user ${attempt.userId}, ` +
                        `started: ${attempt.startTime}, status: ${attempt.status}`
                    );
                }

                throw new ConflictException(
                    `Cannot delete question: ${activeAttempts.length} active test attempts in progress. ` +
                    `Please wait for all attempts to complete or contact users to finish their tests.`
                );
            }

            this.logger.log(`${logContext} No active test attempts found for test ${question.testId}`);

            // Step 2: Check if question has submitted answers (existing check)
            const answersCount = await this.answersService.countByQuestion(
                id,
                scope,
            );
            
            if (answersCount > 0) {
                this.logger.error(
                    `${logContext} DELETION BLOCKED: Question has ${answersCount} submitted answers`
                );
                throw new ConflictException(
                    `Cannot delete question that has ${answersCount} submitted answers. ` +
                    `Consider archiving the question instead.`
                );
            }

            this.logger.log(`${logContext} No submitted answers found, proceeding with deletion`);

            // Step 3: Log detailed deletion information for audit trail
            this.logger.log(
                `${logContext} DELETING QUESTION: ` +
                `Text: "${question.questionText.substring(0, 100)}${question.questionText.length > 100 ? '...' : ''}", ` +
                `Type: ${question.questionType}, Points: ${question.points}, Order: ${question.orderIndex}, ` +
                `Test: ${question.testId}, HasMedia: ${question.hasMedia}`
            );

            // Step 4: Perform the deletion
            const deletionStart = new Date();
            await this.questionRepository.remove(question);
            const deletionDuration = new Date().getTime() - deletionStart.getTime();

            this.logger.log(
                `${logContext} Question successfully deleted from database in ${deletionDuration}ms`
            );

            // Comprehensive cache invalidation
            await Promise.all([
                this.invalidateQuestionCache(
                    id,
                    question.testId,
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
                this.invalidateUserQuestionsCache(
                    scope.userId,
                    scope.orgId ? Number(scope.orgId) : undefined,
                    scope.branchId ? Number(scope.branchId) : undefined,
                ),
            ]);

            const endTime = new Date();
            const totalDuration = endTime.getTime() - startTime.getTime();

            this.logger.log(
                `${logContext} Question deletion process completed successfully in ${totalDuration}ms. ` +
                `Cache invalidation completed.`
            );

            return {
                message: `Question deleted successfully in ${totalDuration}ms`,
                status: 'success',
                code: 200,
            };
        });
    }

    /**
     * Get question count for a test with caching and scope validation
     */
    async getQuestionCount(
        testId: number,
        scope?: OrgBranchScope,
    ): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            // Validate test access if scope is provided
            if (scope) {
                await this.validateTestAccessWithScope(testId, scope);
            }

            const cacheKey = this.CACHE_KEYS.QUESTION_COUNT(
                testId,
                scope?.orgId ? Number(scope.orgId) : undefined,
                scope?.branchId ? Number(scope.branchId) : undefined,
            );

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

            const query = this.questionRepository
                .createQueryBuilder('question')
                .where('question.testId = :testId', { testId });

            // Apply org/branch scoping if scope is provided
            if (scope?.orgId) {
                query.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope?.branchId) {
                query.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const count = await query.getCount();

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
            this.answersService.countByQuestion(question.questionId, {
                userId: 'system', // Using system scope for count queries
            }),
        ]);

        // Get media file information if the question has media
        let mediaFile: MediaFileResponseDto | undefined = undefined;
        if (question.mediaFileId) {
            try {
                // Skip scope validation for media file access (relations not loaded)
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

    /**
     * Validate test access with scope
     */
    private async validateTestAccessWithScope(
        testId: number,
        scope: OrgBranchScope,
    ): Promise<void> {
        await this.validateTestAccess(testId, scope.userId);
    }
}
