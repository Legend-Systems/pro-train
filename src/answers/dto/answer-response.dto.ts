import { ApiProperty } from '@nestjs/swagger';
import {
    IsNumber,
    IsOptional,
    IsString,
    IsBoolean,
    IsUUID,
    IsDateString,
} from 'class-validator';

export class AnswerResponseDto {
    @ApiProperty({
        description: 'Answer unique identifier',
        example: 1,
    })
    @IsNumber()
    answerId: number;

    @ApiProperty({
        description: 'Test attempt ID this answer belongs to',
        example: 1,
    })
    @IsNumber()
    attemptId: number;

    @ApiProperty({
        description: 'Question ID this answer responds to',
        example: 1,
    })
    @IsNumber()
    questionId: number;

    @ApiProperty({
        description: 'Selected option ID for multiple choice questions',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    selectedOptionId?: number;

    @ApiProperty({
        description: 'Text answer for open-ended questions',
        example: 'The time complexity of binary search is O(log n)',
        required: false,
    })
    @IsOptional()
    @IsString()
    textAnswer?: string;

    @ApiProperty({
        description: 'Points awarded for this answer',
        example: 4.5,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    pointsAwarded?: number;

    @ApiProperty({
        description: 'Whether this answer has been marked/graded',
        example: true,
    })
    @IsBoolean()
    isMarked: boolean;

    @ApiProperty({
        description: 'Whether this answer is correct',
        example: true,
    })
    @IsBoolean()
    isCorrect: boolean;

    @ApiProperty({
        description: 'User ID who marked this answer',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: false,
    })
    @IsOptional()
    @IsUUID()
    markedByUserId?: string;

    @ApiProperty({
        description: 'When this answer was marked/graded',
        example: '2025-01-01T11:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    markedAt?: Date;

    @ApiProperty({
        description: 'Feedback from the marker',
        example: 'Good understanding but could provide more detail',
        required: false,
    })
    @IsOptional()
    @IsString()
    feedback?: string;

    @ApiProperty({
        description: 'Answer submission timestamp',
        example: '2025-01-01T09:30:00.000Z',
    })
    @IsDateString()
    createdAt: Date;

    @ApiProperty({
        description: 'Answer last update timestamp',
        example: '2025-01-01T11:00:00.000Z',
    })
    @IsDateString()
    updatedAt: Date;

    @ApiProperty({
        description: 'Question details',
        required: false,
    })
    @IsOptional()
    question?: {
        questionId: number;
        questionText: string;
        questionType: string;
        points: number;
    };

    @ApiProperty({
        description: 'Selected option details',
        required: false,
    })
    @IsOptional()
    selectedOption?: {
        optionId: number;
        optionText: string;
        isCorrect: boolean;
    };
}
