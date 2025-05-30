import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';

export class CourseResponseDto {
    @ApiProperty({
        description: 'Course unique identifier',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Introduction to Computer Science',
    })
    title: string;

    @ApiProperty({
        description: 'Course description',
        example:
            'A comprehensive introduction to computer science fundamentals',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: 'ID of the user who created this course',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    createdBy: string;

    @ApiProperty({
        description: 'Course creation timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Course last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Course creator information',
        type: () => User,
        required: false,
    })
    creator?: User;

    @ApiProperty({
        description: 'Number of tests in this course',
        example: 5,
        required: false,
    })
    testCount?: number;

    @ApiProperty({
        description: 'Number of students enrolled in this course',
        example: 23,
        required: false,
    })
    studentCount?: number;
}

export class CourseListResponseDto {
    @ApiProperty({
        description: 'List of courses',
        type: [CourseResponseDto],
    })
    courses: CourseResponseDto[];

    @ApiProperty({
        description: 'Total number of courses',
        example: 100,
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: 'Number of courses per page',
        example: 10,
    })
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 10,
    })
    totalPages: number;
}

export class CourseDetailDto extends CourseResponseDto {
    @ApiProperty({
        description: 'Detailed course statistics',
        type: 'object',
        properties: {
            totalTests: { type: 'number', example: 5 },
            activeTests: { type: 'number', example: 3 },
            totalAttempts: { type: 'number', example: 127 },
            averageScore: { type: 'number', example: 85.6 },
        },
    })
    statistics?: {
        totalTests: number;
        activeTests: number;
        totalAttempts: number;
        averageScore: number;
    };
}

export class CourseStatsDto {
    @ApiProperty({
        description: 'Course unique identifier',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Total number of tests in the course',
        example: 8,
    })
    totalTests: number;

    @ApiProperty({
        description: 'Number of active tests',
        example: 5,
    })
    activeTests: number;

    @ApiProperty({
        description: 'Total number of test attempts across all tests',
        example: 245,
    })
    totalAttempts: number;

    @ApiProperty({
        description: 'Number of unique students who attempted tests',
        example: 34,
    })
    uniqueStudents: number;

    @ApiProperty({
        description: 'Average score across all test attempts',
        example: 78.5,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Pass rate percentage',
        example: 72.3,
    })
    passRate: number;

    @ApiProperty({
        description: 'Most recent test attempt timestamp',
        example: '2024-01-15T10:30:45.123Z',
        required: false,
    })
    lastActivityAt?: Date;
}
