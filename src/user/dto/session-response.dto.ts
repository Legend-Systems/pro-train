import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';
import { UserStatsResponseDto } from '../../leaderboard/dto/user-stats-response.dto';

export class OrgInfo {
    @ApiProperty({
        description: 'Organization unique identifier',
        example: 'org-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Organization name',
        example: 'Acme Corporation',
    })
    name: string;

    @ApiProperty({
        description: 'Organization logo URL',
        example: 'https://cdn.example.com/logos/acme-corp.png',
        required: false,
    })
    avatar?: string;
}

export class BranchInfo {
    @ApiProperty({
        description: 'Branch unique identifier',
        example: 'branch-b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    id: string;

    @ApiProperty({
        description: 'Branch name',
        example: 'Downtown Branch',
    })
    name: string;

    @ApiProperty({
        description: 'Branch email address',
        example: 'downtown@acmecorp.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'Branch physical address',
        example: '123 Main Street, Downtown, City 12345',
        required: false,
    })
    address?: string;

    @ApiProperty({
        description: 'Branch contact phone number',
        example: '+1-555-123-4567',
        required: false,
    })
    contactNumber?: string;

    @ApiProperty({
        description: 'Branch manager name',
        example: 'John Smith',
        required: false,
    })
    managerName?: string;
}

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
        description: 'User first name',
        example: 'John',
    })
    firstName: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    lastName: string;

    @ApiProperty({
        description: 'User avatar URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
    })
    avatar?: string;

    @ApiProperty({
        description: 'User role in the system',
        example: 'user',
        enum: UserRole,
        required: false,
    })
    role?: UserRole;

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

    @ApiProperty({
        description: 'User leaderboard statistics and metrics',
        type: UserStatsResponseDto,
        required: false,
    })
    leaderboard?: UserStatsResponseDto;

    @ApiProperty({
        description: 'Organization information',
        type: OrgInfo,
        required: false,
    })
    organization?: OrgInfo;

    @ApiProperty({
        description: 'Branch information',
        type: BranchInfo,
        required: false,
    })
    branch?: BranchInfo;
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
