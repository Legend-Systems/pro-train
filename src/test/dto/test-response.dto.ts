import { ApiProperty } from '@nestjs/swagger';
import { TestType } from '../entities/test.entity';

/**
 * Basic test response DTO with core information
 */
export class TestResponseDto {
    @ApiProperty({
        description: 'Test unique identifier',
        example: 1,
    })
    testId: number;

    @ApiProperty({
        description: 'Course ID that this test belongs to',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'Midterm Exam - Computer Science Fundamentals',
    })
    title: string;

    @ApiProperty({
        description: 'Test description and instructions',
        example:
            'This exam covers chapters 1-5 of the course material. You have 2 hours to complete.',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: 'Type of test',
        example: TestType.EXAM,
        enum: TestType,
    })
    testType: TestType;

    @ApiProperty({
        description: 'Test duration in minutes (null for untimed tests)',
        example: 120,
        required: false,
    })
    durationMinutes?: number;

    @ApiProperty({
        description: 'Maximum number of attempts allowed per user',
        example: 3,
        default: 1,
    })
    maxAttempts: number;

    @ApiProperty({
        description: 'Whether the test is currently active',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Test creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Test last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Course information',
        required: false,
    })
    course?: {
        courseId: number;
        title: string;
        description?: string;
    };

    @ApiProperty({
        description: 'Number of questions in this test',
        example: 25,
        default: 0,
    })
    questionCount: number;

    @ApiProperty({
        description: 'Number of attempts made by all users',
        example: 156,
        default: 0,
    })
    attemptCount: number;
}

/**
 * Detailed test response DTO with comprehensive information
 */
export class TestDetailDto extends TestResponseDto {
    @ApiProperty({
        description: 'Test statistics and analytics',
    })
    statistics: {
        totalQuestions: number;
        totalAttempts: number;
        uniqueStudents: number;
        averageScore: number;
        passRate: number;
        completionRate: number;
    };

    @ApiProperty({
        description: 'Questions in this test (summary)',
        required: false,
    })
    questions?: Array<{
        questionId: number;
        questionText: string;
        questionType: string;
        points: number;
        orderIndex: number;
    }>;
}

/**
 * Paginated list of tests response DTO
 */
export class TestListResponseDto {
    @ApiProperty({
        description: 'Array of tests with basic information',
        type: [TestResponseDto],
    })
    tests: TestResponseDto[];

    @ApiProperty({
        description: 'Total number of tests matching the query',
        example: 156,
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: 'Number of tests per page',
        example: 10,
    })
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 16,
    })
    totalPages: number;
}

/**
 * Test statistics and analytics DTO
 */
export class TestStatsDto {
    @ApiProperty({
        description: 'Test basic information',
    })
    test: {
        testId: number;
        title: string;
        testType: TestType;
        isActive: boolean;
    };

    @ApiProperty({
        description: 'Overall test statistics',
    })
    overview: {
        totalQuestions: number;
        totalAttempts: number;
        uniqueStudents: number;
        completedAttempts: number;
        inProgressAttempts: number;
    };

    @ApiProperty({
        description: 'Score distribution and performance metrics',
    })
    performance: {
        averageScore: number;
        medianScore: number;
        highestScore: number;
        lowestScore: number;
        passRate: number;
        averageCompletionTime: number;
    };

    @ApiProperty({
        description: 'Score distribution by ranges',
    })
    distribution: {
        '90-100': number;
        '80-89': number;
        '70-79': number;
        '60-69': number;
        '50-59': number;
        '0-49': number;
    };
}

/**
 * Test configuration and settings DTO
 */
export class TestConfigDto {
    @ApiProperty({
        description: 'Test identification',
    })
    test: {
        testId: number;
        title: string;
        courseId: number;
    };

    @ApiProperty({
        description: 'Test timing configuration',
    })
    timing: {
        durationMinutes?: number;
        isTimeLimited: boolean;
        bufferTimeMinutes: number;
    };

    @ApiProperty({
        description: 'Test access and attempt configuration',
    })
    access: {
        maxAttempts: number;
        isActive: boolean;
        requiresApproval: boolean;
        allowLateSubmission: boolean;
    };

    @ApiProperty({
        description: 'Test content configuration',
    })
    content: {
        totalQuestions: number;
        totalPoints: number;
        passingPercentage: number;
        showCorrectAnswers: boolean;
        shuffleQuestions: boolean;
    };
}
