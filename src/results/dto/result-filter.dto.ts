import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsOptional,
    IsUUID,
    IsNumber,
    IsBoolean,
    IsDateString,
    IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class ResultFilterDto {
    @ApiPropertyOptional({
        description: 'Filter by user ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Filter by test ID',
        example: 1,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    testId?: number;

    @ApiPropertyOptional({
        description: 'Filter by course ID',
        example: 1,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    courseId?: number;

    @ApiPropertyOptional({
        description: 'Filter by pass status',
        example: true,
    })
    @IsOptional()
    @Transform(({ value }) => value === 'true')
    @IsBoolean()
    passed?: boolean;

    @ApiPropertyOptional({
        description: 'Minimum percentage score',
        example: 70,
        minimum: 0,
        maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    minPercentage?: number;

    @ApiPropertyOptional({
        description: 'Maximum percentage score',
        example: 100,
        minimum: 0,
        maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => parseFloat(value))
    @IsNumber()
    maxPercentage?: number;

    @ApiPropertyOptional({
        description: 'Start date for filtering results',
        example: '2024-01-01T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for filtering results',
        example: '2024-12-31T23:59:59.999Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 10,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    limit?: number = 10;

    @ApiPropertyOptional({
        description: 'Sort field',
        enum: ['percentage', 'score', 'calculatedAt', 'createdAt'],
        example: 'percentage',
    })
    @IsOptional()
    @IsEnum(['percentage', 'score', 'calculatedAt', 'createdAt'])
    sortBy?: string = 'createdAt';

    @ApiPropertyOptional({
        description: 'Sort order',
        enum: ['ASC', 'DESC'],
        example: 'DESC',
    })
    @IsOptional()
    @IsEnum(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
