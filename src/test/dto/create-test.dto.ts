import {
    IsNumber,
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    Min,
    MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TestType } from '../entities/test.entity';

/**
 * Data Transfer Object for creating a new test
 * Used for test creation with comprehensive validation
 */
export class CreateTestDto {
    @ApiProperty({
        description: 'Course ID that this test belongs to',
        example: 1,
        type: Number,
        title: 'Course ID',
        minimum: 1,
    })
    @IsNumber({}, { message: 'Course ID must be a valid number' })
    @IsNotEmpty({ message: 'Course ID is required' })
    @Min(1, { message: 'Course ID must be at least 1' })
    courseId: number;

    @ApiProperty({
        description: 'Test title for identification and display',
        example: 'Midterm Exam - Computer Science Fundamentals',
        type: String,
        title: 'Test Title',
        maxLength: 255,
        minLength: 3,
    })
    @IsString({ message: 'Test title must be a string' })
    @IsNotEmpty({ message: 'Test title is required' })
    @MinLength(3, { message: 'Test title must be at least 3 characters long' })
    title: string;

    @ApiProperty({
        description:
            'Test description and instructions for students taking the test',
        example:
            'This exam covers chapters 1-5 of the course material. You have 2 hours to complete all questions.',
        required: false,
        type: String,
        title: 'Test Description',
    })
    @IsOptional()
    @IsString({ message: 'Test description must be a string' })
    description?: string;

    @ApiProperty({
        description: 'Type of test determining behavior and purpose',
        example: TestType.EXAM,
        enum: TestType,
        title: 'Test Type',
    })
    @IsEnum(TestType, {
        message: 'Test type must be one of: exam, quiz, training',
    })
    @IsNotEmpty({ message: 'Test type is required' })
    testType: TestType;

    @ApiProperty({
        description: 'Test duration in minutes (leave empty for untimed tests)',
        example: 120,
        required: false,
        type: Number,
        title: 'Duration (Minutes)',
        minimum: 1,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Duration must be a valid number' })
    @Min(1, { message: 'Duration must be at least 1 minute' })
    durationMinutes?: number;

    @ApiProperty({
        description: 'Maximum number of attempts allowed per user',
        example: 3,
        default: 1,
        type: Number,
        title: 'Maximum Attempts',
        minimum: 1,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Maximum attempts must be a valid number' })
    @Min(1, { message: 'Maximum attempts must be at least 1' })
    maxAttempts?: number;
}
