import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
    @ApiProperty({
        description: 'Registered email address for user authentication',
        example: 'john.doe@example.com',
        format: 'email',
        type: String,
        title: 'Email Address',
        maxLength: 255,
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @ApiProperty({
        description: 'User password for authentication (minimum 8 characters)',
        example: 'SecurePass123!',
        type: String,
        title: 'Password',
        format: 'password',
        minLength: 8,
    })
    @IsString({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;
}
