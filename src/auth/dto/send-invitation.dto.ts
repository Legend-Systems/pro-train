import {
    IsEmail,
    IsString,
    IsOptional,
    MaxLength,
    MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for sending user invitations
 * Used to invite new users to join the platform with optional organization/branch assignment
 */
export class SendInvitationDto {
    @ApiProperty({
        description: 'Email address of the person to invite to the platform',
        example: 'newuser@example.com',
        format: 'email',
        type: String,
        title: 'Recipient Email',
        maxLength: 255,
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @MaxLength(255, { message: 'Email address is too long' })
    email: string;

    @ApiProperty({
        description:
            'Optional personalized message to include in the invitation email',
        example:
            "Join our team on the Exxam platform! We're excited to have you aboard.",
        required: false,
        type: String,
        title: 'Custom Message',
        maxLength: 500,
        minLength: 1,
    })
    @IsOptional()
    @IsString({ message: 'Message must be a string' })
    @MinLength(1, { message: 'Message cannot be empty if provided' })
    @MaxLength(500, {
        message: 'Message is too long (maximum 500 characters)',
    })
    message?: string;

    @ApiProperty({
        description:
            'Organization ID to automatically assign the user upon registration (optional)',
        example: 'org_123456789',
        required: false,
        type: String,
        title: 'Organization ID',
        pattern: '^org_[a-zA-Z0-9]{8,}$',
    })
    @IsOptional()
    @IsString({ message: 'Organization ID must be a string' })
    organizationId?: string;

    @ApiProperty({
        description:
            'Branch ID to automatically assign the user upon registration (optional)',
        example: 'branch_123456789',
        required: false,
        type: String,
        title: 'Branch ID',
        pattern: '^branch_[a-zA-Z0-9]{8,}$',
    })
    @IsOptional()
    @IsString({ message: 'Branch ID must be a string' })
    branchId?: string;
}
