import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '../entities/course-material.entity';

export class CourseMaterialResponseDto {
    @ApiProperty({
        description: '🆔 Course material unique identifier',
        example: 1,
    })
    materialId: number;

    @ApiProperty({
        description: '📝 Material title',
        example: 'Introduction to Programming Concepts',
    })
    title: string;

    @ApiProperty({
        description: '📄 Detailed material description',
        example:
            'A comprehensive guide covering basic programming concepts and fundamentals',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description:
            '📎 Media file containing the course material content with multiple format variants',
        example: {
            id: 1,
            originalName: 'programming-guide.pdf',
            url: 'https://storage.googleapis.com/bucket/media/programming-guide.pdf',
            thumbnail:
                'https://storage.googleapis.com/bucket/media/programming-guide-thumbnail.jpg',
            medium: 'https://storage.googleapis.com/bucket/media/programming-guide-medium.jpg',
            original:
                'https://storage.googleapis.com/bucket/media/programming-guide.pdf',
            type: 'document',
            size: 2048576,
            mimeType: 'application/pdf',
        },
        required: false,
    })
    mediaFile?: {
        id: number;
        originalName?: string;
        url?: string;
        thumbnail?: string;
        medium?: string;
        original?: string;
        type?: string;
        size?: number;
        mimeType?: string;
        variants?: any[];
    };

    @ApiProperty({
        description:
            '🔗 External URL for materials not stored in media manager (e.g., YouTube videos, external documents)',
        example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        required: false,
    })
    externalUrl?: string;

    @ApiProperty({
        description: '🎯 Type of the material',
        enum: MaterialType,
        example: MaterialType.PDF,
    })
    type: MaterialType;

    @ApiProperty({
        description: '🔢 Display order of the material within the course',
        example: 1,
    })
    sortOrder: number;

    @ApiProperty({
        description:
            '✅ Whether the material is currently available to students',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: '🎓 ID of the course this material belongs to',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: '👤 ID of the user who created this material',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    createdBy: string;

    @ApiProperty({
        description: '👤 ID of the user who last updated this material',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    updatedBy?: string;

    @ApiProperty({
        description: '📅 Material creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: '📅 Material last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: '🎓 Course information',
        required: false,
    })
    course?: {
        courseId: number;
        title: string;
        description?: string;
        orgId: string;
        branchId?: string;
    };

    @ApiProperty({
        description: '👤 Creator information',
        required: false,
    })
    creator?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
}

export class CourseMaterialListDto {
    @ApiProperty({
        description: '📚 List of course materials',
        type: [CourseMaterialResponseDto],
    })
    materials: CourseMaterialResponseDto[];

    @ApiProperty({
        description: '🔢 Total number of materials',
        example: 15,
    })
    total: number;

    @ApiProperty({
        description: '🎓 Course context information',
        required: false,
    })
    course?: {
        courseId: number;
        title: string;
        description?: string;
    };

    @ApiProperty({
        description: '📊 Material statistics by type',
        required: false,
    })
    statistics?: {
        totalActive: number;
        totalInactive: number;
        byType: {
            [key in MaterialType]?: number;
        };
    };
}

export class CourseMaterialStatsDto {
    @ApiProperty({
        description: '🎓 Course unique identifier',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: '📚 Total number of materials in the course',
        example: 15,
    })
    totalMaterials: number;

    @ApiProperty({
        description: '✅ Number of active materials available to students',
        example: 12,
    })
    activeMaterials: number;

    @ApiProperty({
        description: '⏸️ Number of inactive/draft materials',
        example: 3,
    })
    inactiveMaterials: number;

    @ApiProperty({
        description: '📊 Material distribution by type',
        type: 'object',
        additionalProperties: {
            type: 'number',
        },
        example: {
            PDF: 5,
            VIDEO: 3,
            LINK: 4,
            DOCUMENT: 3,
        },
    })
    materialsByType: Record<string, number>;

    @ApiProperty({
        description: '📅 Most recent material addition timestamp',
        example: '2025-01-15T10:30:45.123Z',
        required: false,
    })
    lastMaterialAddedAt?: Date;

    @ApiProperty({
        description: '📅 Most recent material update timestamp',
        example: '2025-01-15T10:30:45.123Z',
        required: false,
    })
    lastMaterialUpdatedAt?: Date;
}

// Enhanced response types matching established patterns
export class StandardApiResponse<T = any> {
    @ApiProperty({
        description: '✅ Indicates if the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: '💬 Human-readable message about the operation result',
        example: 'Operation completed successfully',
    })
    message: string;

    @ApiProperty({
        description: '📦 Response data payload',
        required: false,
    })
    data?: T;

    @ApiProperty({
        description: '📊 Additional metadata about the response',
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
        description: '💬 Human-readable message about the operation result',
        example: 'Course material created successfully',
    })
    message: string;

    @ApiProperty({
        description: '🔖 Operation status indicator',
        example: 'success',
        enum: ['success', 'error', 'warning', 'info', 'debug'],
    })
    status: string;

    @ApiProperty({
        description: '🔢 HTTP status code',
        example: 200,
    })
    code: number;
}

// Specific response DTOs for different operations
export class CourseMaterialApiResponse extends StandardApiResponse<CourseMaterialResponseDto> {
    @ApiProperty({
        description: '📚 Course material data',
        type: CourseMaterialResponseDto,
    })
    data: CourseMaterialResponseDto;
}

export class CourseMaterialListApiResponse extends StandardApiResponse<CourseMaterialListDto> {
    @ApiProperty({
        description: '📚 List of course materials with metadata',
        type: CourseMaterialListDto,
    })
    data: CourseMaterialListDto;
}

export class CourseMaterialStatsResponse extends StandardApiResponse<CourseMaterialStatsDto> {
    @ApiProperty({
        description: '📊 Course material statistics',
        type: CourseMaterialStatsDto,
    })
    data: CourseMaterialStatsDto;
}

// Specific operation response DTOs for better documentation
export class CourseMaterialCreatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: '✅ Course material creation success message',
        example: 'Course material created successfully',
    })
    message: string;

    @ApiProperty({
        description: '🔖 Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: '🔢 HTTP status code',
        example: 201,
    })
    code: number;
}

export class CourseMaterialUpdatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: '✅ Course material update success message',
        example: 'Course material updated successfully',
    })
    message: string;

    @ApiProperty({
        description: '🔖 Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: '🔢 HTTP status code',
        example: 200,
    })
    code: number;
}

export class CourseMaterialDeletedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: '✅ Course material deletion success message',
        example: 'Course material deleted successfully',
    })
    message: string;

    @ApiProperty({
        description: '🔖 Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: '🔢 HTTP status code',
        example: 200,
    })
    code: number;
}

export class CourseMaterialCountResponse extends StandardApiResponse<{
    count: number;
    details: CourseMaterialStatsDto;
}> {
    @ApiProperty({
        description: '📊 Material count and detailed statistics',
    })
    data: {
        count: number;
        details: CourseMaterialStatsDto;
    };
}

export class CourseMaterialReorderResponse extends StandardOperationResponse {
    @ApiProperty({
        description: '✅ Material reorder success message',
        example: 'Course materials reordered successfully',
    })
    message: string;

    @ApiProperty({
        description: '🔖 Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: '🔢 HTTP status code',
        example: 200,
    })
    code: number;

    @ApiProperty({
        description: '📊 Reorder operation metadata',
        required: false,
    })
    meta?: {
        materialsUpdated: number;
        conflictsResolved: number;
        timestamp: string;
    };
}
