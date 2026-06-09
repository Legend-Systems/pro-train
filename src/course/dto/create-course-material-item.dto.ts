import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    Min,
    MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MaterialType } from '../../course-materials/entities/course-material.entity';

export class CreateCourseMaterialItemDto {
    @ApiProperty({
        description: 'Media file ID from media library',
        example: 94,
    })
    @IsNumber({}, { message: 'Media file ID must be a valid number' })
    @Transform(({ value }) => parseInt(value, 10))
    mediaFileId: number;

    @ApiProperty({
        description: 'Material title (defaults to a generated name if omitted)',
        required: false,
        maxLength: 255,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
    title?: string;

    @ApiProperty({
        description: 'Material description',
        required: false,
        maxLength: 2000,
    })
    @IsOptional()
    @IsString()
    @MaxLength(2000, { message: 'Description cannot exceed 2000 characters' })
    description?: string;

    @ApiProperty({
        description: 'Display order within the course',
        required: false,
        minimum: 0,
        default: 0,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Sort order must be a number' })
    @Min(0, { message: 'Sort order must be 0 or greater' })
    @Transform(({ value }) => parseInt(value, 10))
    sortOrder?: number;

    @ApiProperty({
        description: 'Type of the material',
        enum: MaterialType,
        required: false,
        default: MaterialType.DOCUMENT,
    })
    @IsOptional()
    @IsEnum(MaterialType, {
        message:
            'Type must be one of: pdf, video, audio, document, link, image, presentation, spreadsheet, other',
    })
    type?: MaterialType;
}
