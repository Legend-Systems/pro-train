import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsEnum,
    IsNumber,
    IsDateString,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType } from '../entities/question.entity';

export class QuestionFilterDto {
    @ApiProperty({
        description: 'Filter by test ID',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    testId?: number;

    @ApiProperty({
        description: 'Filter by question type',
        enum: QuestionType,
        required: false,
    })
    @IsOptional()
    @IsEnum(QuestionType)
    questionType?: QuestionType;

    @ApiProperty({
        description: 'Filter by minimum points',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    minPoints?: number;

    @ApiProperty({
        description: 'Filter by maximum points',
        example: 10,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    maxPoints?: number;

    @ApiProperty({
        description: 'Filter by creation date from',
        example: '2025-01-01',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    createdFrom?: string;

    @ApiProperty({
        description: 'Filter by creation date to',
        example: '2025-12-31',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    createdTo?: string;

    @ApiProperty({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1,
        default: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of items per page',
        example: 10,
        minimum: 1,
        maximum: 100,
        default: 10,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    pageSize?: number = 10;
}
