import { ApiProperty } from '@nestjs/swagger';

export class QuestionOptionResponseDto {
    @ApiProperty({
        description: 'Question option unique identifier',
        example: 1,
    })
    optionId: number;

    @ApiProperty({
        description: 'Question ID that this option belongs to',
        example: 1,
    })
    questionId: number;

    @ApiProperty({
        description: 'The option text/content',
        example: 'O(log n) - Logarithmic time complexity',
    })
    optionText: string;

    @ApiProperty({
        description: 'Whether this option is the correct answer',
        example: true,
    })
    isCorrect: boolean;

    @ApiProperty({
        description: 'Option creation timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Option last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Question information',
        required: false,
    })
    question?: {
        questionId: number;
        questionText: string;
        questionType: string;
        points: number;
    };

    @ApiProperty({
        description: 'Number of times this option was selected',
        example: 25,
        required: false,
    })
    timesSelected?: number;

    @ApiProperty({
        description: 'Selection percentage among all answers',
        example: 45.5,
        required: false,
    })
    selectionPercentage?: number;
}
