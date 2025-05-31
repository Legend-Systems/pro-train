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
import { MediaType, ImageVariant } from '../entities/media-manager.entity';

export class UploadFileDto {
    @ApiProperty({
        description: 'Alternative text for images (accessibility)',
        example: 'Course introduction illustration',
        required: false,
        maxLength: 255,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255, { message: 'Alt text must not exceed 255 characters' })
    altText?: string;

    @ApiProperty({
        description: 'File description or caption',
        example: 'Introduction image for Computer Science course',
        required: false,
        maxLength: 1000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
    description?: string;

    @ApiProperty({
        description: 'Media type classification',
        enum: MediaType,
        example: MediaType.IMAGE,
        required: false,
    })
    @IsOptional()
    @IsEnum(MediaType, { message: 'Invalid media type' })
    type?: MediaType;

    @ApiProperty({
        description: 'Whether to generate thumbnails for images',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    })
    generateThumbnails?: boolean = true;

    @ApiProperty({
        description: 'Image variants to generate (for images only)',
        enum: ImageVariant,
        isArray: true,
        example: [ImageVariant.THUMBNAIL, ImageVariant.MEDIUM],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @IsEnum(ImageVariant, { each: true, message: 'Invalid image variant' })
    @ValidateIf(obj => obj.type === MediaType.IMAGE)
    variants?: ImageVariant[];
}

export class BulkUploadDto {
    @ApiProperty({
        description: 'Common alt text for all uploaded images',
        example: 'Course materials',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    commonAltText?: string;

    @ApiProperty({
        description: 'Common description for all uploaded files',
        example: 'Course resource materials',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    commonDescription?: string;

    @ApiProperty({
        description: 'Whether to generate thumbnails for image uploads',
        example: true,
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    })
    generateThumbnails?: boolean = true;
}

export class FileFilterDto {
    @ApiProperty({
        description: 'Filter by media type',
        enum: MediaType,
        required: false,
    })
    @IsOptional()
    @IsEnum(MediaType)
    type?: MediaType;

    @ApiProperty({
        description: 'Filter by image variant',
        enum: ImageVariant,
        required: false,
    })
    @IsOptional()
    @IsEnum(ImageVariant)
    variant?: ImageVariant;

    @ApiProperty({
        description: 'Filter by uploader user ID',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    @IsOptional()
    @IsString()
    uploadedBy?: string;

    @ApiProperty({
        description: 'Search in filename',
        example: 'course-image',
        required: false,
    })
    @IsOptional()
    @IsString()
    filename?: string;

    @ApiProperty({
        description: 'Search in original filename',
        example: 'presentation',
        required: false,
    })
    @IsOptional()
    @IsString()
    originalName?: string;

    @ApiProperty({
        description: 'Page number for pagination',
        example: 1,
        required: false,
        default: 1,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value) || 1)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of files per page',
        example: 20,
        required: false,
        default: 20,
    })
    @IsOptional()
    @Transform(({ value }) => Math.min(parseInt(value) || 20, 100))
    limit?: number = 20;

    @ApiProperty({
        description: 'Sort field',
        example: 'createdAt',
        required: false,
        enum: ['createdAt', 'originalName', 'size', 'type'],
        default: 'createdAt',
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiProperty({
        description: 'Sort order',
        example: 'DESC',
        required: false,
        enum: ['ASC', 'DESC'],
        default: 'DESC',
    })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
