import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
    @ApiProperty({
        description:
            'Registered email address or username for user authentication',
        example: 'john.doe@example.com',
        type: String,
        title: 'Email or Username',
        maxLength: 255,
    })
    // Field name remains `email` for API compatibility; value may be email OR username.
    @IsString({ message: 'Email or username is required' })
    @MinLength(1, { message: 'Email or username is required' })
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
