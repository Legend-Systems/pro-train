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
        nullable: true,
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
        nullable: true,
    })
    description?: string;

    @ApiProperty({
        description: 'Course learning objectives',
        example:
            'Understand basic programming concepts, data structures, and algorithms',
        nullable: true,
    })
    learningObjectives?: string;

    @ApiProperty({
        description: 'Course prerequisites',
        example: 'Basic mathematics knowledge',
        nullable: true,
    })
    prerequisites?: string;

    @ApiProperty({
        description: 'Course duration in minutes',
        example: 1200,
        nullable: true,
    })
    duration?: number;

    @ApiProperty({
        description: 'Course difficulty level',
        example: 'intermediate',
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        nullable: true,
    })
    difficulty?: string;

    @ApiProperty({
        description: 'Course category',
        example: 'Programming',
        nullable: true,
    })
    category?: string;

    @ApiProperty({
        description: 'Course status',
        example: 'active',
        enum: ['active', 'inactive', 'deleted', 'draft'],
    })
    status: string;

    @ApiProperty({
        description: 'Whether the course is active',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Whether the course is published',
        example: true,
    })
    isPublished?: boolean;

    @ApiProperty({
        description: 'Course published timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    publishedAt?: Date;

    @ApiProperty({
        description: 'Course thumbnail information',
    })
    thumbnail?: any;

    @ApiProperty({
        description: 'Course rating',
        example: 4.5,
    })
    rating?: number;

    @ApiProperty({
        description: 'ID of the user who created this course',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    createdBy: string;

    @ApiProperty({
        description: 'Course creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Course last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Course creator information (full user object)',
        required: false,
    })
    creator?: any;

    @ApiProperty({
        description: 'Organization this course belongs to',
    })
    organization?: any;

    @ApiProperty({
        description: 'Branch this course belongs to',
    })
    branch?: any;

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

    @ApiProperty({
        description: 'Number of enrollments in this course',
        example: 23,
        required: false,
    })
    enrollmentCount?: number;

    @ApiProperty({
        description: 'User progress in this course (if enrolled)',
    })
    progress?: number;
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
        description: 'User-specific progress in this course',
        type: 'object',
        properties: {
            completionPercentage: { type: 'number', example: 75.5 },
            timeSpentMinutes: { type: 'number', example: 120 },
            questionsCompleted: { type: 'number', example: 25 },
            totalQuestions: { type: 'number', example: 30 },
            lastUpdated: { type: 'string', format: 'date-time' },
        },
        nullable: true,
    })
    userProgress?: {
        completionPercentage: number;
        timeSpentMinutes: number;
        questionsCompleted: number;
        totalQuestions: number;
        lastUpdated: Date;
    } | null;

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

    @ApiProperty({
        description: 'Course materials',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                materialId: { type: 'number', example: 1 },
                title: { type: 'string', example: 'Course Introduction' },
                description: {
                    type: 'string',
                    example: 'Introduction to the course materials',
                },
                sortOrder: { type: 'number', example: 1 },
                isActive: { type: 'boolean', example: true },
                mediaFile: { type: 'object' },
                creator: { type: 'object' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        },
        required: false,
    })
    courseMaterials?: any[];

    @ApiProperty({
        description: 'Course tests',
        type: 'array',
        items: {
            type: 'object',
            properties: {
                testId: { type: 'number', example: 1 },
                title: { type: 'string', example: 'Chapter 1 Quiz' },
                description: {
                    type: 'string',
                    example: 'Test your knowledge of chapter 1',
                },
                testType: { type: 'string', example: 'quiz' },
                timeLimit: { type: 'number', example: 30 },
                maxAttempts: { type: 'number', example: 3 },
                isActive: { type: 'boolean', example: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
            },
        },
        required: false,
    })
    tests?: any[];
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
        example: '2025-01-15T10:30:45.123Z',
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
