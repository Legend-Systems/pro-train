import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for resending email verification
 * Used to request a new verification email for unverified accounts
 */
export class ResendVerificationDto {
    @ApiProperty({
        description:
            'Registered email address to resend verification instructions',
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
