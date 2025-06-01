import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsEnum,
    IsNumber,
    IsDateString,
    IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttemptStatus } from '../entities/test_attempt.entity';

export class TestAttemptFilterDto {
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
        description: 'Filter by user ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: false,
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiProperty({
        description: 'Filter by attempt status',
        enum: AttemptStatus,
        required: false,
    })
    @IsOptional()
    @IsEnum(AttemptStatus)
    status?: AttemptStatus;

    @ApiProperty({
        description: 'Filter by start date (from)',
        example: '2025-01-01T00:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    startDateFrom?: string;

    @ApiProperty({
        description: 'Filter by start date (to)',
        example: '2025-01-31T23:59:59.999Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    startDateTo?: string;

    @ApiProperty({
        description: 'Filter by submit date (from)',
        example: '2025-01-01T00:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    submitDateFrom?: string;

    @ApiProperty({
        description: 'Filter by submit date (to)',
        example: '2025-01-31T23:59:59.999Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    submitDateTo?: string;

    @ApiProperty({
        description: 'Page number for pagination',
        example: 1,
        default: 1,
        minimum: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of items per page',
        example: 10,
        default: 10,
        minimum: 1,
        maximum: 100,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    pageSize?: number = 10;
}
