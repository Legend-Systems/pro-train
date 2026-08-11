import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    MinLength,
    IsArray,
    ValidateNested,
    ValidateIf,
    IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCourseMaterialItemDto } from './create-course-material-item.dto';
import { CourseStatus } from '../entities/course.entity';

export class CreateCourseDto {
    @ApiProperty({
        description: 'Course title - clear and descriptive name for the course',
        example: 'Introduction to Computer Science',
        type: String,
        title: 'Course Title',
        minLength: 3,
        maxLength: 200,
    })
    @IsString({ message: 'Course title must be a string' })
    @IsNotEmpty({ message: 'Course title is required' })
    @MinLength(3, {
        message: 'Course title must be at least 3 characters long',
    })
    title: string;

    @ApiProperty({
        description:
            'Detailed description of the course content, objectives, and prerequisites',
        example:
            'A comprehensive introduction to computer science fundamentals including programming, algorithms, data structures, and problem-solving techniques. Suitable for beginners with no prior programming experience.',
        required: false,
        type: String,
        title: 'Course Description',
        maxLength: 5000,
    })
    @IsOptional()
    @IsString({ message: 'Course description must be a string' })
    description?: string;

    /** Optional GCS public URL saved when a course thumbnail is uploaded. */
    @ApiProperty({
        description: 'Public URL of the course thumbnail image',
        required: false,
        example: 'https://storage.googleapis.com/bucket/media/course-thumb.jpg',
    })
    @IsOptional()
    @ValidateIf((_, value) => value !== null)
    @IsString({ message: 'Course thumbnail must be a URL string' })
    courseThumbnail?: string | null;

    /**
     * Optional status set from the create-course Active toggle.
     * Defaults to `active` when omitted (entity column default).
     */
    @ApiProperty({
        description:
            'Course operational status. Use active/inactive from the admin create form toggle.',
        enum: CourseStatus,
        required: false,
        example: CourseStatus.ACTIVE,
        default: CourseStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(CourseStatus, { message: 'Course status must be a valid status value' })
    status?: CourseStatus;

    @ApiProperty({
        description:
            'Optional course materials to attach when the course is created',
        type: [CreateCourseMaterialItemDto],
        required: false,
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateCourseMaterialItemDto)
    materials?: CreateCourseMaterialItemDto[];
}
