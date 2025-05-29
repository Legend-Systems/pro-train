import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
    @ApiProperty({
        description: 'User unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    uid: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'User first name',
        example: 'John',
        required: false,
    })
    firstName?: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
        required: false,
    })
    lastName?: string;

    @ApiProperty({
        description: 'User avatar URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
    })
    avatar?: string;

    @ApiProperty({
        description: 'Account creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last update date',
        example: '2024-01-01T00:00:00.000Z',
    })
    updatedAt: Date;
}

export class SessionResponseDto {
    @ApiProperty({
        description: 'JWT access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'JWT refresh token',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    refreshToken?: string;

    @ApiProperty({
        description: 'Token expiration time in seconds',
        example: 3600,
        required: false,
    })
    expiresIn?: number;

    @ApiProperty({
        description: 'User information',
        type: UserResponseDto,
    })
    user: UserResponseDto;
}

export class StandardApiResponse<T = any> {
    @ApiProperty({
        description: 'Indicates if the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Response data payload',
        required: false,
    })
    data?: T;

    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Operation completed successfully',
    })
    message: string;
}

export class AuthSuccessResponse extends StandardApiResponse<SessionResponseDto> {
    @ApiProperty({
        description: 'Authentication session data',
        type: SessionResponseDto,
    })
    data: SessionResponseDto;
}
