import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsBoolean,
    IsEnum,
    IsArray,
    ValidateIf,
    MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
    MediaType,
    ImageVariant,
    FileDesignation,
} from '../entities/media-manager.entity';

// Re-export edit DTOs for convenience
export { EditMediaDto, EditMediaResponseDto } from './edit-media.dto';

/**
 * Data Transfer Object for single file upload with comprehensive metadata and processing options
 * Used for uploading files to Google Cloud Storage with automatic processing and variant generation
 */
export class UploadFileDto {
    @ApiProperty({
        description:
            'Alternative text description for images to improve accessibility and SEO compliance. This text is used by screen readers and when images fail to load.',
        example:
            'Computer Science course introduction illustration showing students learning programming concepts',
        required: false,
        type: String,
        title: 'Alt Text',
        maxLength: 255,
        minLength: 3,
    })
    @IsOptional()
    @IsString({ message: 'Alt text must be a valid string' })
    @MaxLength(255, { message: 'Alt text must not exceed 255 characters' })
    altText?: string;

    @ApiProperty({
        description:
            'Detailed description or caption for the uploaded file. Used for content management, search, and file organization purposes.',
        example:
            'Introduction image for Computer Science fundamentals course showing key programming concepts and methodologies',
        required: false,
        type: String,
        title: 'File Description',
        maxLength: 1000,
        minLength: 5,
    })
    @IsOptional()
    @IsString({ message: 'Description must be a valid string' })
    @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
    description?: string;

    @ApiProperty({
        description:
            'Media type classification for automatic processing and organization. If not specified, type will be auto-detected from file MIME type.',
        enum: MediaType,
        example: MediaType.IMAGE,
        required: false,
        type: String,
        title: 'Media Type',
        enumName: 'MediaType',
    })
    @IsOptional()
    @IsEnum(MediaType, {
        message:
            'Invalid media type. Must be one of: image, document, video, audio, other',
    })
    type?: MediaType;

    @ApiProperty({
        description:
            'Enable automatic thumbnail and variant generation for images. When enabled, creates optimized versions suitable for different display contexts.',
        example: true,
        required: false,
        default: true,
        type: Boolean,
        title: 'Generate Thumbnails',
    })
    @IsOptional()
    @IsBoolean({ message: 'Generate thumbnails must be a boolean value' })
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    })
    generateThumbnails?: boolean = true;

    @ApiProperty({
        description:
            'Specific image variants to generate. Each variant is optimized for different use cases: thumbnail (150x150) for lists, medium (500x500) for content, large (1200x1200) for detailed viewing.',
        enum: ImageVariant,
        isArray: true,
        example: [ImageVariant.THUMBNAIL, ImageVariant.MEDIUM],
        required: false,
        type: [String],
        title: 'Image Variants',
        enumName: 'ImageVariant',
    })
    @IsOptional()
    @IsArray({ message: 'Variants must be an array' })
    @IsEnum(ImageVariant, {
        each: true,
        message:
            'Invalid image variant. Must be one of: original, thumbnail, medium, large',
    })
    @ValidateIf((obj: UploadFileDto) => obj.type === MediaType.IMAGE)
    variants?: ImageVariant[];

    @ApiProperty({
        description:
            'File designation - what this file will be used for. This helps organize files and makes them easier to find and manage.',
        enum: FileDesignation,
        example: FileDesignation.GENERAL_UPLOAD,
        required: false,
        default: FileDesignation.GENERAL_UPLOAD,
        type: String,
        title: 'File Designation',
        enumName: 'FileDesignation',
    })
    @IsOptional()
    @IsEnum(FileDesignation, {
        message:
            'Invalid file designation. Must be one of: user_avatar, course_thumbnail, course_material, question_image, answer_attachment, organization_logo, test_attachment, general_upload, other',
    })
    designation?: FileDesignation = FileDesignation.GENERAL_UPLOAD;
}

/**
 * Data Transfer Object for bulk file upload with shared metadata across multiple files
 * Used for uploading multiple files simultaneously with common processing options
 */
export class BulkUploadDto {
    @ApiProperty({
        description:
            'Common alternative text applied to all uploaded images in the batch. Improves accessibility and provides consistent metadata across related files.',
        example:
            'Course materials and resources for Computer Science fundamentals',
        required: false,
        type: String,
        title: 'Common Alt Text',
        maxLength: 255,
        minLength: 3,
    })
    @IsOptional()
    @IsString({ message: 'Common alt text must be a valid string' })
    @MaxLength(255, {
        message: 'Common alt text must not exceed 255 characters',
    })
    commonAltText?: string;

    @ApiProperty({
        description:
            'Common description applied to all uploaded files in the batch. Used for organizing and categorizing related file uploads.',
        example:
            'Comprehensive course resource materials including presentations, diagrams, and reference documents for Computer Science fundamentals',
        required: false,
        type: String,
        title: 'Common Description',
        maxLength: 1000,
        minLength: 5,
    })
    @IsOptional()
    @IsString({ message: 'Common description must be a valid string' })
    @MaxLength(1000, {
        message: 'Common description must not exceed 1000 characters',
    })
    commonDescription?: string;

