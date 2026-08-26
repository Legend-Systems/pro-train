import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Inject,
    Logger,
    forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Answer } from './entities/answer.entity';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { MarkAnswerDto } from './dto/mark-answer.dto';
import { BulkAnswersDto } from './dto/bulk-answers.dto';
import { AnswerResponseDto } from './dto/answer-response.dto';
import {
    TestAttempt,
    AttemptStatus,
} from '../test_attempts/entities/test_attempt.entity';
import { Question, QuestionType } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import { QuestionsService } from '../questions/questions.service';
import { RetryService } from '../common/services/retry.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { applyBranchVisibilityToQuery } from '../auth/utils/branch-visibility.util';
import { StandardResponse } from '../common/types';
import { UserRole } from '../user/entities/user.entity';

@Injectable()
export class AnswersService {
    private readonly logger = new Logger(AnswersService.name);

    /**
     * Whether the caller may inspect attempts voided by an admin reset.
     * Learners must receive 404 for voided attempts so the answer key of a
     * soon-to-be-retaken test is never confirmed to exist.
     */
    private isElevatedRole(userRole?: string): boolean {
        return (
            userRole === UserRole.ADMIN ||
            userRole === UserRole.OWNER ||
            userRole === UserRole.MASTER_ADMIN
        );
    }

    /**
     * Reject access to a voided attempt for non-elevated callers.
     * Uses NotFoundException (not Forbidden) to avoid leaking existence.
     */
    private assertAttemptWritableOrVisible(
        attempt: TestAttempt,
        scope: OrgBranchScope,
    ): void {
        if (
            attempt.voidedByResetId != null &&
            !this.isElevatedRole(scope.userRole)
        ) {
            throw new NotFoundException('Test attempt not found');
        }
    }

