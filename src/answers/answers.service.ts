import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
    Inject,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
import { RetryService } from '../common/services/retry.service';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { StandardResponse } from '../common/types';

@Injectable()
export class AnswersService {
    private readonly logger = new Logger(AnswersService.name);

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
    ) {}

    async create(
        createAnswerDto: CreateAnswerDto,
        scope: OrgBranchScope,
    ): Promise<StandardResponse<AnswerResponseDto>> {
        return this.retryService.executeDatabase(async () => {
            // Validate attempt ownership and status - include org/branch relations
            const attempt = await this.testAttemptRepository.findOne({
                where: { attemptId: createAnswerDto.attemptId },
                relations: ['user', 'orgId', 'branchId'],
            });

            if (!attempt) {
                throw new NotFoundException('Test attempt not found');
            }

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
            if (scope.branchId) {
                questionQuery.andWhere('question.branchId = :branchId', {
                    branchId: scope.branchId,
                });
            }

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
            if (createAnswerDto.selectedOptionId) {
                const foundOption = await this.questionOptionRepository.findOne(
                    {
                        where: {
                            optionId: createAnswerDto.selectedOptionId,
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
                isMarked: false,
                isCorrect: false,
                // Set relationships
                attempt: attempt,
                question: question,
                selectedOption: selectedOption,
                // Inherit org/branch from the test attempt
                orgId: attempt.orgId,
                branchId: attempt.branchId,
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
                .leftJoinAndSelect('answer.orgId', 'orgId')
                .leftJoinAndSelect('answer.branchId', 'branchId')
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
                .leftJoinAndSelect('answer.orgId', 'orgId')
                .leftJoinAndSelect('answer.branchId', 'branchId')
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
     * Bulk create answers and return both DTOs and entities
     * This is used internally to avoid timing issues with auto-marking
     */
    async bulkCreateWithEntities(
        bulkAnswersDto: BulkAnswersDto,
        scope: OrgBranchScope,
    ): Promise<{
        success: boolean;
        message: string;
        data: {
            dtos: AnswerResponseDto[];
            entities: Answer[];
        };
        errors?: string[];
    }> {
        return this.retryService.executeDatabase(async () => {
            const resultDtos: AnswerResponseDto[] = [];
            const resultEntities: Answer[] = [];
            const errors: string[] = [];

            for (const answerDto of bulkAnswersDto.answers) {
                try {
                    const result = await this.create(answerDto, scope);
                    if (result.success && result.data) {
                        resultDtos.push(result.data);

                        // Fetch the actual entity with question loaded for auto-marking
                        const answerEntity = await this.answerRepository
                            .createQueryBuilder('answer')
                            .innerJoinAndSelect('answer.question', 'question')
                            .leftJoinAndSelect('answer.orgId', 'orgId')
                            .leftJoinAndSelect('answer.branchId', 'branchId')
                            .where('answer.answerId = :answerId', {
                                answerId: result.data.answerId,
                            })
                            .getOne();

                        if (answerEntity) {
                            resultEntities.push(answerEntity);
                        }
                    }
                } catch (error) {
                    // Continue with other answers even if one fails
                    const errorMessage = `Failed to create answer for question ${answerDto.questionId}: ${
                        error instanceof Error ? error.message : 'Unknown error'
                    }`;
                    errors.push(errorMessage);
                    this.logger.error(errorMessage, error);
                }
            }

            return {
                success: errors.length === 0,
                message:
                    errors.length === 0
                        ? 'All answers created successfully'
                        : `Created ${resultDtos.length} answers with ${errors.length} errors`,
                data: {
                    dtos: resultDtos,
                    entities: resultEntities,
                },
                ...(errors.length > 0 && { errors }),
            };
        });
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

            console.log(
                'answersWithQuestions',
                answersWithQuestions,
                'attemptId',
                attemptId,
                'last time this shit did not work',
            );

            this.logger.log(
                `📊 Found ${answersWithQuestions.length} scoped answers for attempt ${attemptId}`,
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

            this.logger.log(
                `🎯 Step 4: Starting individual answer processing...`,
            );

            for (const answer of unmarkedAnswers) {
                const questionId = answer.questionId;
                const questionType = answer.question?.questionType;
                const questionText =
                    answer.question?.questionText || 'Unknown Question';
                const maxPoints = answer.question?.points || 0;

                this.logger.log(
                    `\n🔍 PROCESSING ANSWER ${answer.answerId} for Question ${questionId}`,
                );
                this.logger.log(`   📋 Question: "${questionText}"`);
                this.logger.log(`   🏷️  Type: ${questionType}`);
                this.logger.log(`   💯 Max Points: ${maxPoints}`);
                this.logger.log(
                    `   👤 User Selection: ${answer.selectedOptionId || 'None'}`,
                );
                this.logger.log(
                    `   📝 Text Answer: ${answer.textAnswer || 'None'}`,
                );

                // Check if this is an auto-markable question type
                if (!this.isAutoMarkableQuestionType(questionType)) {
                    this.logger.log(
                        `   ⏭️  SKIPPED: Question type '${questionType}' requires manual marking`,
                    );
                    skippedCount++;
                    continue;
                }

                // Check if user provided a selection for objective questions
                if (!answer.selectedOptionId) {
                    this.logger.log(
                        `   ⏭️  SKIPPED: No option selected for objective question`,
                    );
                    skippedCount++;
                    continue;
                }

                try {
                    // Step 5: Get all options for this question
                    this.logger.log(
                        `   🔍 Fetching options for question ${questionId}...`,
                    );

                    const questionOptions =
                        await this.questionOptionRepository.find({
                            where: { questionId: questionId },
                            order: { orderIndex: 'ASC' },
                        });

                    this.logger.log(
                        `   📊 Found ${questionOptions.length} options for question ${questionId}`,
                    );

                    if (questionOptions.length === 0) {
                        this.logger.warn(
                            `   ❌ SKIPPED: No options found for question ${questionId}`,
                        );
                        skippedCount++;
                        continue;
                    }

                    // Log all available options
                    this.logger.log(`   📋 Available Options:`);
                    questionOptions.forEach(option => {
                        this.logger.log(
                            `      ${option.isCorrect ? '✅' : '❌'} Option ${option.optionId}: "${option.optionText}" (Correct: ${option.isCorrect})`,
                        );
                    });

                    // Find the user's selected option
                    const selectedOption = questionOptions.find(
                        opt => opt.optionId === answer.selectedOptionId,
                    );

                    if (!selectedOption) {
                        this.logger.warn(
                            `   ❌ SKIPPED: Selected option ${answer.selectedOptionId} not found among available options`,
                        );
                        this.logger.warn(
                            `   Available option IDs: [${questionOptions.map(opt => opt.optionId).join(', ')}]`,
                        );
                        skippedCount++;
                        continue;
                    }

                    // Find all correct options
                    const correctOptions = questionOptions.filter(
                        opt => opt.isCorrect,
                    );

                    this.logger.log(
                        `   ✅ Correct Answer(s): ${correctOptions.map(opt => `"${opt.optionText}" (ID: ${opt.optionId})`).join(', ')}`,
                    );

                    // Determine if the user's answer is correct
                    const isCorrect = selectedOption.isCorrect;
                    const pointsAwarded = isCorrect ? maxPoints : 0;

                    // Log the marking decision
                    this.logger.log(
                        `   👤 User Selected: "${selectedOption.optionText}" (ID: ${selectedOption.optionId})`,
                    );
                    this.logger.log(
                        `   🎯 MARKING RESULT: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`,
                    );
                    this.logger.log(
                        `   💯 Points Awarded: ${pointsAwarded}/${maxPoints}`,
                    );

                    // Step 6: Update the answer with marking results
                    answer.isCorrect = isCorrect;
                    answer.pointsAwarded = pointsAwarded;
                    answer.isMarked = true;
                    answer.markedAt = new Date();

                    // Save the marked answer
                    await this.answerRepository.save(answer);

                    // Update counters
                    markedCount++;
                    if (isCorrect) {
                        correctCount++;
                    } else {
                        incorrectCount++;
                    }

                    this.logger.log(
                        `   ✅ Answer ${answer.answerId} successfully marked and saved`,
                    );

                    // Invalidate cache for this answer
                    await this.invalidateAnswerCache(
                        answer.answerId,
                        attemptId,
                        questionId,
                        scope.userId,
                        scope.orgId,
                        scope.branchId,
                    );
                } catch (error) {
                    this.logger.error(
                        `   ❌ ERROR marking answer ${answer.answerId}:`,
                        error,
                    );
                    skippedCount++;
                }
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
