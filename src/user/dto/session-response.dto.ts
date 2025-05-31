import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';
import { UserStatsResponseDto } from '../../leaderboard/dto/user-stats-response.dto';

export class OrgInfo {
    @ApiProperty({
        description: 'Organization unique identifier',
        example: '1',
    })
    id: string;

    @ApiProperty({
        description: 'Organization name',
        example: 'Legend Systems',
    })
    name: string;

    @ApiProperty({
        description: 'Organization logo URL',
        example:
            'https://images.squarespace-cdn.com/content/v1/60d79a5c5de30045e5fbd613/1624811319877-J4XM9UIJKV7QUZSI4VKI/LegendSystemsLogo.png?format=1500w',
        required: false,
    })
    avatar?: string;
}

export class BranchInfo {
    @ApiProperty({
        description: 'Branch unique identifier',
        example: '1',
    })
    id: string;

    @ApiProperty({
        description: 'Branch name',
        example: 'Denver',
    })
    name: string;

    @ApiProperty({
        description: 'Branch email address',
        example: 'sales@legendsystems.co.za',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'Branch physical address',
        example: '123 Main Street, Downtown, City 12345',
        required: false,
        nullable: true,
    })
    address?: string | null;

    @ApiProperty({
        description: 'Branch contact phone number',
        example: '+27 100132465',
        required: false,
    })
    contactNumber?: string;

    @ApiProperty({
        description: 'Branch manager name',
        example: 'Kats',
        required: false,
    })
    managerName?: string;
}

export class UserResponseDto {
    @ApiProperty({
        description: 'User unique identifier',
        example: '1',
    })
    uid: string;

    @ApiProperty({
        description: 'User email address',
        example: 'theguy@orrbit.co.za',
    })
    email: string;

    @ApiProperty({
        description: 'User first name',
        example: 'Brandon',
    })
    firstName: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Nhlanhla',
    })
    lastName: string;

    @ApiProperty({
        description:
            'User avatar image with variants (thumbnail, medium, original)',
        example: {
            id: 1,
            originalName: 'pexels-photo-577585.jpg',
            url: 'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585.jpg',
            thumbnail:
                'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585-thumbnail.jpg',
            medium: 'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585.jpg',
            original:
                'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585.jpg',
        },
        required: false,
    })
    avatar?: {
        id: number;
        originalName?: string;
        url?: string;
        thumbnail?: string;
        medium?: string;
        original?: string;
    };

    @ApiProperty({
        description: 'User role in the system',
        example: 'brandon',
        enum: UserRole,
        required: false,
    })
    role?: UserRole;

    @ApiProperty({
        description: 'Account creation date',
        example: '2025-05-30T16:40:02.055Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last update date',
        example: '2025-05-31T18:55:12.552Z',
    })
    updatedAt: Date;
}

// Simple response DTO for signup - just user data, no tokens
export class SignUpResponseDto {
    @ApiProperty({
        description: 'Registered user information',
        type: UserResponseDto,
    })
    user: UserResponseDto;

    @ApiProperty({
        description:
            'Organization information if user was invited to organization',
        type: OrgInfo,
        required: false,
    })
    organization?: OrgInfo;

    @ApiProperty({
        description:
            'Branch information if user was invited to specific branch',
        type: BranchInfo,
        required: false,
    })
    branch?: BranchInfo;
}

// Enhanced response DTO for signin with tokens, leaderboard, org and branch data
export class SessionResponseDto {
    @ApiProperty({
        description: 'JWT access token for API authentication',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJ0aGVndXlAb3JyYml0LmNvLnphIiwiZmlyc3ROYW1lIjoiQnJhbmRvbiIsImxhc3ROYW1lIjoiTmhsYW5obGEiLCJvcmdJZCI6IjEiLCJicmFuY2hJZCI6IjEiLCJpYXQiOjE3NDg3MTc3MjgsImV4cCI6MTc0ODcyMTMyOH0.g58W5uSLHCNf59GS6qSCuYJAvZJvsPR68qFFX4bSrho',
    })
    accessToken: string;

    @ApiProperty({
        description: 'JWT refresh token for token renewal',
        example:
            'c1c2fd688db5151443a65c6033d58f38bdee084c116f8c8213ed54692a0a522e',
    })
    refreshToken: string;

    @ApiProperty({
        description: 'Token expiration time in seconds',
        example: 3600,
    })
    expiresIn: number;

    @ApiProperty({
        description: 'Authenticated user information',
        type: UserResponseDto,
    })
    user: UserResponseDto;

    @ApiProperty({
        description: 'User leaderboard statistics and performance metrics',
        type: UserStatsResponseDto,
        required: false,
        example: {
            totalPoints: 0,
            totalTestsCompleted: 0,
            averageScore: 0,
            coursesEnrolled: 0,
            bestRank: null,
            recentActivity: [],
        },
    })
    leaderboard?: UserStatsResponseDto;

    @ApiProperty({
        description:
            'Organization information if user belongs to an organization',
        type: OrgInfo,
        required: false,
    })
    organization?: OrgInfo;

    @ApiProperty({
        description: 'Branch information if user belongs to a specific branch',
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
        description:
            'Authentication session data with tokens, user info, leaderboard stats, and organization/branch details',
        type: SessionResponseDto,
    })
    data: SessionResponseDto;
}

export class SignUpSuccessResponse extends StandardApiResponse<SignUpResponseDto> {
    @ApiProperty({
        description:
            'User registration data with organization/branch info if applicable',
        type: SignUpResponseDto,
    })
    data: SignUpResponseDto;
}
