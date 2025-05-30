import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';
import { CreateCourseDto } from './create-course.dto';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {
    @ApiProperty({
        description: 'Updated course title',
        example: 'Advanced Computer Science Concepts',
        required: false,
        type: String,
        title: 'Course Title',
        minLength: 3,
        maxLength: 200,
    })
    @IsOptional()
    @IsString({ message: 'Course title must be a string' })
    @MinLength(3, {
        message: 'Course title must be at least 3 characters long',
    })
    title?: string;

    @ApiProperty({
        description: 'Updated course description',
        example:
            'An advanced course covering complex computer science topics including advanced algorithms, system design, and software architecture patterns.',
        required: false,
        type: String,
        title: 'Course Description',
        maxLength: 5000,
    })
    @IsOptional()
    @IsString({ message: 'Course description must be a string' })
    description?: string;
}
