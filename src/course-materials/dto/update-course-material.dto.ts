import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseMaterialDto } from './create-course-material.dto';
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

export class UpdateCourseMaterialDto extends PartialType(
    CreateCourseMaterialDto,
) {
    @ApiProperty({
        description: 'Updated material title',
        example: 'Advanced Programming Concepts',
        maxLength: 255,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
    title?: string;

    @ApiProperty({
        description: 'Updated material description',
        example:
            'An advanced guide covering complex programming concepts and best practices',
        required: false,
        maxLength: 2000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(2000, { message: 'Description cannot exceed 2000 characters' })
    description?: string;

    @ApiProperty({
        description:
            'Updated media file ID from media library for uploaded course materials',
        example: 2,
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
            'Updated external URL for materials not stored in media manager',
        example: 'https://www.youtube.com/watch?v=updated-video-id',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsUrl({}, { message: 'Please provide a valid URL' })
    @ValidateIf(o => !('mediaFileId' in o))
    externalUrl?: string;

    @ApiProperty({
        description: 'Updated type of the material',
        enum: MaterialType,
        example: MaterialType.VIDEO,
        required: false,
    })
    @IsOptional()
    @IsEnum(MaterialType, {
        message:
            'Type must be one of: pdf, video, audio, document, link, image, presentation, spreadsheet, other',
    })
    type?: MaterialType;

    @ApiProperty({
        description: 'Updated display order of the material within the course',
        example: 2,
        minimum: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Sort order must be a number' })
    @Min(0, { message: 'Sort order must be 0 or greater' })
    @Transform(({ value }) => parseInt(value, 10))
    sortOrder?: number;

    @ApiProperty({
        description: 'Updated availability status of the material for students',
        example: false,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    })
    isActive?: boolean;

    @ApiProperty({
        description: 'ID of the user updating this material',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    updatedBy?: string;
}