    // Cache keys with org/branch scoping for multi-tenant isolation
    private readonly CACHE_KEYS = {
        ANSWER_BY_ID: (id: number, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:answer:${id}`,
        ANSWERS_BY_ATTEMPT: (
            attemptId: number,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:answers:attempt:${attemptId}`,
        ANSWERS_BY_QUESTION: (
            questionId: number,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:answers:question:${questionId}`,
        ANSWER_COUNT_BY_QUESTION: (
            questionId: number,
            orgId?: string,
            branchId?: string,
        ) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:answer:count:question:${questionId}`,
        USER_ANSWERS: (userId: string, orgId?: string, branchId?: string) =>
            `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:${userId}:answers`,
    };

    // Cache TTL in seconds
    private readonly CACHE_TTL = {
        ANSWER: 300, // 5 minutes
        ANSWER_LIST: 180, // 3 minutes
        STATS: 600, // 10 minutes
        COUNT: 120, // 2 minutes
    };

    constructor(
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(QuestionOption)
        private readonly questionOptionRepository: Repository<QuestionOption>,
        private readonly dataSource: DataSource,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        private readonly retryService: RetryService,
        @Inject(forwardRef(() => QuestionsService))
        private readonly questionsService: QuestionsService,
    ) {}

    async create(
        createAnswerDto: CreateAnswerDto,
        scope: OrgBranchScope,
    ): Promise<StandardResponse<AnswerResponseDto>> {
        return this.retryService.executeDatabase(async () => {
            // Validate attempt ownership and status - include org/branch relations
            const attempt = await this.testAttemptRepository.findOne({
                where: { attemptId: createAnswerDto.attemptId },
                relations: ['user'],
            });

            if (!attempt) {
                throw new NotFoundException('Test attempt not found');
            }

            this.assertAttemptWritableOrVisible(attempt, scope);

            if (attempt.userId !== scope.userId) {
                throw new ForbiddenException(
                    'You can only create answers for your own attempts',
                );
            }

            if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Cannot create answers for non-active attempts',
                );
            }

            // Validate question exists with proper scoping
            const questionQuery = this.questionRepository
                .createQueryBuilder('question')
                .where('question.questionId = :questionId', {
                    questionId: createAnswerDto.questionId,
                });

            if (scope.orgId) {
                questionQuery.andWhere('question.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            // Method 1: learners may answer org-wide questions (NULL branchId).
            applyBranchVisibilityToQuery(
                questionQuery,
                'question',
                scope.branchId,
                'answerQuestion',
            );

            const question = await questionQuery.getOne();

            if (!question) {
                throw new NotFoundException('Question not found');
            }

            // Check if answer already exists for this question in this attempt
            const existingAnswer = await this.answerRepository.findOne({
                where: {
                    attemptId: createAnswerDto.attemptId,
                    questionId: createAnswerDto.questionId,
                },
            });

            if (existingAnswer) {
                throw new BadRequestException(
                    'Answer already exists for this question in this attempt',
                );
            }

            // Validate selected option if provided and get the option entity
            let selectedOption: QuestionOption | undefined;
            const sanitizedSelectedOptionId = createAnswerDto.selectedOptionId && createAnswerDto.selectedOptionId > 0 
                ? createAnswerDto.selectedOptionId 
                : undefined;

            if (sanitizedSelectedOptionId) {
                const foundOption = await this.questionOptionRepository.findOne(
                    {
                        where: {
                            optionId: sanitizedSelectedOptionId,
                            questionId: createAnswerDto.questionId,
                        },
                    },
                );

                if (!foundOption) {
                    throw new BadRequestException(
                        'Selected option does not belong to this question',
                    );
                }
                selectedOption = foundOption;
            }

            // Create the answer with inherited org/branch from attempt
            const answer = this.answerRepository.create({
                ...createAnswerDto,
                selectedOptionId: sanitizedSelectedOptionId,
                isMarked: false,
                isCorrect: false,
                // Set relationships
                attempt: attempt,
                question: question,
                selectedOption: selectedOption,
                // Set org/branch from scope (UUIDs — do not coerce with Number())
                orgId: scope.orgId ?? undefined,
                branchId: scope.branchId ?? undefined,
                userId: scope.userId,
            });

            const savedAnswer = await this.answerRepository.save(answer);

            // Invalidate related caches
            await this.invalidateAnswerCache(
                savedAnswer.answerId,
                createAnswerDto.attemptId,
                createAnswerDto.questionId,
                scope.userId,
                scope.orgId,
                scope.branchId,
            );

            const responseDto = this.mapToResponseDto(savedAnswer);

            return {
                success: true,
                message: 'Answer created successfully',
                data: responseDto,
            };
        });
    }

    async update(
        id: number,
        updateAnswerDto: UpdateAnswerDto,
        scope: OrgBranchScope,
    ): Promise<StandardResponse<AnswerResponseDto>> {
        return this.retryService.executeDatabase(async () => {
            const answerQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoinAndSelect('answer.attempt', 'attempt')
                .leftJoinAndSelect('answer.organization', 'organization')
                .leftJoinAndSelect('answer.branch', 'branch')
                .where('answer.answerId = :id', { id });

            // Apply org/branch scoping
            if (scope.orgId) {
                answerQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                answerQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const answer = await answerQuery.getOne();

            if (!answer) {
                throw new NotFoundException('Answer not found');
            }

            this.assertAttemptWritableOrVisible(answer.attempt, scope);

            if (answer.attempt.userId !== scope.userId) {
                throw new ForbiddenException(
                    'You can only update your own answers',
                );
            }

            if (answer.attempt.status !== AttemptStatus.IN_PROGRESS) {
                throw new BadRequestException(
                    'Cannot update answers for non-active attempts',
                );
            }

            // Validate selected option if provided and get the option entity
            let selectedOption: QuestionOption | undefined;
            if (updateAnswerDto.selectedOptionId) {
                const foundOption = await this.questionOptionRepository.findOne(
                    {
                        where: {
                            optionId: updateAnswerDto.selectedOptionId,
                            questionId: answer.questionId,
                        },
                    },
                );

                if (!foundOption) {
                    throw new BadRequestException(
                        'Selected option does not belong to this question',
                    );
                }
                selectedOption = foundOption;
            }

            // Update the answer with new data and relationships
            Object.assign(answer, updateAnswerDto);
            if (selectedOption) {
                answer.selectedOption = selectedOption;
            }
            const updatedAnswer = await this.answerRepository.save(answer);

            // Invalidate related caches
            await this.invalidateAnswerCache(
                id,
                answer.attemptId,
                answer.questionId,
                scope.userId,
                scope.orgId,
                scope.branchId,
            );

            const responseDto = this.mapToResponseDto(updatedAnswer);

            return {
                success: true,
                message: 'Answer updated successfully',
                data: responseDto,
            };
        });
    }

    async markAnswer(
        id: number,
        markAnswerDto: MarkAnswerDto,
        scope: OrgBranchScope,
    ): Promise<StandardResponse<AnswerResponseDto>> {
        return this.retryService.executeDatabase(async () => {
            const answerQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoinAndSelect('answer.attempt', 'attempt')
                .leftJoinAndSelect('answer.question', 'question')
                .leftJoinAndSelect('answer.organization', 'organization')
                .leftJoinAndSelect('answer.branch', 'branch')
                .where('answer.answerId = :id', { id });

            // Apply org/branch scoping
            if (scope.orgId) {
                answerQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                answerQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const answer = await answerQuery.getOne();

            if (!answer) {
                throw new NotFoundException('Answer not found');
            }

            // Validate points don't exceed question maximum
            if (markAnswerDto.pointsAwarded > answer.question.points) {
                throw new BadRequestException(
                    `Points awarded cannot exceed question maximum (${answer.question.points})`,
                );
            }

            // Update answer with marking information
            answer.pointsAwarded = markAnswerDto.pointsAwarded;
            answer.feedback = markAnswerDto.feedback;
            answer.isMarked = true;
            answer.markedByUserId = scope.userId;
            answer.markedAt = new Date();
            answer.isCorrect =
                markAnswerDto.pointsAwarded === answer.question.points;

            const markedAnswer = await this.answerRepository.save(answer);

            // Invalidate related caches
            await this.invalidateAnswerCache(
                id,
                answer.attemptId,
                answer.questionId,
                scope.userId,
                scope.orgId,
                scope.branchId,
            );

            const responseDto = this.mapToResponseDto(markedAnswer);

            return {
                success: true,
                message: 'Answer marked successfully',
                data: responseDto,
            };
        });
    }

    async findByAttempt(
        attemptId: number,
        scope: OrgBranchScope,
    ): Promise<AnswerResponseDto[]> {
        return this.retryService.executeDatabase(async () => {
            const cacheKey = this.CACHE_KEYS.ANSWERS_BY_ATTEMPT(
                attemptId,
                scope.orgId,
                scope.branchId,
            );

            // Try to get from cache first
            const cached =
                await this.cacheManager.get<AnswerResponseDto[]>(cacheKey);
            if (cached) {
                this.logger.debug(
                    `Cache hit for answers by attempt ${attemptId}`,
                );
                return cached;
            }

            // Validate attempt access
            const attempt = await this.testAttemptRepository.findOne({
                where: { attemptId },
            });

            if (!attempt) {
                throw new NotFoundException('Test attempt not found');
            }

            // Voided attempts hide their answer key from the learner after a reset.
            this.assertAttemptWritableOrVisible(attempt, scope);

            if (attempt.userId !== scope.userId) {
                throw new ForbiddenException(
                    'You can only access your own attempt answers',
                );
            }

            const answersQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoinAndSelect('answer.question', 'question')
                .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
                .where('answer.attemptId = :attemptId', { attemptId })
                .orderBy('answer.questionId', 'ASC');

            // Apply org/branch scoping
            if (scope.orgId) {
                answersQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                answersQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const answers = await answersQuery.getMany();
            const result = answers.map(answer => this.mapToResponseDto(answer));

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.ANSWER_LIST * 1000,
            );

            return result;
        });
    }

    async findByQuestion(
        questionId: number,
        scope: OrgBranchScope,
    ): Promise<AnswerResponseDto[]> {
        return this.retryService.executeDatabase(async () => {
            const cacheKey = this.CACHE_KEYS.ANSWERS_BY_QUESTION(
                questionId,
                scope.orgId,
                scope.branchId,
            );

            // Try to get from cache first
            const cached =
                await this.cacheManager.get<AnswerResponseDto[]>(cacheKey);
            if (cached) {
                this.logger.debug(
                    `Cache hit for answers by question ${questionId}`,
                );
                return cached;
            }

            const answersQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoinAndSelect('answer.attempt', 'attempt')
                .leftJoinAndSelect('answer.question', 'question')
                .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
                .where('answer.questionId = :questionId', { questionId })
                .orderBy('answer.createdAt', 'DESC');

            // Apply org/branch scoping
            if (scope.orgId) {
                answersQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                answersQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const answers = await answersQuery.getMany();
            const result = answers.map(answer => this.mapToResponseDto(answer));

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                result,
                this.CACHE_TTL.ANSWER_LIST * 1000,
            );

            return result;
        });
    }

    async bulkCreate(
        bulkAnswersDto: BulkAnswersDto,
        scope: OrgBranchScope,
    ): Promise<StandardResponse<AnswerResponseDto[]>> {
        const result = await this.bulkCreateWithEntities(bulkAnswersDto, scope);
        return {
            success: result.success,
            message: result.message,
            data: result.data.dtos,
            ...(result.errors && { errors: result.errors }),
        };
    }

    /**
     * Bulk create answers with transaction safety, comprehensive validation, and enhanced error handling
     * This is used internally to avoid timing issues with auto-marking
     */
    async bulkCreateWithEntities(
        bulkAnswersDto: BulkAnswersDto,
        scope: OrgBranchScope,
        context?: { testId?: number; attemptId?: number; userId?: string },
    ): Promise<{
        success: boolean;
        message: string;
        data: {
            dtos: AnswerResponseDto[];
            entities: Answer[];
        };
        errors?: string[];
        validationResult?: {
            questionsValidated: number;
            validQuestions: number;
            invalidQuestions: number;
            validationTime: number;
        };
    }> {
        const startTime = new Date();
        const logContext = context
            ? `[Test: ${context.testId}, Attempt: ${context.attemptId}, User: ${context.userId}]`
            : '[Bulk Creation]';

        this.logger.log(
            `${logContext} Starting bulk creation of ${bulkAnswersDto.answers.length} answers`,
        );

        return this.retryService.executeDatabase(
            async () => {
                const queryRunner = this.dataSource.createQueryRunner();
                await queryRunner.connect();
                await queryRunner.startTransaction();

                try {
                    // Step 1: Pre-validation - Check all question IDs exist
                    const questionIds = bulkAnswersDto.answers.map(
                        a => a.questionId,
                    );
                    const uniqueQuestionIds = [...new Set(questionIds)];

                    this.logger.log(
                        `${logContext} Validating ${uniqueQuestionIds.length} unique question IDs`,
                    );

                    const validationResult =
                        await this.questionsService.validateQuestionsExist(
                            uniqueQuestionIds,
                            scope,
                            context,
                        );

                    if (!validationResult.valid) {
                        await queryRunner.rollbackTransaction();

                        const errorMessage = `Pre-validation failed: ${validationResult.invalidQuestionIds.length} invalid question IDs detected`;
                        this.logger.error(`${logContext} ${errorMessage}`, {
                            invalidQuestionIds:
                                validationResult.invalidQuestionIds,
                            errors: validationResult.errors,
                        });

                        return {
                            success: false,
                            message: errorMessage,
                            data: { dtos: [], entities: [] },
                            errors: validationResult.errors,
                            validationResult: {
                                questionsValidated: uniqueQuestionIds.length,
                                validQuestions:
                                    validationResult.validQuestionIds.length,
                                invalidQuestions:
                                    validationResult.invalidQuestionIds.length,
                                validationTime:
                                    validationResult.timing.durationMs,
                            },
                        };
                    }

                    this.logger.log(
                        `${logContext} Pre-validation passed in ${validationResult.timing.durationMs}ms`,
                    );

                    // Step 2: Validate test attempt
                    if (context?.attemptId) {
                        const attempt = await queryRunner.manager.findOne(
                            TestAttempt,
                            {
                                where: { attemptId: context.attemptId },
                                relations: ['test'],
                            },
                        );

                        if (!attempt) {
                            await queryRunner.rollbackTransaction();
                            throw new NotFoundException(
                                `Test attempt ${context.attemptId} not found`,
                            );
                        }

                        // Bulk submit must not write into an attempt voided by a reset.
                        if (attempt.voidedByResetId != null) {
                            await queryRunner.rollbackTransaction();
                            throw new NotFoundException(
                                `Test attempt ${context.attemptId} not found`,
                            );
                        }

                        if (attempt.status !== AttemptStatus.IN_PROGRESS) {
                            await queryRunner.rollbackTransaction();
                            throw new BadRequestException(
                                `Cannot create answers for attempt with status: ${attempt.status}`,
                            );
                        }

                        if (attempt.userId !== context.userId) {
                            await queryRunner.rollbackTransaction();
                            throw new ForbiddenException(
                                "Cannot create answers for another user's attempt",
                            );
                        }
                    }

                // Step 3: Process answers in transaction
                const resultDtos: AnswerResponseDto[] = [];
                const resultEntities: Answer[] = [];
                const errors: string[] = [];
                const createdAnswerIds: number[] = [];

                for (const answerDto of bulkAnswersDto.answers) {
                    try {
                        // Check for existing answer
                        const existingAnswer = await queryRunner.manager.findOne(Answer, {
                            where: {
                                attemptId: answerDto.attemptId,
                                questionId: answerDto.questionId,
                            }
                        });

                        if (existingAnswer) {
                                // Update existing answer instead of creating new one
                                Object.assign(existingAnswer, {
                                    selectedOptionId: answerDto.selectedOptionId && answerDto.selectedOptionId > 0 
                                        ? answerDto.selectedOptionId 
                                        : undefined,
                                    textAnswer: answerDto.textAnswer,
                                    timeSpent: answerDto.timeSpent,
                                    updatedAt: new Date(),
                                });

                                await queryRunner.manager.save(
                                    Answer,
                                    existingAnswer,
                                );
                                createdAnswerIds.push(existingAnswer.answerId);
                            } else {
                                // Create new answer - ensure selectedOptionId is undefined if 0 or falsy
                                const sanitizedAnswerDto = {
                                    ...answerDto,
                                    selectedOptionId: answerDto.selectedOptionId && answerDto.selectedOptionId > 0 
                                        ? answerDto.selectedOptionId 
                                        : undefined,
                                };

                                const newAnswer = queryRunner.manager.create(
                                    Answer,
                                    {
                                        ...sanitizedAnswerDto,
                                        // UUIDs — do not coerce with Number()
                                        orgId: scope.orgId ?? undefined,
                                        branchId: scope.branchId ?? undefined,
                                        userId: scope.userId || context?.userId,
                                    },
                                );

                                const savedAnswer =
                                    await queryRunner.manager.save(
                                        Answer,
                                        newAnswer,
                                    );
                                createdAnswerIds.push(savedAnswer.answerId);
                    }
                } catch (error) {
                            const errorMessage = `Failed to process answer for question ${answerDto.questionId}: ${
                                error instanceof Error
                                    ? error.message
                                    : 'Unknown error'
                    }`;
                    errors.push(errorMessage);
                            this.logger.error(
                                `${logContext} ${errorMessage}`,
                                error,
                            );

                            // For critical errors, rollback the entire transaction
                            if (
                                error instanceof NotFoundException ||
                                error instanceof ForbiddenException ||
                                (error instanceof Error &&
                                    error.message.includes('constraint'))
                            ) {
                                await queryRunner.rollbackTransaction();
                                throw error;
                            }
                        }
                    }

                    // Step 4: If we have errors but some successes, decide whether to commit or rollback
                    if (
                        errors.length > 0 &&
                        errors.length === bulkAnswersDto.answers.length
                    ) {
                        // All failed - rollback
                        await queryRunner.rollbackTransaction();
                        this.logger.error(
                            `${logContext} All answer creations failed, transaction rolled back`,
                        );

                        return {
                            success: false,
                            message: 'All answer creations failed',
                            data: { dtos: [], entities: [] },
                            errors,
                            validationResult: {
                                questionsValidated: uniqueQuestionIds.length,
                                validQuestions:
                                    validationResult.validQuestionIds.length,
                                invalidQuestions:
                                    validationResult.invalidQuestionIds.length,
                                validationTime:
                                    validationResult.timing.durationMs,
                            },
                        };
                    } else if (errors.length > 0) {
                        // Partial success - log warning but continue
                        this.logger.warn(
                            `${logContext} Partial success: ${createdAnswerIds.length} answers created, ${errors.length} failed`,
                        );
                    }

                    // Step 5: Fetch created entities with relations for response
                    if (createdAnswerIds.length > 0) {
                        const fetchedEntities = await queryRunner.manager
                            .createQueryBuilder(Answer, 'answer')
                            .leftJoinAndSelect('answer.question', 'question')
                            .leftJoinAndSelect(
                                'answer.selectedOption',
                                'selectedOption',
                            )
                            .leftJoinAndSelect(
                                'answer.organization',
                                'organization',
                            )
                            .leftJoinAndSelect('answer.branch', 'branch')
                            .where('answer.answerId IN (:...answerIds)', {
                                answerIds: createdAnswerIds,
                            })
                            .getMany();

                        resultEntities.push(...fetchedEntities);

                        // Convert to DTOs
                        for (const entity of fetchedEntities) {
                            resultDtos.push(this.mapToResponseDto(entity));
                        }
                    }

                    // Step 6: Commit transaction
                    await queryRunner.commitTransaction();

                    const endTime = new Date();
                    const totalDuration =
                        endTime.getTime() - startTime.getTime();

                    this.logger.log(
                        `${logContext} Bulk creation completed in ${totalDuration}ms: ` +
                            `${resultDtos.length} answers created successfully` +
                            (errors.length > 0
                                ? `, ${errors.length} errors`
                                : ''),
                    );

            return {
                success: errors.length === 0,
                message:
                    errors.length === 0
                                ? `All ${resultDtos.length} answers created successfully`
                        : `Created ${resultDtos.length} answers with ${errors.length} errors`,
                data: {
                    dtos: resultDtos,
                    entities: resultEntities,
                },
                ...(errors.length > 0 && { errors }),
                        validationResult: {
                            questionsValidated: uniqueQuestionIds.length,
                            validQuestions:
                                validationResult.validQuestionIds.length,
                            invalidQuestions:
                                validationResult.invalidQuestionIds.length,
                            validationTime: validationResult.timing.durationMs,
                        },
                    };
                } catch (error) {
                    // Rollback on any unhandled error
                    if (queryRunner.isTransactionActive) {
                        await queryRunner.rollbackTransaction();
                    }

                    const endTime = new Date();
                    const totalDuration =
                        endTime.getTime() - startTime.getTime();

                    this.logger.error(
                        `${logContext} Bulk creation failed after ${totalDuration}ms:`,
                        error,
                    );

                    throw error;
                } finally {
                    await queryRunner.release();
                }
            },
            {
                testId: context?.testId,
                attemptId: context?.attemptId,
                userId: context?.userId,
                operation: 'bulk_create_answers',
            },
        );
    }

    async autoMark(attemptId: number, scope: OrgBranchScope): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const answersQuery = this.answerRepository
                .createQueryBuilder('answer')
                .leftJoinAndSelect('answer.question', 'question')
                .leftJoinAndSelect('answer.selectedOption', 'selectedOption')
                .where('answer.attemptId = :attemptId', { attemptId });

            // Apply org/branch scoping
            if (scope.orgId) {
                answersQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                answersQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const answersWithQuestions = await answersQuery.getMany();

            this.logger.log(
                `Found ${answersWithQuestions.length} scoped answers for attempt ${attemptId}`,
            );

            // Step 2: Filter to only unmarked answers
            const unmarkedAnswers = answersWithQuestions.filter(
                answer => !answer.isMarked,
            );

            this.logger.log(
                `�� Step 3: Found ${unmarkedAnswers.length} unmarked answers to process`,
            );

            if (unmarkedAnswers.length === 0) {
                this.logger.log(
                    `✅ All answers already marked for attempt ${attemptId}`,
                );
                return 0;
            }

            // Step 4: Process each unmarked answer
            let markedCount = 0;
            let correctCount = 0;
            let incorrectCount = 0;
            let skippedCount = 0;

            // Load every option for unmarked questions in one query. Per-answer
            // option fetches were taking 3–5s each on Render and exhausted the
            // MySQL pool before result creation (read ETIMEDOUT on attempt 668).
            const questionIds = [
                ...new Set(unmarkedAnswers.map(answer => answer.questionId)),
            ];
            const allOptions =
                questionIds.length > 0
                    ? await this.questionOptionRepository.find({
                          where: { questionId: In(questionIds) },
                          order: { orderIndex: 'ASC' },
                      })
                    : [];
            const optionsByQuestionId = new Map<number, QuestionOption[]>();
            for (const option of allOptions) {
                const existing = optionsByQuestionId.get(option.questionId) ?? [];
                existing.push(option);
                optionsByQuestionId.set(option.questionId, existing);
            }

            const answersToSave: Answer[] = [];

            for (const answer of unmarkedAnswers) {
                const questionId = answer.questionId;
                const questionType = answer.question?.questionType;
                const maxPoints = answer.question?.points || 0;

                if (!this.isAutoMarkableQuestionType(questionType)) {
                    skippedCount++;
                    continue;
                }

                try {
                    const questionOptions =
                        optionsByQuestionId.get(questionId) ?? [];

                    if (questionOptions.length === 0) {
                        this.logger.warn(
                            `No options found for question ${questionId} — skipping auto-mark`,
                        );
                        skippedCount++;
                        continue;
                    }

                    const selectedOptionIds =
                        this.resolveSelectedOptionIdsForMarking(
                            answer,
                            questionOptions,
                        );

                    if (selectedOptionIds.length === 0) {
                        skippedCount++;
                        continue;
                    }

                    if (
                        !answer.selectedOptionId &&
                        questionType === QuestionType.TRUE_FALSE
                    ) {
                        answer.selectedOptionId = selectedOptionIds[0];
                    }

                    const correctOptionIds = questionOptions
                        .filter(opt => opt.isCorrect)
                        .map(opt => opt.optionId);

                    const isCorrect = this.areOptionIdSetsEqual(
                        selectedOptionIds,
                        correctOptionIds,
                    );

                    answer.isCorrect = isCorrect;
                    answer.pointsAwarded = isCorrect ? maxPoints : 0;
                    answer.isMarked = true;
                    answer.markedAt = new Date();
                    answersToSave.push(answer);

                    markedCount++;
                    if (isCorrect) {
                        correctCount++;
                    } else {
                        incorrectCount++;
                    }
                } catch (error) {
                    this.logger.error(
                        `Error marking answer ${answer.answerId}:`,
                        error,
                    );
                    skippedCount++;
                }
            }

            if (answersToSave.length > 0) {
                await this.answerRepository.save(answersToSave);
            }

            // Step 7: Final summary
            this.logger.log(
                `\n🏁 AUTO-MARKING COMPLETED FOR ATTEMPT ${attemptId}`,
            );
            this.logger.log(`📊 SUMMARY:`);
            this.logger.log(
                `   📝 Scoped Answers Found: ${answersWithQuestions.length}`,
            );
            this.logger.log(
                `   🎯 Unmarked Answers: ${unmarkedAnswers.length}`,
            );
            this.logger.log(`   ✅ Successfully Marked: ${markedCount}`);
            this.logger.log(`   🎉 Correct Answers: ${correctCount}`);
            this.logger.log(`   ❌ Incorrect Answers: ${incorrectCount}`);
            this.logger.log(
                `   ⏭️  Skipped (Manual Required): ${skippedCount}`,
            );
            this.logger.log(
                `   📈 Success Rate: ${markedCount > 0 ? Math.round((correctCount / markedCount) * 100) : 0}%`,
            );

            return markedCount;
        });
    }

    /**
     * Resolve selected option ids for auto-marking.
     * Multi-select multiple_choice answers store a JSON number array in textAnswer;
     * legacy single-select uses selectedOptionId; true_false may use textAnswer labels.
     */
    private resolveSelectedOptionIdsForMarking(
        answer: Answer,
        questionOptions: QuestionOption[],
    ): number[] {
        if (answer.textAnswer) {
            try {
                const parsed: unknown = JSON.parse(answer.textAnswer);
                if (
                    Array.isArray(parsed) &&
                    parsed.every(
                        (value): value is number =>
                            typeof value === 'number' && Number.isFinite(value),
                    )
                ) {
                    return [...new Set(parsed)].filter(optionId =>
                        questionOptions.some(
                            option => option.optionId === optionId,
                        ),
                    );
                }
            } catch {
                // Not JSON — fall through to single-select / true_false text handling.
            }
        }

        if (answer.selectedOptionId) {
            const exists = questionOptions.some(
                option => option.optionId === answer.selectedOptionId,
            );
            return exists ? [answer.selectedOptionId] : [];
        }

        if (
            answer.question?.questionType === QuestionType.TRUE_FALSE &&
            answer.textAnswer
        ) {
            const normalizedAnswer = answer.textAnswer.trim().toLowerCase();
            const matched = questionOptions.find(
                option =>
                    option.optionText.trim().toLowerCase() === normalizedAnswer,
            );
            return matched ? [matched.optionId] : [];
        }

        return [];
    }

    /** True when both option-id lists contain the same unique values. */
    private areOptionIdSetsEqual(
        selectedOptionIds: number[],
        correctOptionIds: number[],
    ): boolean {
        if (selectedOptionIds.length !== correctOptionIds.length) {
            return false;
        }

        const selectedSet = new Set(selectedOptionIds);
        return correctOptionIds.every(optionId => selectedSet.has(optionId));
    }

    /**
     * Check if a question type can be auto-marked
     */
    private isAutoMarkableQuestionType(questionType: string): boolean {
        const autoMarkableTypes = [
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.TRUE_FALSE,
        ];
        return autoMarkableTypes.includes(questionType as QuestionType);
    }

    async countByQuestion(
        questionId: number,
        scope: OrgBranchScope,
    ): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const cacheKey = this.CACHE_KEYS.ANSWER_COUNT_BY_QUESTION(
                questionId,
                scope.orgId,
                scope.branchId,
            );

            // Try to get from cache first
            const cached = await this.cacheManager.get<number>(cacheKey);
            if (cached !== undefined && cached !== null) {
                this.logger.debug(
                    `Cache hit for answer count by question ${questionId}`,
                );
                return cached;
            }

            const countQuery = this.answerRepository
                .createQueryBuilder('answer')
                .where('answer.questionId = :questionId', { questionId });

            // Apply org/branch scoping
            if (scope.orgId) {
                countQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                countQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const count = await countQuery.getCount();

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                count,
                this.CACHE_TTL.COUNT * 1000,
            );

            return count || 0;
        });
    }

    /**
     * Count answers by attempt ID
     */
    async countByAttempt(
        attemptId: number,
        scope: OrgBranchScope,
    ): Promise<number> {
        return this.retryService.executeDatabase(async () => {
            const cacheKey =
                this.CACHE_KEYS.ANSWERS_BY_ATTEMPT(
                    attemptId,
                    scope.orgId,
                    scope.branchId,
                ) + ':count';

            // Try to get from cache first
            const cached = await this.cacheManager.get<number>(cacheKey);
            if (cached !== undefined && cached !== null) {
                this.logger.debug(
                    `Cache hit for answer count by attempt ${attemptId}`,
                );
                return cached;
            }

            const countQuery = this.answerRepository
                .createQueryBuilder('answer')
                .where('answer.attemptId = :attemptId', { attemptId });

            // Apply org/branch scoping
            if (scope.orgId) {
                countQuery.andWhere('answer.orgId = :orgId', {
                    orgId: scope.orgId,
                });
            }
            if (scope.branchId) {
                countQuery.andWhere('answer.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

            const count = await countQuery.getCount();

            // Cache the result
            await this.cacheManager.set(
                cacheKey,
                count,
                this.CACHE_TTL.COUNT * 1000,
            );

            return count || 0;
        });
    }

    /**
     * Cache invalidation helper
     */
    private async invalidateAnswerCache(
        answerId: number,
        attemptId?: number,
        questionId?: number,
        userId?: string,
        orgId?: string,
        branchId?: string,
    ): Promise<void> {
        const keysToDelete = [
            this.CACHE_KEYS.ANSWER_BY_ID(answerId, orgId, branchId),
        ];

        if (attemptId) {
            keysToDelete.push(
                this.CACHE_KEYS.ANSWERS_BY_ATTEMPT(attemptId, orgId, branchId),
            );
        }

        if (questionId) {
            keysToDelete.push(
                this.CACHE_KEYS.ANSWERS_BY_QUESTION(
                    questionId,
                    orgId,
                    branchId,
                ),
                this.CACHE_KEYS.ANSWER_COUNT_BY_QUESTION(
                    questionId,
                    orgId,
                    branchId,
                ),
            );
        }

        if (userId) {
            keysToDelete.push(
                this.CACHE_KEYS.USER_ANSWERS(userId, orgId, branchId),
            );
        }

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

    private mapToResponseDto(answer: Answer): AnswerResponseDto {
        return {
            answerId: answer.answerId,
            attemptId: answer.attemptId,
            questionId: answer.questionId,
            selectedOptionId: answer.selectedOptionId,
            textAnswer: answer.textAnswer,
            pointsAwarded: answer.pointsAwarded,
            isMarked: answer.isMarked,
            isCorrect: answer.isCorrect,
            markedByUserId: answer.markedByUserId,
            markedAt: answer.markedAt,
            feedback: answer.feedback,
            createdAt: answer.createdAt,
            updatedAt: answer.updatedAt,
            question: answer.question
                ? {
                      questionId: answer.question.questionId,
                      questionText: answer.question.questionText,
                      questionType: answer.question.questionType,
                      points: answer.question.points,
                  }
                : undefined,
            selectedOption: answer.selectedOption
                ? {
                      optionId: answer.selectedOption.optionId,
                      optionText: answer.selectedOption.optionText,
                      isCorrect: answer.selectedOption.isCorrect,
                  }
                : undefined,
        };
    }
}
