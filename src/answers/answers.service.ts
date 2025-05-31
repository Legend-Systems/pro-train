import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class AnswersService {
    constructor(
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(TestAttempt)
        private readonly testAttemptRepository: Repository<TestAttempt>,
        @InjectRepository(Question)
        private readonly questionRepository: Repository<Question>,
        @InjectRepository(QuestionOption)
        private readonly questionOptionRepository: Repository<QuestionOption>,
    ) {}

    async create(
        createAnswerDto: CreateAnswerDto,
        userId: string,
    ): Promise<AnswerResponseDto> {
        // Validate attempt ownership and status
        const attempt = await this.testAttemptRepository.findOne({
            where: { attemptId: createAnswerDto.attemptId },
            relations: ['user'],
        });

        if (!attempt) {
            throw new NotFoundException('Test attempt not found');
        }

        if (attempt.userId !== userId) {
            throw new ForbiddenException(
                'You can only create answers for your own attempts',
            );
        }

        if (attempt.status !== AttemptStatus.IN_PROGRESS) {
            throw new BadRequestException(
                'Cannot create answers for non-active attempts',
            );
        }

        // Validate question exists
        const question = await this.questionRepository.findOne({
            where: { questionId: createAnswerDto.questionId },
        });

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

        // Validate selected option if provided
        if (createAnswerDto.selectedOptionId) {
            const option = await this.questionOptionRepository.findOne({
                where: {
                    optionId: createAnswerDto.selectedOptionId,
                    questionId: createAnswerDto.questionId,
                },
            });

            if (!option) {
                throw new BadRequestException(
                    'Selected option does not belong to this question',
                );
            }
        }

        // Create the answer
        const answer = this.answerRepository.create({
            ...createAnswerDto,
            isMarked: false,
            isCorrect: false,
        });

        const savedAnswer = await this.answerRepository.save(answer);

        return this.mapToResponseDto(savedAnswer);
    }

    async update(
        id: number,
        updateAnswerDto: UpdateAnswerDto,
        userId: string,
    ): Promise<AnswerResponseDto> {
        const answer = await this.answerRepository.findOne({
            where: { answerId: id },
            relations: ['attempt'],
        });

        if (!answer) {
            throw new NotFoundException('Answer not found');
        }

        if (answer.attempt.userId !== userId) {
            throw new ForbiddenException(
                'You can only update your own answers',
            );
        }

        if (answer.attempt.status !== AttemptStatus.IN_PROGRESS) {
            throw new BadRequestException(
                'Cannot update answers for non-active attempts',
            );
        }

        // Validate selected option if provided
        if (updateAnswerDto.selectedOptionId) {
            const option = await this.questionOptionRepository.findOne({
                where: {
                    optionId: updateAnswerDto.selectedOptionId,
                    questionId: answer.questionId,
                },
            });

            if (!option) {
                throw new BadRequestException(
                    'Selected option does not belong to this question',
                );
            }
        }

        Object.assign(answer, updateAnswerDto);
        const updatedAnswer = await this.answerRepository.save(answer);

        return this.mapToResponseDto(updatedAnswer);
    }

    async markAnswer(
        id: number,
        markAnswerDto: MarkAnswerDto,
        userId: string,
    ): Promise<AnswerResponseDto> {
        const answer = await this.answerRepository.findOne({
            where: { answerId: id },
            relations: ['attempt', 'question'],
        });

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
        answer.markedByUserId = userId;
        answer.markedAt = new Date();
        answer.isCorrect =
            markAnswerDto.pointsAwarded === answer.question.points;

        const markedAnswer = await this.answerRepository.save(answer);

        return this.mapToResponseDto(markedAnswer);
    }

    async findByAttempt(
        attemptId: number,
        userId: string,
    ): Promise<AnswerResponseDto[]> {
        // Validate attempt access
        const attempt = await this.testAttemptRepository.findOne({
            where: { attemptId },
        });

        if (!attempt) {
            throw new NotFoundException('Test attempt not found');
        }

        if (attempt.userId !== userId) {
            throw new ForbiddenException(
                'You can only access your own attempt answers',
            );
        }

        const answers = await this.answerRepository.find({
            where: { attemptId },
            relations: ['question', 'selectedOption'],
            order: { questionId: 'ASC' },
        });

        return answers.map(answer => this.mapToResponseDto(answer));
    }

    async findByQuestion(questionId: number): Promise<AnswerResponseDto[]> {
        // This method is typically for instructors to see all answers to a question
        const answers = await this.answerRepository.find({
            where: { questionId },
            relations: ['attempt', 'question', 'selectedOption'],
            order: { createdAt: 'DESC' },
        });

        return answers.map(answer => this.mapToResponseDto(answer));
    }

    async bulkCreate(
        bulkAnswersDto: BulkAnswersDto,
        userId: string,
    ): Promise<AnswerResponseDto[]> {
        const results: AnswerResponseDto[] = [];

        for (const answerDto of bulkAnswersDto.answers) {
            try {
                const answer = await this.create(answerDto, userId);
                results.push(answer);
            } catch (error) {
                // Continue with other answers even if one fails
                console.error(
                    `Failed to create answer for question ${answerDto.questionId}:`,
                    error instanceof Error ? error.message : 'Unknown error',
                );
            }
        }

        return results;
    }

    async autoMark(attemptId: number): Promise<void> {
        // Auto-mark objective questions (multiple choice)
        const answers = await this.answerRepository.find({
            where: { attemptId, isMarked: false },
            relations: ['question', 'selectedOption', 'attempt'],
        });

        for (const answer of answers) {
            if (
                answer.selectedOptionId &&
                answer.selectedOption &&
                answer.question.questionType === QuestionType.MULTIPLE_CHOICE
            ) {
                const selectedOption = answer.selectedOption as QuestionOption;
                answer.isCorrect = selectedOption.isCorrect;
                answer.pointsAwarded = answer.isCorrect
                    ? answer.question.points
                    : 0;
                answer.isMarked = true;
                answer.markedAt = new Date();

                await this.answerRepository.save(answer);
            }
        }
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
                      optionId: (answer.selectedOption as QuestionOption)
                          .optionId,
                      optionText: (answer.selectedOption as QuestionOption)
                          .optionText,
                      isCorrect: (answer.selectedOption as QuestionOption)
                          .isCorrect,
                  }
                : undefined,
        };
    }
}
