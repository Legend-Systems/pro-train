import { ApiProperty } from '@nestjs/swagger';

export class StandardApiResponse<T = any> {
    @ApiProperty({
        description: 'Indicates if the operation was successful',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Operation completed successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Response data payload',
        required: false,
    })
    data?: T;

    @ApiProperty({
        description: 'Additional metadata about the response',
        required: false,
    })
    meta?: {
        timestamp?: string;
        requestId?: string;
        pagination?: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    };
}

export class StandardOperationResponse {
    @ApiProperty({
        description: 'Human-readable message about the operation result',
        example: 'Operation completed successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status indicator',
        example: 'success',
        enum: ['success', 'error', 'warning', 'info', 'debug'],
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

// Specific operation response DTOs for better documentation
export class UserCreatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'User creation success message',
        example: 'User created successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class UserUpdatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'User update success message',
        example: 'User updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class UserDeletedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'User deletion success message',
        example: 'User deleted successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class ProfileUpdatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Profile update success message',
        example: 'Profile updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class PasswordChangedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Password change success message',
        example: 'Password changed successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class PasswordUpdatedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Password update success message',
        example: 'Password updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class EmailVerifiedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Email verification success message',
        example: 'Email verified successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class OrgBranchAssignedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'Organization and branch assignment success message',
        example: 'Organization and branch assigned successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class UserSoftDeletedResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'User soft delete success message',
        example: 'User deleted successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}

export class UserRestoredResponse extends StandardOperationResponse {
    @ApiProperty({
        description: 'User restoration success message',
        example: 'User restored successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Operation status',
        example: 'success',
    })
    status: string;

    @ApiProperty({
        description: 'HTTP status code',
        example: 200,
    })
    code: number;
}
