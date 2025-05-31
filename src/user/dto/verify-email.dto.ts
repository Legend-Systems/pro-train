import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for email verification
 * Used to verify user email address with secure token validation
 */
export class VerifyEmailDto {
    @ApiProperty({
        description: 'Email verification token received via email',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJ0eXBlIjoidmVyaWZpY2F0aW9uIiwiaWF0IjoxNzA1MzE3MDAwLCJleHAiOjE3MDU0MDM0MDB9.signature',
        type: String,
        title: 'Verification Token',
        minLength: 10,
        format: 'jwt',
    })
    @IsString({ message: 'Verification token is required' })
    @MinLength(10, { message: 'Invalid verification token format' })
    token: string;
}
