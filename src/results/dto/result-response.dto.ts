import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class UserInfo {
    @ApiProperty({
        description: 'User ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    id: string;

    @ApiProperty({
        description: 'Username',
        example: 'johndoe',
    })
    @Expose()
    username: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    @Expose()
    fullName: string;
}

class TestInfo {
    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    @Expose()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'Advanced Mathematics Quiz',
    })
    @Expose()
    title: string;

    @ApiProperty({
        description: 'Test type',
        enum: ['exam', 'quiz', 'training'],
        example: 'quiz',
    })
    @Expose()
    testType: string;

    @ApiProperty({
        description: 'Duration in minutes',
        example: 60,
    })
    @Expose()
    durationMinutes: number;
}

class CourseInfo {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Advanced Mathematics',
    })
    @Expose()
    title: string;

    @ApiProperty({
        description: 'Course description',
        example: 'Advanced mathematics course covering calculus and algebra',
    })
    @Expose()
    description: string;
}

class AttemptInfo {
    @ApiProperty({
        description: 'Attempt ID',
        example: 1,
    })
    @Expose()
    attemptId: number;

    @ApiProperty({
        description: 'Attempt number',
        example: 2,
    })
    @Expose()
    attemptNumber: number;

    @ApiProperty({
        description: 'Start time',
        example: '2024-01-01T10:00:00.000Z',
    })
    @Expose()
    startTime: Date;

    @ApiProperty({
        description: 'End time',
        example: '2024-01-01T11:00:00.000Z',
    })
    @Expose()
    endTime: Date;
}

export class ResultResponseDto {
    @ApiProperty({
        description: 'Result unique identifier',
        example: 1,
    })
    @Expose()
    resultId: number;

    @ApiProperty({
        description: 'Test attempt ID this result belongs to',
        example: 1,
    })
    @Expose()
    attemptId: number;

    @ApiProperty({
        description: 'User ID who took the test',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    userId: string;

    @ApiProperty({
        description: 'Test ID for this result',
        example: 1,
    })
    @Expose()
    testId: number;

    @ApiProperty({
        description: 'Course ID for this result',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'Total score achieved',
        example: 85.5,
        minimum: 0,
    })
    @Expose()
    score: number;

    @ApiProperty({
        description: 'Maximum possible score for the test',
        example: 100,
        minimum: 0,
    })
    @Expose()
    maxScore: number;

    @ApiProperty({
        description: 'Percentage score (0-100)',
        example: 85.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    percentage: number;

    @ApiProperty({
        description: 'Whether the student passed the test',
        example: true,
    })
    @Expose()
    passed: boolean;

    @ApiProperty({
        description: 'When the result was calculated',
        example: '2024-01-01T11:00:00.000Z',
    })
    @Expose()
    calculatedAt: Date;

    @ApiProperty({
        description: 'Result creation timestamp',
        example: '2024-01-01T11:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Result last update timestamp',
        example: '2024-01-01T11:00:00.000Z',
    })
    @Expose()
    updatedAt: Date;

    @ApiProperty({
        description: 'User information',
        type: UserInfo,
    })
    @Expose()
    user: UserInfo;

    @ApiProperty({
        description: 'Test information',
        type: TestInfo,
    })
    @Expose()
    test: TestInfo;

    @ApiProperty({
        description: 'Course information',
        type: CourseInfo,
    })
    @Expose()
    course: CourseInfo;

    @ApiProperty({
        description: 'Attempt information',
        type: AttemptInfo,
    })
    @Expose()
    attempt: AttemptInfo;
}
