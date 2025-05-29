import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @ApiProperty({
        description: 'Updated email address for the user account',
        example: 'newemail@example.com',
        format: 'email',
        required: false,
        type: String,
        title: 'Email Address',
        maxLength: 255,
    })
    @IsOptional()
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email?: string;

    @ApiProperty({
        description: 'Updated full name of the user',
        example: 'Jane Smith',
        required: false,
        type: String,
        title: 'Full Name',
        minLength: 2,
        maxLength: 100,
    })
    @IsOptional()
    @IsString({ message: 'Name must be a string' })
    @MinLength(2, { message: 'Name must be at least 2 characters long' })
    name?: string;

    @ApiProperty({
        description: 'Updated first name of the user',
        example: 'Jane',
        required: false,
        type: String,
        title: 'First Name',
        maxLength: 50,
    })
    @IsOptional()
    @IsString({ message: 'First name must be a string' })
    firstName?: string;

    @ApiProperty({
        description: 'Updated last name of the user',
        example: 'Smith',
        required: false,
        type: String,
        title: 'Last Name',
        maxLength: 50,
    })
    @IsOptional()
    @IsString({ message: 'Last name must be a string' })
    lastName?: string;

    @ApiProperty({
        description: 'Updated avatar image URL for the user profile',
        example: 'https://cdn.example.com/profiles/jane-smith-avatar.jpg',
        required: false,
        type: String,
        title: 'Avatar URL',
        format: 'url',
    })
    @IsOptional()
    @IsString({ message: 'Avatar must be a valid URL string' })
    avatar?: string;
}
