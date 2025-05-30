import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsOptional } from 'class-validator';

export class CreateTrainingProgressDto {
    @ApiProperty({
        description: 'User ID tracking progress',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @ApiProperty({
        description: 'Course ID for progress tracking',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'Specific test ID (optional for overall course progress)',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    testId?: number;

    @ApiProperty({
        description: 'Completion percentage (0-100)',
        example: 75.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    completionPercentage: number;

    @ApiProperty({
        description: 'Total time spent in minutes',
        example: 120,
        minimum: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    timeSpentMinutes?: number;

    @ApiProperty({
        description: 'Number of questions completed',
        example: 25,
        minimum: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    questionsCompleted?: number;

    @ApiProperty({
        description: 'Total number of questions in the test/course',
        example: 30,
        minimum: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    totalQuestions?: number;
}
