import {
    IsEmail,
    IsNumber,
    IsOptional,
    IsString,
    MinLength,
    IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @ApiProperty({
        description: 'Updated email address for the user account',
        example: 'brandon.updated@orrbit.co.za',
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
        description: 'Updated first name of the user',
        example: 'Brandon',
        required: false,
        type: String,
        title: 'First Name',
        maxLength: 50,
        minLength: 2,
    })
    @IsOptional()
    @IsString({ message: 'First name must be a string' })
    @MinLength(2, { message: 'First name must be at least 2 characters long' })
    firstName?: string;

    @ApiProperty({
        description: 'Updated last name of the user',
        example: 'Nhlanhla',
        required: false,
        type: String,
        title: 'Last Name',
        maxLength: 50,
        minLength: 2,
    })
    @IsOptional()
    @IsString({ message: 'Last name must be a string' })
    @MinLength(2, { message: 'Last name must be at least 2 characters long' })
    lastName?: string;

    @ApiProperty({
        description:
            'Updated avatar image ID reference from media library for the user profile',
        example: 2,
        required: false,
        type: Number,
        title: 'Avatar Media ID',
    })
    @IsOptional()
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'Avatar must be a valid media file ID' },
    )
    avatar?: number;

    @ApiProperty({
        description:
            'Updated user role in the system for permission and access control',
        example: UserRole.ADMIN,
        enum: UserRole,
        required: false,
        type: String,
        title: 'User Role',
    })
    @IsOptional()
    @IsEnum(UserRole, { message: 'Role must be a valid user role' })
    role?: UserRole;
}
