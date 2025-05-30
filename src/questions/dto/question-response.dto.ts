import { ApiProperty } from '@nestjs/swagger';
import { QuestionType } from '../entities/question.entity';

export class QuestionResponseDto {
    @ApiProperty({
        description: 'Question unique identifier',
        example: 1,
    })
    questionId: number;

    @ApiProperty({
        description: 'Test ID that this question belongs to',
        example: 1,
    })
    testId: number;

    @ApiProperty({
        description: 'The question text/content',
        example: 'What is the time complexity of binary search algorithm?',
    })
    questionText: string;

    @ApiProperty({
        description: 'Type of question',
        example: QuestionType.MULTIPLE_CHOICE,
        enum: QuestionType,
    })
    questionType: QuestionType;

    @ApiProperty({
        description: 'Points awarded for correct answer',
        example: 5,
    })
    points: number;

    @ApiProperty({
        description: 'Order index of the question in the test',
        example: 1,
    })
    orderIndex: number;

    @ApiProperty({
        description: 'Question creation timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Question last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Test information',
        required: false,
    })
    test?: {
        testId: number;
        title: string;
        testType: string;
    };

    @ApiProperty({
        description: 'Number of answer options for this question',
        example: 4,
        required: false,
    })
    optionsCount?: number;

    @ApiProperty({
        description: 'Number of answers submitted for this question',
        example: 25,
        required: false,
    })
    answersCount?: number;
}
