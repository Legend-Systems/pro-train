import { ApiProperty } from '@nestjs/swagger';
import { AttemptStatus } from '../entities/test_attempt.entity';

export class TestAttemptResponseDto {
    @ApiProperty({
        description: 'Test attempt unique identifier',
        example: 1,
    })
    attemptId: number;

    @ApiProperty({
        description: 'Test ID for this attempt',
        example: 1,
    })
    testId: number;

    @ApiProperty({
        description: 'User ID who is taking the test',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    userId: string;

    @ApiProperty({
        description: 'Attempt number for this user and test',
        example: 1,
    })
    attemptNumber: number;

    @ApiProperty({
        description: 'Current status of the test attempt',
        example: AttemptStatus.IN_PROGRESS,
        enum: AttemptStatus,
    })
    status: AttemptStatus;

    @ApiProperty({
        description: 'When the test attempt started',
        example: '2024-01-01T09:00:00.000Z',
    })
    startTime: Date;

    @ApiProperty({
        description: 'When the test attempt was submitted',
        example: '2024-01-01T10:30:00.000Z',
        required: false,
    })
    submitTime?: Date;

    @ApiProperty({
        description: 'When the test attempt expires',
        example: '2024-01-01T11:00:00.000Z',
        required: false,
    })
    expiresAt?: Date;

    @ApiProperty({
        description: 'Current progress percentage (0-100)',
        example: 75.5,
    })
    progressPercentage: number;

    @ApiProperty({
        description: 'Test attempt creation timestamp',
        example: '2024-01-01T09:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Test attempt last update timestamp',
        example: '2024-01-01T10:15:30.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Test information',
        example: {
            testId: 1,
            title: 'JavaScript Fundamentals Quiz',
            testType: 'quiz',
            durationMinutes: 120,
        },
    })
    test?: {
        testId: number;
        title: string;
        testType: string;
        durationMinutes?: number;
    };

    @ApiProperty({
        description: 'User information',
        example: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            email: 'student@example.com',
            firstName: 'John',
            lastName: 'Doe',
        },
    })
    user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
    };

    @ApiProperty({
        description: 'Number of answers submitted for this attempt',
        example: 5,
    })
    answersCount?: number;

    @ApiProperty({
        description: 'Total number of questions in the test',
        example: 10,
    })
    totalQuestions?: number;
} 