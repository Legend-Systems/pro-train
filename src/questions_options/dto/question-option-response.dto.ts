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
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Option last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
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

// Enhanced response types matching user controller pattern
export class StandardApiResponse<T = any> {
    @ApiProperty({
        description: 'Indicates if the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Operation completed successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Response data payload',
        required: false,
    })
    data?: T;

    @ApiProperty({
        description: 'Additional metadata about the response',
        required: false,
    })
    meta?: {
        timestamp?: string;
        requestId?: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}

export class QuestionOptionApiResponse extends StandardApiResponse<QuestionOptionResponseDto> {
    @ApiProperty({
        description: 'Question option data retrieved successfully',
        type: QuestionOptionResponseDto,
    })
    data: QuestionOptionResponseDto;
}

export class QuestionOptionListApiResponse extends StandardApiResponse<{
    options: QuestionOptionResponseDto[];
    total: number;
    correctCount: number;
    question?: {
        questionId: number;
        questionText: string;
        questionType: string;
        points: number;
    };
}> {
    @ApiProperty({
        description: 'Question options list data with metadata',
        type: 'object',
        properties: {
            options: {
                type: 'array',
                items: {
                    $ref: '#/components/schemas/QuestionOptionResponseDto',
                },
                description: 'Array of question options',
            },
            total: {
                type: 'number',
                example: 4,
                description: 'Total number of options',
            },
            correctCount: {
                type: 'number',
                example: 1,
                description: 'Number of correct options',
            },
            question: {
                type: 'object',
                description: 'Question information',
                required: [
                    'questionId',
                    'questionText',
                    'questionType',
                    'points',
                ],
                properties: {
                    questionId: { type: 'number', example: 1 },
                    questionText: {
                        type: 'string',
                        example: 'What is the time complexity?',
                    },
                    questionType: {
                        type: 'string',
                        example: 'multiple_choice',
                    },
                    points: { type: 'number', example: 5 },
                },
            },
        },
    })
    data: {
        options: QuestionOptionResponseDto[];
        total: number;
        correctCount: number;
        question?: {
            questionId: number;
            questionText: string;
            questionType: string;
            points: number;
        };
    };
}

// Specific operation response DTOs for better documentation
export class QuestionOptionCreatedResponse {
    @ApiProperty({
        description: 'Question option creation success message',
        example: 'Question option created successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 201,
    })
    code: number;
}

export class QuestionOptionUpdatedResponse {
    @ApiProperty({
        description: 'Question option update success message',
        example: 'Question option updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class QuestionOptionDeletedResponse {
    @ApiProperty({
        description: 'Question option deletion success message',
        example: 'Question option deleted successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class BulkQuestionOptionsCreatedResponse {
    @ApiProperty({
        description: 'Bulk question options creation success message',
        example: 'Question options created successfully in bulk',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 201,
    })
    code: number;
}
