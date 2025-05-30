import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsNumber,
    Min,
    IsOptional,
} from 'class-validator';
import { QuestionType } from '../entities/question.entity';

export class CreateQuestionDto {
    @ApiProperty({
        description: 'Test ID that this question belongs to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    testId: number;

    @ApiProperty({
        description: 'The question text/content',
        example: 'What is the time complexity of binary search algorithm?',
    })
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @ApiProperty({
        description: 'Type of question',
        example: QuestionType.MULTIPLE_CHOICE,
        enum: QuestionType,
    })
    @IsEnum(QuestionType)
    @IsNotEmpty()
    questionType: QuestionType;

    @ApiProperty({
        description: 'Points awarded for correct answer',
        example: 5,
        minimum: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    points: number;

    @ApiProperty({
        description:
            'Order index of the question in the test (will auto-increment if not provided)',
        example: 1,
        minimum: 1,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(1)
    orderIndex?: number;
}
