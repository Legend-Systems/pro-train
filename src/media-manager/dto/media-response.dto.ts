import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { MediaType, ImageVariant } from '../entities/media-manager.entity';

export class MediaFileResponseDto {
    @ApiProperty({
        description: 'Media file unique identifier',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'Original filename as uploaded',
        example: 'course-image.jpg',
    })
    originalName: string;

    @ApiProperty({
        description: 'Stored filename in GCS',
        example: 'media/2024/01/15/uuid-course-image.jpg',
    })
    filename: string;

    @ApiProperty({
        description: 'Full GCS URL for the file',
        example:
            'https://storage.googleapis.com/bucket-name/media/2024/01/15/uuid-course-image.jpg',
    })
    url: string;

    @ApiProperty({
        description: 'MIME type of the file',
        example: 'image/jpeg',
    })
    mimeType: string;

    @ApiProperty({
        description: 'File size in bytes',
        example: 2048576,
    })
    size: number;

    @ApiProperty({
        description: 'Type of media file',
        enum: MediaType,
        example: MediaType.IMAGE,
    })
    type: MediaType;

    @ApiProperty({
        description: 'Image variant (for images only)',
        enum: ImageVariant,
        example: ImageVariant.ORIGINAL,
        required: false,
    })
    variant?: ImageVariant;

    @ApiProperty({
        description: 'Reference to original file (for thumbnails/variants)',
        example: 1,
        required: false,
    })
    originalFileId?: number;

    @ApiProperty({
        description: 'Image width in pixels (for images)',
        example: 1920,
        required: false,
    })
    width?: number;

    @ApiProperty({
        description: 'Image height in pixels (for images)',
        example: 1080,
        required: false,
    })
    height?: number;

    @ApiProperty({
        description: 'Whether the file is active/available',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'Alt text for images (accessibility)',
        example: 'Course introduction illustration',
        required: false,
    })
    altText?: string;

    @ApiProperty({
        description: 'File description or caption',
        example: 'Introduction image for Computer Science course',
        required: false,
    })
    description?: string;

    @ApiProperty({
        description: 'Additional metadata for the file',
        example: { exif: {}, processing: {} },
        required: false,
    })
    metadata?: Record<string, any>;

    @ApiProperty({
        description: 'ID of the user who uploaded this file',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    uploadedBy: string;

    @ApiProperty({
        description: 'File upload timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'File last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'User who uploaded the file',
        type: () => User,
        required: false,
    })
    uploader?: User;

    @ApiProperty({
        description: 'Available variants for this image',
        type: [MediaFileResponseDto],
        required: false,
    })
    variants?: MediaFileResponseDto[];
}

export class MediaFileListResponseDto {
    @ApiProperty({
        description: 'List of media files',
        type: [MediaFileResponseDto],
    })
    files: MediaFileResponseDto[];

    @ApiProperty({
        description: 'Total number of files',
        example: 100,
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: 'Number of files per page',
        example: 20,
    })
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 5,
    })
    totalPages: number;
}

export class UploadResponseDto {
    @ApiProperty({
        description: 'Main uploaded file',
        type: MediaFileResponseDto,
    })
    file: MediaFileResponseDto;

    @ApiProperty({
        description: 'Generated variants (thumbnails, etc.)',
        type: [MediaFileResponseDto],
        required: false,
    })
    variants?: MediaFileResponseDto[];
}

export class BulkUploadResponseDto {
    @ApiProperty({
        description: 'Successfully uploaded files',
        type: [UploadResponseDto],
    })
    uploaded: UploadResponseDto[];

    @ApiProperty({
        description: 'Failed uploads with error messages',
        example: [
            {
                filename: 'invalid-file.txt',
                error: 'Unsupported file type',
            },
        ],
    })
    errors: Array<{
        filename: string;
        error: string;
    }>;

    @ApiProperty({
        description: 'Total number of files processed',
        example: 5,
    })
    total: number;

    @ApiProperty({
        description: 'Number of successful uploads',
        example: 4,
    })
    successful: number;

    @ApiProperty({
        description: 'Number of failed uploads',
        example: 1,
    })
    failed: number;
}

export class MediaStatsDto {
    @ApiProperty({
        description: 'Total number of files',
        example: 150,
    })
    totalFiles: number;

    @ApiProperty({
        description: 'Total storage used in bytes',
        example: 52428800,
    })
    totalSize: number;

    @ApiProperty({
        description: 'Number of files by type',
        example: {
            image: 120,
            document: 25,
            video: 3,
            audio: 1,
            other: 1,
        },
    })
    byType: Record<MediaType, number>;

    @ApiProperty({
        description: 'Average file size in bytes',
        example: 349525,
    })
    averageSize: number;

    @ApiProperty({
        description: 'Most recent upload timestamp',
        example: '2024-01-15T10:30:45.123Z',
        required: false,
    })
    lastUpload?: Date;
}
