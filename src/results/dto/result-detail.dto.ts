import { ApiProperty } from '@nestjs/swagger';
import {
    IsNumber,
    IsString,
    IsBoolean,
    IsDate,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TestDetailDto {
    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'JavaScript Fundamentals Quiz',
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Test description',
        example: 'A comprehensive quiz covering JavaScript basics',
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Test type',
        example: 'quiz',
        enum: ['exam', 'quiz', 'training'],
    })
    @IsString()
    testType: string;

    @ApiProperty({
        description: 'Duration in minutes',
        example: 60,
    })
    @IsNumber()
    durationMinutes: number;

    @ApiProperty({
        description: 'Maximum attempts allowed',
        example: 3,
    })
    @IsNumber()
    maxAttempts: number;
}

export class CourseDetailDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Web Development Bootcamp',
    })
    @IsString()
    title: string;

    @ApiProperty({
        description: 'Course description',
        example:
            'Complete web development course covering frontend and backend',
    })
    @IsString()
    description: string;

    @ApiProperty({
        description: 'Course creator name',
        example: 'Dr. Jane Smith',
    })
    @IsString()
    creatorName: string;
}

export class UserDetailDto {
    @ApiProperty({
        description: 'User ID',
        example: 'user-123',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description: 'User first name',
        example: 'John',
    })
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    @IsString()
    lastName: string;

    @ApiProperty({
        description: 'User email',
        example: 'john.doe@example.com',
    })
    @IsString()
    email: string;
}

export class AttemptDetailDto {
    @ApiProperty({
        description: 'Attempt ID',
        example: 1,
    })
    @IsNumber()
    attemptId: number;

    @ApiProperty({
        description: 'Attempt number (1st, 2nd, etc.)',
        example: 2,
    })
    @IsNumber()
    attemptNumber: number;

    @ApiProperty({
        description: 'Attempt start time',
        example: '2024-01-15T10:00:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    startTime: Date;

    @ApiProperty({
        description: 'Attempt end time',
        example: '2024-01-15T11:30:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    endTime: Date;

    @ApiProperty({
        description: 'Time spent in minutes',
        example: 90,
    })
    @IsNumber()
    timeSpent: number;

    @ApiProperty({
        description: 'Attempt status',
        example: 'completed',
        enum: ['in_progress', 'completed', 'submitted', 'timed_out'],
    })
    @IsString()
    status: string;
}

export class ResultDetailDto {
    @ApiProperty({
        description: 'Result ID',
        example: 1,
    })
    @IsNumber()
    resultId: number;

    @ApiProperty({
        description: 'Score achieved',
        example: 85,
    })
    @IsNumber()
    score: number;

    @ApiProperty({
        description: 'Maximum possible score',
        example: 100,
    })
    @IsNumber()
    maxScore: number;

    @ApiProperty({
        description: 'Percentage score',
        example: 85.0,
    })
    @IsNumber()
    percentage: number;

    @ApiProperty({
        description: 'Whether the test was passed',
        example: true,
    })
    @IsBoolean()
    passed: boolean;

    @ApiProperty({
        description: 'Test completion date',
        example: '2024-01-15T11:30:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    completedAt: Date;

    @ApiProperty({
        description: 'Result creation date',
        example: '2024-01-15T11:35:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    createdAt: Date;

    @ApiProperty({
        description: 'Last update date',
        example: '2024-01-15T11:35:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    updatedAt: Date;

    @ApiProperty({
        description: 'Test details',
        type: TestDetailDto,
    })
    @ValidateNested()
    @Type(() => TestDetailDto)
    test: TestDetailDto;

    @ApiProperty({
        description: 'Course details',
        type: CourseDetailDto,
    })
    @ValidateNested()
    @Type(() => CourseDetailDto)
    course: CourseDetailDto;

    @ApiProperty({
        description: 'User details',
        type: UserDetailDto,
    })
    @ValidateNested()
    @Type(() => UserDetailDto)
    user: UserDetailDto;

    @ApiProperty({
        description: 'Attempt details',
        type: AttemptDetailDto,
    })
    @ValidateNested()
    @Type(() => AttemptDetailDto)
    attempt: AttemptDetailDto;

    @ApiProperty({
        description: 'Rank among all students for this test',
        example: 5,
    })
    @IsNumber()
    rank: number;

    @ApiProperty({
        description: 'Percentile rank',
        example: 78.5,
    })
    @IsNumber()
    percentileRank: number;

    @ApiProperty({
        description: 'Average score for this test',
        example: 72.5,
    })
    @IsNumber()
    testAverage: number;

    @ApiProperty({
        description: 'Performance compared to average (above/below/average)',
        example: 'above',
        enum: ['well_above', 'above', 'average', 'below', 'well_below'],
    })
    @IsString()
    performanceLevel: string;
}