    @ApiProperty({
        description:
            'Enable automatic thumbnail and variant generation for all image uploads in the batch. Applies consistent processing across all files.',
        example: true,
        required: false,
        default: true,
        type: Boolean,
        title: 'Generate Thumbnails',
    })
    @IsOptional()
    @IsBoolean({ message: 'Generate thumbnails must be a boolean value' })
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    })
    generateThumbnails?: boolean = true;

    @ApiProperty({
        description:
            'Common file designation applied to all uploaded files in the batch. This helps organize and categorize related file uploads.',
        enum: FileDesignation,
        example: FileDesignation.COURSE_MATERIAL,
        required: false,
        default: FileDesignation.GENERAL_UPLOAD,
        type: String,
        title: 'Common File Designation',
        enumName: 'FileDesignation',
    })
    @IsOptional()
    @IsEnum(FileDesignation, {
        message:
            'Invalid file designation. Must be one of: user_avatar, course_thumbnail, course_material, question_image, answer_attachment, organization_logo, test_attachment, general_upload, other',
    })
    commonDesignation?: FileDesignation = FileDesignation.GENERAL_UPLOAD;
}

/**
 * Data Transfer Object for filtering and searching media files with comprehensive query options
 * Used for advanced file discovery, pagination, and organization-based file management
 */
export class FileFilterDto {
    @ApiProperty({
        description:
            'Filter files by media type classification. Useful for browsing specific content types like images for galleries or documents for resources.',
        enum: MediaType,
        example: MediaType.IMAGE,
        required: false,
        type: String,
        title: 'Media Type Filter',
        enumName: 'MediaType',
    })
    @IsOptional()
    @IsEnum(MediaType, {
        message:
            'Invalid media type filter. Must be one of: image, document, video, audio, other',
    })
    type?: MediaType;

    @ApiProperty({
        description:
            'Filter images by specific variant size. Useful for finding thumbnails for lists or original images for detailed viewing.',
        enum: ImageVariant,
        example: ImageVariant.THUMBNAIL,
        required: false,
        type: String,
        title: 'Image Variant Filter',
        enumName: 'ImageVariant',
    })
    @IsOptional()
    @IsEnum(ImageVariant, {
        message:
            'Invalid image variant filter. Must be one of: original, thumbnail, medium, large',
    })
    variant?: ImageVariant;

    @ApiProperty({
        description:
            'Filter files by the specific user who uploaded them. Use for personal file management or administrative oversight.',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
        type: String,
        title: 'Uploader User ID',
        format: 'uuid',
        minLength: 36,
        maxLength: 36,
    })
    @IsOptional()
    @IsString({ message: 'Uploader ID must be a valid string' })
    uploadedBy?: string;

    @ApiProperty({
        description:
            'Search within stored filenames in Google Cloud Storage. Useful for finding files by their processed names.',
        example: 'course-image-2025',
        required: false,
        type: String,
        title: 'Filename Search',
        minLength: 2,
        maxLength: 100,
    })
    @IsOptional()
    @IsString({ message: 'Filename search must be a valid string' })
    filename?: string;

    @ApiProperty({
        description:
            'Search within original uploaded filenames. Useful for finding files by their original names before processing.',
        example: 'presentation-final',
        required: false,
        type: String,
        title: 'Original Name Search',
        minLength: 2,
        maxLength: 100,
    })
    @IsOptional()
    @IsString({ message: 'Original name search must be a valid string' })
    originalName?: string;

    @ApiProperty({
        description:
            'Page number for pagination starting from 1. Use with limit to navigate through large file collections efficiently.',
        example: 1,
        required: false,
        default: 1,
        type: Number,
        title: 'Page Number',
        minimum: 1,
        maximum: 1000,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value) || 1)
    page?: number = 1;

    @ApiProperty({
        description:
            'Number of files to return per page. Maximum 100 files per request to ensure optimal performance.',
        example: 20,
        required: false,
        default: 20,
        type: Number,
        title: 'Results Per Page',
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => Math.min(parseInt(value) || 20, 100))
    limit?: number = 20;

    @ApiProperty({
        description:
            'Field to sort results by. Choose based on your use case: createdAt for recent files, originalName for alphabetical, size for file management.',
        example: 'createdAt',
        required: false,
        enum: ['createdAt', 'originalName', 'size', 'type'],
        default: 'createdAt',
        type: String,
        title: 'Sort Field',
    })
    @IsOptional()
    @IsString({ message: 'Sort field must be a valid string' })
    sortBy?: string = 'createdAt';

    @ApiProperty({
        description:
            'Sort order direction. Use DESC for newest/largest first, ASC for oldest/smallest first.',
        example: 'DESC',
        required: false,
        enum: ['ASC', 'DESC'],
        default: 'DESC',
        type: String,
        title: 'Sort Order',
    })
    @IsOptional()
    @IsString({ message: 'Sort order must be a valid string' })
    sortOrder?: 'ASC' | 'DESC' = 'DESC';

    @ApiProperty({
        description:
            'Filter files by their designation (what they are used for). Useful for finding specific types of files like avatars, course materials, etc.',
        enum: FileDesignation,
        example: FileDesignation.COURSE_MATERIAL,
        required: false,
        type: String,
        title: 'File Designation Filter',
        enumName: 'FileDesignation',
    })
    @IsOptional()
    @IsEnum(FileDesignation, {
        message:
            'Invalid file designation filter. Must be one of: user_avatar, course_thumbnail, course_material, question_image, answer_attachment, organization_logo, test_attachment, general_upload, other',
    })
    designation?: FileDesignation;
}
