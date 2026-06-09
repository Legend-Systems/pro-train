import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    MinLength,
    IsArray,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCourseMaterialItemDto } from './create-course-material-item.dto';

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
