import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { MediaType, ImageVariant } from '../entities/media-manager.entity';

/**
 * Response DTO representing a complete media file with all associated metadata and processing information
 * Used in all API responses that return file data, including upload confirmations and file listings
 */
export class MediaFileResponseDto {
    @ApiProperty({
        description: 'Unique identifier for the media file in the database',
        example: 1,
        type: Number,
        title: 'File ID',
        minimum: 1,
    })
    id: number;

    @ApiProperty({
        description:
            'Original filename as uploaded by the user, preserved for reference and display purposes',
        example: 'course-introduction-image.jpg',
        type: String,
        title: 'Original Filename',
        maxLength: 255,
    })
    originalName: string;

    @ApiProperty({
        description:
            'Processed filename stored in Google Cloud Storage with organization, date, and UUID for uniqueness',
        example:
            'media/org-123/branch-456/2024/01/15/a1b2c3d4-e5f6-course-introduction-image.jpg',
        type: String,
        title: 'Stored Filename',
        maxLength: 500,
    })
    filename: string;

    @ApiProperty({
        description:
            'Full public URL for direct access to the file in Google Cloud Storage',
        example:
            'https://storage.googleapis.com/crmapplications/media/org-123/branch-456/2024/01/15/a1b2c3d4-e5f6-course-introduction-image.jpg',
        type: String,
        title: 'File URL',
        format: 'url',
    })
    url: string;

    @ApiProperty({
        description:
            'MIME type of the file for proper browser handling and content type detection',
        example: 'image/jpeg',
        type: String,
        title: 'MIME Type',
        pattern:
            '^[a-zA-Z0-9][a-zA-Z0-9!#$&\\-\\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\\-\\^_.]*$',
    })
    mimeType: string;

    @ApiProperty({
        description:
            'File size in bytes for storage tracking and download estimates',
        example: 2048576,
        type: Number,
        title: 'File Size (bytes)',
        minimum: 0,
        maximum: 52428800, // 50MB
    })
    size: number;

    @ApiProperty({
        description:
            'Categorized media type for organization and processing logic',
        enum: MediaType,
        example: MediaType.IMAGE,
        type: String,
        title: 'Media Type',
        enumName: 'MediaType',
    })
    type: MediaType;

    @ApiProperty({
        description:
            'Specific variant of the image for different display contexts and sizes',
        enum: ImageVariant,
        example: ImageVariant.ORIGINAL,
        required: false,
        type: String,
        title: 'Image Variant',
        enumName: 'ImageVariant',
    })
    variant?: ImageVariant;

    @ApiProperty({
        description:
            'Reference to the original file ID for image variants and thumbnails',
        example: 1,
        required: false,
        type: Number,
        title: 'Original File Reference',
        minimum: 1,
    })
    originalFileId?: number;

    @ApiProperty({
        description:
            'Image width in pixels for layout planning and responsive design',
        example: 1920,
        required: false,
        type: Number,
        title: 'Image Width (px)',
        minimum: 1,
        maximum: 10000,
    })
    width?: number;

    @ApiProperty({
        description:
            'Image height in pixels for layout planning and responsive design',
        example: 1080,
        required: false,
        type: Number,
        title: 'Image Height (px)',
        minimum: 1,
        maximum: 10000,
    })
    height?: number;

    @ApiProperty({
        description:
            'Indicates if the file is active and available for access (soft delete mechanism)',
        example: true,
        type: Boolean,
        title: 'Active Status',
        default: true,
    })
    isActive: boolean;

    @ApiProperty({
        description:
            'Alternative text for images to improve accessibility compliance and SEO',
        example:
            'Computer Science course introduction showing programming concepts and student collaboration',
        required: false,
        type: String,
        title: 'Alt Text',
        maxLength: 255,
    })
    altText?: string;

    @ApiProperty({
        description:
            'Detailed description or caption for the file, used in content management and search',
        example:
            'Introduction image for Computer Science fundamentals course showing key programming concepts',
        required: false,
        type: String,
        title: 'File Description',
        maxLength: 1000,
    })
    description?: string;

    @ApiProperty({
        description:
            'Additional metadata including EXIF data, processing information, and custom properties',
        example: {
            exif: { camera: 'Canon EOS R5', iso: 100 },
            processing: { quality: 85, format: 'jpeg' },
            custom: { tags: ['course', 'education'] },
        },
        required: false,
        type: Object,
        title: 'File Metadata',
    })
    metadata?: Record<string, any>;

    @ApiProperty({
        description:
            'UUID of the user who uploaded this file for ownership tracking and permissions',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        type: String,
        title: 'Uploader ID',
        format: 'uuid',
        minLength: 36,
        maxLength: 36,
    })
    uploadedBy: string;

    @ApiProperty({
        description:
            'Timestamp when the file was originally uploaded to the system',
        example: '2024-01-01T00:00:00.000Z',
        type: String,
        title: 'Upload Date',
        format: 'date-time',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Timestamp when the file metadata was last updated',
        example: '2024-01-15T10:30:45.123Z',
        type: String,
        title: 'Last Updated',
        format: 'date-time',
    })
    updatedAt: Date;

    @ApiProperty({
        description:
            'Complete user profile information of the person who uploaded this file',
        type: () => User,
        required: false,
        title: 'Uploader Details',
    })
    uploader?: User;

    @ApiProperty({
        description:
            'All available image variants (thumbnails, different sizes) generated from the original image',
        type: [MediaFileResponseDto],
        required: false,
        title: 'Image Variants',
        isArray: true,
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

/**
 * Response DTO for successful file upload containing the main file and any generated variants
 * Used as the primary response for single file upload operations
 */
export class UploadResponseDto {
    @ApiProperty({
        description:
            'The main uploaded file with complete metadata and processing information',
        type: MediaFileResponseDto,
        title: 'Uploaded File',
    })
    file: MediaFileResponseDto;

    @ApiProperty({
        description:
            'Automatically generated image variants including thumbnails, medium, and large sizes',
        type: [MediaFileResponseDto],
        required: false,
        title: 'Generated Variants',
        isArray: true,
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
