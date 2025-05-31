import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for password reset completion
 * Used to reset user password with secure token validation
 */
export class ResetPasswordDto {
    @ApiProperty({
        description: 'Password reset token received via email',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJ0eXBlIjoicGFzc3dvcmRfcmVzZXQiLCJpYXQiOjE3MDUzMTcwMDAsImV4cCI6MTcwNTQwMzQwMH0.token-signature',
        type: String,
        title: 'Reset Token',
        minLength: 10,
    })
    @IsString({ message: 'Reset token is required' })
    @MinLength(10, { message: 'Invalid reset token format' })
    token: string;

    @ApiProperty({
        description:
            'New secure password. Must contain uppercase, lowercase, number, and special character',
        example: 'NewSecurePass123!',
        type: String,
        title: 'New Password',
        format: 'password',
        minLength: 8,
        pattern:
            '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?])',
    })
    @IsString({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        {
            message:
                'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        },
    )
    password: string;

    @ApiProperty({
        description:
            'Confirmation of the new password (must match password field)',
        example: 'NewSecurePass123!',
        type: String,
        title: 'Confirm Password',
        format: 'password',
        minLength: 8,
    })
    @IsString({ message: 'Password confirmation is required' })
    @MinLength(8, {
        message: 'Password confirmation must be at least 8 characters long',
    })
    confirmPassword: string;
}
