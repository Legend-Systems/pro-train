import { ApiProperty } from '@nestjs/swagger';

// Simplified creator DTO to avoid complex nested structures in Swagger
export class CourseCreatorDto {
    @ApiProperty({
        description: 'Creator unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Creator email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'Creator first name',
        example: 'John',
    })
    firstName: string;

    @ApiProperty({
        description: 'Creator last name',
        example: 'Doe',
    })
    lastName: string;

    @ApiProperty({
        description: 'Creator role',
        example: 'admin',
        required: false,
    })
    role?: string;
}

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
        description: 'Course creator information (simplified)',
        type: () => CourseCreatorDto,
        required: false,
    })
    creator?: CourseCreatorDto;

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

// Enhanced response types matching user controller pattern
export class StandardApiResponse<T = unknown> {
    @ApiProperty({
        description: 'Indicates if the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Operation completed successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Response data payload',
        required: false,
    })
    data?: T;

    @ApiProperty({
        description: 'Additional metadata about the response',
        required: false,
    })
    meta?: {
        timestamp?: string;
        requestId?: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}

export class StandardOperationResponse {
    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Course created successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status indicator',
        example: 'success',
        enum: ['success', 'error', 'warning', 'info', 'debug'],
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class CourseApiResponse extends StandardApiResponse<CourseResponseDto> {
    @ApiProperty({
        description: 'Course data retrieved successfully',
        type: CourseResponseDto,
    })
    data: CourseResponseDto;
}

export class CourseListApiResponse extends StandardApiResponse<CourseListResponseDto> {
    @ApiProperty({
        description: 'Courses list data with pagination',
        type: CourseListResponseDto,
    })
    data: CourseListResponseDto;
}

export class CourseDetailApiResponse extends StandardApiResponse<CourseDetailDto> {
    @ApiProperty({
        description: 'Course details retrieved successfully',
        type: CourseDetailDto,
    })
    data: CourseDetailDto;
}

export class CourseStatsApiResponse extends StandardApiResponse<CourseStatsDto> {
    @ApiProperty({
        description: 'Course statistics retrieved successfully',
        type: CourseStatsDto,
    })
    data: CourseStatsDto;
}

// Specific operation response DTOs for better documentation
export class CourseCreatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Course creation success message',
        example: 'Course created successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 201,
    })
    code: number;
}

export class CourseUpdatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Course update success message',
        example: 'Course updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class CourseDeletedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Course deletion success message',
        example: 'Course deleted successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}
