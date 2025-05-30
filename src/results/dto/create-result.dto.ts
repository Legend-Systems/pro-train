import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreateResultDto {
    @ApiProperty({
        description: 'Test attempt ID this result belongs to',
        example: 1,
    })
    @IsNumber()
    attemptId: number;

    @ApiProperty({
        description: 'User ID who took the test',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @ApiProperty({
        description: 'Test ID for this result',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @ApiProperty({
        description: 'Course ID for this result',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'Total score achieved',
        example: 85.5,
        minimum: 0,
    })
    @IsNumber()
    score: number;

    @ApiProperty({
        description: 'Maximum possible score for the test',
        example: 100,
        minimum: 0,
    })
    @IsNumber()
    maxScore: number;

    @ApiProperty({
        description: 'Percentage score (0-100)',
        example: 85.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    percentage: number;

    @ApiProperty({
        description: 'Whether the student passed the test',
        example: true,
    })
    @IsBoolean()
    passed: boolean;

    @ApiProperty({
        description: 'When the result was calculated',
        example: '2024-01-01T11:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    calculatedAt?: Date;
}
