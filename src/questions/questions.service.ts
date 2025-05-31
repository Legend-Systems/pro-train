import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner, DataSource } from 'typeorm';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionFilterDto } from './dto/question-filter.dto';
import { QuestionResponseDto } from './dto/question-response.dto';
import { QuestionListResponseDto } from './dto/question-list-response.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { Question } from './entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { TestService } from '../test/test.service';

@Injectable()
export class QuestionsService {
    private readonly logger = new Logger(QuestionsService.name);

    constructor(
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        private readonly testService: TestService,
        private readonly dataSource: DataSource,
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
                        error.stack,
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
     * Create a new question
     */
    async create(
        createQuestionDto: CreateQuestionDto,
        scope: OrgBranchScope,
    ): Promise<QuestionResponseDto> {
        return this.retryOperation(async () => {
            // Validate test access
            await this.validateTestAccess(
                createQuestionDto.testId,
                scope.userId,
            );

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
                    .getRawOne();

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
                orgId: test.orgId,
                branchId: test.branchId,
            });
            const savedQuestion = await this.questionRepository.save(question);

            return this.mapToResponseDto(savedQuestion);
        });
    }

    /**
     * Create multiple questions in bulk
     */
    async createBulk(
        bulkCreateDto: BulkCreateQuestionsDto,
        scope: OrgBranchScope,
    ): Promise<QuestionResponseDto[]> {
        return this.retryOperation(async () => {
            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const questions: QuestionResponseDto[] = [];

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
                    questions.push(this.mapToResponseDto(question));
                }

                await queryRunner.commitTransaction();
                return questions;
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        });
    }

    /**
     * Find questions by test with optional filters
     */
    async findByTest(
        testId: number,
        userId?: string,
        filters?: QuestionFilterDto,
    ): Promise<QuestionListResponseDto> {
        return this.retryOperation(async () => {
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

            const totalPoints = await this.questionRepository
                .createQueryBuilder('question')
                .select('SUM(question.points)', 'total')
                .where('question.testId = :testId', { testId })
                .getRawOne();

            return {
                questions: questions.map(q => this.mapToResponseDto(q)),
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                totalPoints: parseInt(totalPoints?.total || '0'),
            };
        });
    }

    /**
     * Find a single question by ID
     */
    async findOne(id: number, userId?: string): Promise<QuestionResponseDto> {
        return this.retryOperation(async () => {
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

            return this.mapToResponseDto(question);
        });
    }

    /**
     * Update a question
     */
    async update(
        id: number,
        updateQuestionDto: UpdateQuestionDto,
        userId: string,
    ): Promise<QuestionResponseDto> {
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
            const updatedQuestion =
                await this.questionRepository.save(question);

            return this.mapToResponseDto(updatedQuestion);
        });
    }

    /**
     * Reorder questions in a test
     */
    async reorder(
        testId: number,
        reorderData: { questionId: number; newOrderIndex: number }[],
        userId: string,
    ): Promise<void> {
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
            } catch (error) {
                await queryRunner.rollbackTransaction();
                throw error;
            } finally {
                await queryRunner.release();
            }
        });
    }

    /**
     * Delete a question
     */
    async remove(id: number, userId: string): Promise<void> {
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

            // TODO: Check if question has answers (will be implemented in Answers module)
            // const answersCount = await this.answersService.countByQuestion(id);
            // if (answersCount > 0) {
            //     throw new BadRequestException('Cannot delete question that has answers');
            // }

            await this.questionRepository.remove(question);
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
                .getRawOne();

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
    private mapToResponseDto(question: Question): QuestionResponseDto {
        return {
            questionId: question.questionId,
            testId: question.testId,
            questionText: question.questionText,
            questionType: question.questionType,
            points: question.points,
            orderIndex: question.orderIndex,
            createdAt: question.createdAt,
            updatedAt: question.updatedAt,
            test: question.test
                ? {
                      testId: question.test.testId,
                      title: question.test.title,
                      testType: question.test.testType,
                  }
                : undefined,
            // TODO: Add counts when implementing related modules
            optionsCount: 0, // Will be calculated when QuestionOptions module is implemented
            answersCount: 0, // Will be calculated when Answers module is implemented
        };
    }
}
