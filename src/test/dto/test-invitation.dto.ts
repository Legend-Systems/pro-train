import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsArray,
    IsDate,
    ArrayMinSize,
    MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { InvitationStatus } from '../entities/test-invitation.entity';

export class CreateTestInvitationDto {
    @ApiProperty({
        description: 'Array of user IDs to invite to the test',
        example: ['user-123', 'user-456'],
        type: [String],
    })
    @IsArray()
    @ArrayMinSize(1, { message: 'At least one user must be invited' })
    @IsString({ each: true })
    @IsNotEmpty({ each: true })
    userIds: string[];

    @ApiProperty({
        description: 'Custom message to include with the invitation',
        example: 'Please complete this assessment by the end of the week.',
        required: false,
        maxLength: 500,
    })
    @IsString()
    @IsOptional()
    @MaxLength(500, { message: 'Message cannot exceed 500 characters' })
    message?: string;

    @ApiProperty({
        description: 'When the invitation expires (ISO 8601 format)',
        example: '2025-01-30T23:59:59.000Z',
        required: false,
    })
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    @Transform(({ value }) => value ? new Date(value) : undefined)
    expiresAt?: Date;
}

export class UpdateTestInvitationDto {
    @ApiProperty({
        description: 'Updated custom message for the invitation',
        example: 'Deadline extended to next Friday.',
        required: false,
        maxLength: 500,
    })
    @IsString()
    @IsOptional()
    @MaxLength(500, { message: 'Message cannot exceed 500 characters' })
    message?: string;

    @ApiProperty({
        description: 'Updated expiration date (ISO 8601 format)',
        example: '2025-02-07T23:59:59.000Z',
        required: false,
    })
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    @Transform(({ value }) => value ? new Date(value) : undefined)
    expiresAt?: Date;

    @ApiProperty({
        description: 'Updated invitation status',
        example: InvitationStatus.PENDING,
        enum: InvitationStatus,
        required: false,
    })
    @IsEnum(InvitationStatus)
    @IsOptional()
    status?: InvitationStatus;
}

export class RespondToInvitationDto {
    @ApiProperty({
        description: 'Response to the invitation',
        example: InvitationStatus.ACCEPTED,
        enum: [InvitationStatus.ACCEPTED, InvitationStatus.DECLINED],
    })
    @IsEnum([InvitationStatus.ACCEPTED, InvitationStatus.DECLINED], {
        message: 'Response must be either ACCEPTED or DECLINED',
    })
    response: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED;

    @ApiProperty({
        description: 'Optional notes with the response',
        example: 'Looking forward to taking this test!',
        required: false,
        maxLength: 300,
    })
    @IsString()
    @IsOptional()
    @MaxLength(300, { message: 'Response notes cannot exceed 300 characters' })
    responseNotes?: string;
}

export class TestInvitationFilterDto {
    @ApiProperty({
        description: 'Filter by invitation status',
        enum: InvitationStatus,
        required: false,
    })
    @IsEnum(InvitationStatus)
    @IsOptional()
    status?: InvitationStatus;

    @ApiProperty({
        description: 'Filter by test ID',
        example: 1,
        required: false,
    })
    @IsString()
    @IsOptional()
    testId?: string;

    @ApiProperty({
        description: 'Filter by user ID',
        example: 'user-123',
        required: false,
    })
    @IsString()
    @IsOptional()
    userId?: string;

    @ApiProperty({
        description: 'Filter by who sent the invitation',
        example: 'admin-456',
        required: false,
    })
    @IsString()
    @IsOptional()
    invitedBy?: string;

    @ApiProperty({
        description: 'Show only expired invitations',
        example: false,
        required: false,
    })
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @IsOptional()
    expiredOnly?: boolean;
}

// Response DTOs
export class TestInvitationResponseDto {
    @ApiProperty({
        description: 'Invitation unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    invitationId: string;

    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    testId: number;

    @ApiProperty({
        description: 'Test details',
        type: 'object',
        additionalProperties: true,
    })
    test: {
        testId: number;
        title: string;
        description?: string;
        testType: string;
        durationMinutes?: number;
        maxAttempts: number;
        isActive: boolean;
        course: {
            courseId: number;
            title: string;
            description?: string;
        };
    };

    @ApiProperty({
        description: 'Invited user details',
        type: 'object',
        additionalProperties: true,
    })
    user: {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        avatar?: any;
    };

    @ApiProperty({
        description: 'User who sent the invitation',
        type: 'object',
        additionalProperties: true,
    })
    inviter: {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
    };

    @ApiProperty({
        description: 'Invitation status',
        enum: InvitationStatus,
    })
    status: InvitationStatus;

    @ApiProperty({
        description: 'Custom message with invitation',
        required: false,
    })
    message?: string;

    @ApiProperty({
        description: 'Invitation expiration date',
        required: false,
    })
    expiresAt?: Date;

    @ApiProperty({
        description: 'When user responded',
        required: false,
    })
    respondedAt?: Date;

    @ApiProperty({
        description: 'User response notes',
        required: false,
    })
    responseNotes?: string;

    @ApiProperty({
        description: 'When invitation was sent',
    })
    invitedAt: Date;

    @ApiProperty({
        description: 'Last update timestamp',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Organization ID',
    })
    orgId: string;

    @ApiProperty({
        description: 'Branch ID',
        required: false,
    })
    branchId?: string;
}

export class TestInvitationListResponseDto {
    @ApiProperty({
        description: 'Array of test invitations',
        type: [TestInvitationResponseDto],
    })
    invitations: TestInvitationResponseDto[];

    @ApiProperty({
        description: 'Total number of invitations',
        example: 25,
    })
    total: number;

    @ApiProperty({
        description: 'Summary statistics',
        type: 'object',
        additionalProperties: true,
    })
    summary: {
        pending: number;
        accepted: number;
        declined: number;
        expired: number;
        completed: number;
    };
} 