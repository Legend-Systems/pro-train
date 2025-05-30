import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateQuestionOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionOptionDto } from './dto/update-questions_option.dto';
import { QuestionOptionResponseDto } from './dto/question-option-response.dto';
import { QuestionOptionListResponseDto } from './dto/question-option-list-response.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';
import { QuestionOption } from './entities/questions_option.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionsService } from '../questions/questions.service';

@Injectable()
export class QuestionsOptionsService {
    private readonly logger = new Logger(QuestionsOptionsService.name);

    constructor(
        @InjectRepository(QuestionOption)
        private readonly questionOptionRepository: Repository<QuestionOption>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        private readonly questionsService: QuestionsService,
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
        userId: string,
    ): Promise<QuestionOptionResponseDto> {
        return this.retryOperation(async () => {
            // Validate question access
            await this.validateQuestionAccess(
                createQuestionOptionDto.questionId,
                userId,
            );

            const option = this.questionOptionRepository.create(
                createQuestionOptionDto,
            );
            const savedOption =
                await this.questionOptionRepository.save(option);

            return this.mapToResponseDto(savedOption);
        });
    }

    /**
     * Create multiple options in bulk
     */
    async createBulk(
        bulkCreateDto: BulkCreateOptionsDto,
        userId: string,
    ): Promise<QuestionOptionResponseDto[]> {
        return this.retryOperation(async () => {
            // Validate question access
            await this.validateQuestionAccess(bulkCreateDto.questionId, userId);

            const queryRunner = this.dataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();

            try {
                const options: QuestionOptionResponseDto[] = [];

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
                    const savedOption = await queryRunner.manager.save(option);
                    options.push(this.mapToResponseDto(savedOption));
                }

                await queryRunner.commitTransaction();
                return options;
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
        userId?: string,
    ): Promise<QuestionOptionListResponseDto> {
        return this.retryOperation(async () => {
            // Validate question access if userId provided
            if (userId) {
                await this.validateQuestionAccess(questionId, userId);
            }

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

            return {
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
        });
    }

    /**
     * Find a single option by ID
     */
    async findOne(
        id: number,
        userId?: string,
    ): Promise<QuestionOptionResponseDto> {
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

            // Validate question access if userId provided
            if (userId) {
                await this.validateQuestionAccess(option.questionId, userId);
            }

            return this.mapToResponseDto(option);
        });
    }

    /**
     * Update a question option
     */
    async update(
        id: number,
        updateQuestionOptionDto: UpdateQuestionOptionDto,
        userId: string,
    ): Promise<QuestionOptionResponseDto> {
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

            // Validate question access
            await this.validateQuestionAccess(option.questionId, userId);

            Object.assign(option, updateQuestionOptionDto);
            const updatedOption =
                await this.questionOptionRepository.save(option);

            return this.mapToResponseDto(updatedOption);
        });
    }

    /**
     * Delete a question option
     */
    async remove(id: number, userId: string): Promise<void> {
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

            // Validate question access
            await this.validateQuestionAccess(option.questionId, userId);

            // TODO: Check if option has answers (will be implemented in Answers module)
            // const answersCount = await this.answersService.countByOption(id);
            // if (answersCount > 0) {
            //     throw new BadRequestException('Cannot delete option that has answers');
            // }

            await this.questionOptionRepository.remove(option);
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
