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

class TestInfo {
    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    @Expose()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'Chapter 1 Quiz',
    })
    @Expose()
    title: string;

    @ApiProperty({
        description: 'Test type',
        enum: ['exam', 'quiz', 'training'],
        example: 'training',
    })
    @Expose()
    testType: string;
}

export class TrainingProgressResponseDto {
    @ApiProperty({
        description: 'Training progress unique identifier',
        example: 1,
    })
    @Expose()
    progressId: number;

    @ApiProperty({
        description: 'User ID tracking progress',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    userId: string;

    @ApiProperty({
        description: 'Course ID for progress tracking',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'Specific test ID (optional for overall course progress)',
        example: 1,
        required: false,
    })
    @Expose()
    testId?: number;

    @ApiProperty({
        description: 'Completion percentage (0-100)',
        example: 75.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    completionPercentage: number;

    @ApiProperty({
        description: 'Total time spent in minutes',
        example: 120,
        minimum: 0,
    })
    @Expose()
    timeSpentMinutes: number;

    @ApiProperty({
        description: 'Number of questions completed',
        example: 25,
        minimum: 0,
    })
    @Expose()
    questionsCompleted: number;

    @ApiProperty({
        description: 'Total number of questions in the test/course',
        example: 30,
        minimum: 0,
    })
    @Expose()
    totalQuestions: number;

    @ApiProperty({
        description: 'When progress was last updated',
        example: '2024-01-01T10:30:00.000Z',
    })
    @Expose()
    lastUpdated: Date;

    @ApiProperty({
        description: 'Progress tracking start timestamp',
        example: '2024-01-01T09:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Progress last update timestamp',
        example: '2024-01-01T10:30:00.000Z',
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
        description: 'Course information',
        type: CourseInfo,
    })
    @Expose()
    course: CourseInfo;

    @ApiProperty({
        description: 'Test information (if specific test progress)',
        type: TestInfo,
        required: false,
    })
    @Expose()
    test?: TestInfo;
} 