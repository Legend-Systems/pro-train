import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEnum,
    MaxLength,
    MinLength,
} from 'class-validator';
import { FileDesignation } from '../entities/media-manager.entity';

/**
 * Data Transfer Object for editing existing media file metadata
 * Allows updating file information without changing the actual file or its variants
 */
export class EditMediaDto {
    @ApiProperty({
        description:
            'Updated alternative text for images to improve accessibility and SEO compliance',
        example:
            'Updated Computer Science course introduction showing advanced programming concepts',
        required: false,
        type: String,
        title: 'Alt Text',
        maxLength: 255,
        minLength: 3,
    })
    @IsOptional()
    @IsString({ message: 'Alt text must be a valid string' })
    @MaxLength(255, { message: 'Alt text must not exceed 255 characters' })
    @MinLength(3, { message: 'Alt text must be at least 3 characters long' })
    altText?: string;

    @ApiProperty({
        description:
            'Updated detailed description for the media file. Used for content management, search, and organization.',
        example:
            'Comprehensive updated introduction image for Computer Science fundamentals course covering advanced programming concepts and best practices',
        required: false,
        type: String,
        title: 'File Description',
        maxLength: 1000,
        minLength: 5,
    })
    @IsOptional()
    @IsString({ message: 'Description must be a valid string' })
    @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
    @MinLength(5, { message: 'Description must be at least 5 characters long' })
    description?: string;

    @ApiProperty({
        description:
            'Updated file designation indicating what this file is used for. Helps with organization and file management.',
        enum: FileDesignation,
        example: FileDesignation.COURSE_MATERIAL,
        required: false,
        type: String,
        title: 'File Designation',
        enumName: 'FileDesignation',
    })
    @IsOptional()
    @IsEnum(FileDesignation, {
        message:
            'Invalid file designation. Must be one of: user_avatar, course_thumbnail, course_material, question_image, answer_attachment, organization_logo, test_attachment, general_upload, other',
    })
    designation?: FileDesignation;

    @ApiProperty({
        description:
            'Updated custom metadata for the file. Can include tags, custom properties, or processing information.',
        example: {
            tags: ['programming', 'education', 'updated'],
            category: 'course-materials',
            version: '2.0',
        },
        required: false,
        type: Object,
        title: 'Custom Metadata',
    })
    @IsOptional()
    metadata?: Record<string, any>;
}

/**
 * Response DTO for successful media edit operations
 */
export class EditMediaResponseDto {
    @ApiProperty({
        description: 'Success message indicating the edit was completed',
        example: 'Media file updated successfully',
        type: String,
    })
    message: string;

    @ApiProperty({
        description: 'Operation status indicator',
        example: 'success',
        enum: ['success', 'error', 'warning'],
        type: String,
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code for the operation',
        example: 200,
        type: Number,
    })
    code: number;

    @ApiProperty({
        description: 'Updated media file data with all current metadata',
        type: Object,
        required: false,
    })
    data?: any;
}