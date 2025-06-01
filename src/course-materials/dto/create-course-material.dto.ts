import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsUrl,
    IsNumber,
    IsBoolean,
    Min,
    MaxLength,
    ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MaterialType } from '../entities/course-material.entity';

export class CreateCourseMaterialDto {
    @ApiProperty({
        description: 'Material title',
        example: 'Introduction to Programming Concepts',
        maxLength: 255,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
    title: string;

    @ApiProperty({
        description: 'Material description',
        example:
            'A comprehensive guide covering basic programming concepts and fundamentals',
        required: false,
        maxLength: 2000,
    })
    @IsString()
    @IsOptional()
    @MaxLength(2000, { message: 'Description cannot exceed 2000 characters' })
    description?: string;

    @ApiProperty({
        description:
            'Media file ID from media library for uploaded course materials (documents, videos, images, etc.)',
        example: 1,
        required: false,
        type: Number,
        title: 'Media File ID',
    })
    @IsOptional()
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'Media file ID must be a valid number' },
    )
    @ValidateIf(o => !('externalUrl' in o))
    mediaFileId?: number;

    @ApiProperty({
        description:
            'External URL for materials not stored in media manager (e.g., YouTube videos, external documents, web links)',
        example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        required: false,
    })
    @IsString()
    @IsOptional()
    @IsUrl({}, { message: 'Please provide a valid URL' })
    @ValidateIf(o => !('mediaFileId' in o))
    externalUrl?: string;

    @ApiProperty({
        description: 'Type of the material',
        enum: MaterialType,
        example: MaterialType.PDF,
        default: MaterialType.DOCUMENT,
    })
    @IsEnum(MaterialType, {
        message:
            'Type must be one of: pdf, video, audio, document, link, image, presentation, spreadsheet, other',
    })
    @IsOptional()
    type?: MaterialType = MaterialType.DOCUMENT;

    @ApiProperty({
        description: 'Display order of the material within the course',
        example: 1,
        minimum: 0,
        default: 0,
    })
    @IsNumber({}, { message: 'Sort order must be a number' })
    @Min(0, { message: 'Sort order must be 0 or greater' })
    @Transform(({ value }) => parseInt(value, 10))
    @IsOptional()
    sortOrder?: number = 0;

    @ApiProperty({
        description: 'Whether the material is currently available to students',
        example: true,
        default: true,
    })
    @IsBoolean()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    })
    @IsOptional()
    isActive?: boolean = true;

    @ApiProperty({
        description: 'ID of the course this material belongs to',
        example: 1,
    })
    @IsNumber({}, { message: 'Course ID must be a number' })
    @IsNotEmpty()
    @Transform(({ value }) => parseInt(value, 10))
    courseId: number;

    @ApiProperty({
        description: 'ID of the user creating this material',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @IsString()
    @IsNotEmpty()
    createdBy: string;
}
