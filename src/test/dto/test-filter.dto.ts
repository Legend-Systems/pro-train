import {
    IsOptional,
    IsString,
    IsNumber,
    IsEnum,
    IsBoolean,
    IsDateString,
    Min,
    Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TestType } from '../entities/test.entity';

/**
 * Data Transfer Object for filtering and searching tests
 * Used for advanced test queries with pagination and sorting
 */
export class TestFilterDto {
    @ApiProperty({
        description: 'Filter tests by course ID',
        example: 1,
        required: false,
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Course ID must be a valid number' })
    @Min(1, { message: 'Course ID must be at least 1' })
    courseId?: number;

    @ApiProperty({
        description: 'Search tests by title (partial match)',
        example: 'midterm',
        required: false,
        type: String,
        maxLength: 255,
    })
    @IsOptional()
    @IsString({ message: 'Title filter must be a string' })
    title?: string;

    @ApiProperty({
        description: 'Filter tests by type',
        example: TestType.EXAM,
        required: false,
        enum: TestType,
    })
    @IsOptional()
    @IsEnum(TestType, {
        message: 'Test type must be one of: exam, quiz, training',
    })
    testType?: TestType;

    @ApiProperty({
        description: 'Filter tests by active status',
        example: true,
        required: false,
        type: Boolean,
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean({ message: 'Active status must be a boolean' })
    isActive?: boolean;

    @ApiProperty({
        description: 'Filter tests created after this date (ISO string)',
        example: '2024-01-01T00:00:00.000Z',
        required: false,
        type: String,
        format: 'date-time',
    })
    @IsOptional()
    @IsDateString({}, { message: 'Created after must be a valid ISO date' })
    createdAfter?: string;

    @ApiProperty({
        description: 'Filter tests created before this date (ISO string)',
        example: '2024-12-31T23:59:59.999Z',
        required: false,
        type: String,
        format: 'date-time',
    })
    @IsOptional()
    @IsDateString({}, { message: 'Created before must be a valid ISO date' })
    createdBefore?: string;

    @ApiProperty({
        description: 'Filter tests with minimum duration (minutes)',
        example: 60,
        required: false,
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Minimum duration must be a valid number' })
    @Min(1, { message: 'Minimum duration must be at least 1 minute' })
    minDuration?: number;

    @ApiProperty({
        description: 'Filter tests with maximum duration (minutes)',
        example: 180,
        required: false,
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Maximum duration must be a valid number' })
    @Min(1, { message: 'Maximum duration must be at least 1 minute' })
    maxDuration?: number;

    @ApiProperty({
        description: 'Filter tests with minimum allowed attempts',
        example: 1,
        required: false,
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Minimum attempts must be a valid number' })
    @Min(1, { message: 'Minimum attempts must be at least 1' })
    minAttempts?: number;

    @ApiProperty({
        description: 'Filter tests with maximum allowed attempts',
        example: 5,
        required: false,
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Maximum attempts must be a valid number' })
    @Min(1, { message: 'Maximum attempts must be at least 1' })
    maxAttempts?: number;

    // Pagination parameters
    @ApiProperty({
        description: 'Page number for pagination',
        example: 1,
        default: 1,
        required: false,
        type: Number,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Page must be a valid number' })
    @Min(1, { message: 'Page must be at least 1' })
    page?: number = 1;

    @ApiProperty({
        description: 'Number of tests per page',
        example: 10,
        default: 10,
        required: false,
        type: Number,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Limit must be a valid number' })
    @Min(1, { message: 'Limit must be at least 1' })
    @Max(100, { message: 'Limit cannot exceed 100' })
    limit?: number = 10;

    // Sorting parameters
    @ApiProperty({
        description: 'Sort tests by field',
        example: 'createdAt',
        default: 'createdAt',
        required: false,
        enum: [
            'testId',
            'title',
            'testType',
            'durationMinutes',
            'maxAttempts',
            'isActive',
            'createdAt',
            'updatedAt',
        ],
    })
    @IsOptional()
    @IsString({ message: 'Sort by must be a string' })
    @IsEnum(
        [
            'testId',
            'title',
            'testType',
            'durationMinutes',
            'maxAttempts',
            'isActive',
            'createdAt',
            'updatedAt',
        ],
        {
            message:
                'Sort by must be one of: testId, title, testType, durationMinutes, maxAttempts, isActive, createdAt, updatedAt',
        },
    )
    sortBy?: string = 'createdAt';

    @ApiProperty({
        description: 'Sort order',
        example: 'DESC',
        default: 'DESC',
        required: false,
        enum: ['ASC', 'DESC'],
    })
    @IsOptional()
    @IsString({ message: 'Sort order must be a string' })
    @IsEnum(['ASC', 'DESC'], {
        message: 'Sort order must be either ASC or DESC',
    })
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
