import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsString,
    IsDateString,
    IsNumber,
    Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CourseFilterDto {
    @ApiProperty({
        description: 'Filter courses by title (partial match)',
        example: 'Computer Science',
        required: false,
    })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({
        description: 'Filter courses by creator user ID',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    @IsOptional()
    @IsString()
    createdBy?: string;

    @ApiProperty({
        description: 'Filter courses created after this date',
        example: '2025-01-01',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    createdAfter?: string;

    @ApiProperty({
        description: 'Filter courses created before this date',
        example: '2025-12-31',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    createdBefore?: string;

    @ApiProperty({
        description: 'Page number for pagination',
        example: 1,
        required: false,
        minimum: 1,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of courses per page',
        example: 10,
        required: false,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    @ApiProperty({
        description: 'Sort field',
        example: 'createdAt',
        required: false,
        enum: ['title', 'createdAt', 'updatedAt'],
    })
    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @ApiProperty({
        description: 'Sort order',
        example: 'DESC',
        required: false,
        enum: ['ASC', 'DESC'],
    })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
