import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for JWT token refresh
 * Used to obtain new access tokens using valid refresh tokens
 */
export class RefreshTokenDto {
    @ApiProperty({
        description: 'Valid JWT refresh token for obtaining new access token',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2lkIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDUzMTcwMDAsImV4cCI6MTcwNzk5NTQwMH0.signature',
        type: String,
        title: 'Refresh Token',
        minLength: 10,
        format: 'jwt',
    })
    @IsString({ message: 'Refresh token is required' })
    @MinLength(10, { message: 'Invalid refresh token format' })
    refreshToken: string;
}
