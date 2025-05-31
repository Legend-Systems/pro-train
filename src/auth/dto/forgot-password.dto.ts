import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for password reset request
 * Used to initiate password reset flow by sending reset instructions via email
 */
export class ForgotPasswordDto {
    @ApiProperty({
        description:
            'Registered email address to send password reset instructions',
        example: 'john.doe@example.com',
        format: 'email',
        type: String,
        title: 'Email Address',
        maxLength: 255,
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @MaxLength(255, { message: 'Email address is too long' })
    email: string;
}
