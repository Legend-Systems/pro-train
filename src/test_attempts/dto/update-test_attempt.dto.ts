import { ApiProperty } from '@nestjs/swagger';
import {
    IsEnum,
    IsOptional,
    IsNumber,
    Min,
    Max,
    IsString,
    MaxLength,
} from 'class-validator';
import { AttemptStatus } from '../entities/test_attempt.entity';

/**
 * Data Transfer Object for updating an existing test attempt
 * Used for progress updates, status changes, and administrative actions
 */
export class UpdateTestAttemptDto {
    @ApiProperty({
        description:
            'Update the status of the test attempt - use with caution as this affects grading and access',
        example: AttemptStatus.SUBMITTED,
        enum: AttemptStatus,
        required: false,
        title: 'Attempt Status',
        examples: {
            'submit-attempt': {
                summary: 'Submit Attempt',
                description: 'Mark attempt as submitted for grading',
                value: AttemptStatus.SUBMITTED,
            },
            'cancel-attempt': {
                summary: 'Cancel Attempt',
                description: 'Cancel an in-progress attempt',
                value: AttemptStatus.CANCELLED,
            },
            'expire-attempt': {
                summary: 'Expire Attempt',
                description: 'Mark attempt as expired due to time limit',
                value: AttemptStatus.EXPIRED,
            },
        },
    })
    @IsOptional()
    @IsEnum(AttemptStatus, { message: 'Status must be a valid attempt status' })
    status?: AttemptStatus;

    @ApiProperty({
        description:
            'Update progress percentage (0-100) - automatically calculated but can be manually adjusted',
        example: 85.5,
        minimum: 0,
        maximum: 100,
        required: false,
        type: Number,
        title: 'Progress Percentage',
    })
    @IsOptional()
    @IsNumber({}, { message: 'Progress percentage must be a valid number' })
    @Min(0, { message: 'Progress percentage cannot be negative' })
    @Max(100, { message: 'Progress percentage cannot exceed 100' })
    progressPercentage?: number;

    @ApiProperty({
        description:
            'Administrative reason for the update - recommended for audit trails',
        example: 'Extended time due to technical difficulties',
        required: false,
        type: String,
        title: 'Update Reason',
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Reason must be a string' })
    @MaxLength(500, { message: 'Reason cannot exceed 500 characters' })
    reason?: string;
}
