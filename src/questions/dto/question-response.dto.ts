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

// Enhanced response types matching user controller pattern
export class StandardApiResponse<T = any> {
    @ApiProperty({
        description: 'Indicates if the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Question created successfully',
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

export class QuestionApiResponse extends StandardApiResponse<QuestionResponseDto> {
    @ApiProperty({
        description: 'Question data retrieved successfully',
        type: QuestionResponseDto,
    })
    data: QuestionResponseDto;
}

export class QuestionListApiResponse extends StandardApiResponse<{
    questions: QuestionResponseDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    totalPoints: number;
}> {
    @ApiProperty({
        description: 'Questions list data with pagination and metadata',
        type: 'object',
        properties: {
            questions: {
                type: 'array',
                items: { $ref: '#/components/schemas/QuestionResponseDto' },
                description: 'Array of questions',
            },
            total: {
                type: 'number',
                example: 50,
                description: 'Total number of questions',
            },
            page: {
                type: 'number',
                example: 1,
                description: 'Current page number',
            },
            pageSize: {
                type: 'number',
                example: 10,
                description: 'Number of questions per page',
            },
            totalPages: {
                type: 'number',
                example: 5,
                description: 'Total number of pages',
            },
            totalPoints: {
                type: 'number',
                example: 125,
                description: 'Total points for all questions',
            },
        },
    })
    data: {
        questions: QuestionResponseDto[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        totalPoints: number;
    };
}

// Specific operation response DTOs for better documentation
export class QuestionCreatedResponse {
    @ApiProperty({
        description: 'Question creation success message',
        example: 'Question created successfully',
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

export class QuestionUpdatedResponse {
    @ApiProperty({
        description: 'Question update success message',
        example: 'Question updated successfully',
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

export class QuestionDeletedResponse {
    @ApiProperty({
        description: 'Question deletion success message',
        example: 'Question deleted successfully',
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

export class QuestionsReorderedResponse {
    @ApiProperty({
        description: 'Questions reorder success message',
        example: 'Questions reordered successfully',
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

export class BulkQuestionsCreatedResponse {
    @ApiProperty({
        description: 'Bulk questions creation success message',
        example: '5 questions created successfully',
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
