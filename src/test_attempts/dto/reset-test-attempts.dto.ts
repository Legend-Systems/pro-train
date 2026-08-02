import { ApiProperty } from '@nestjs/swagger';
import {
    IsNumber,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from 'class-validator';
import { RESET_REASON_MAX_LENGTH } from '../entities/test-attempt-reset.entity';

/**
 * Data Transfer Object for resetting one learner's attempts on one test.
 *
 * Voiding is deliberately scoped to a single (test, learner) pair: a reset is a
 * privileged, auditable act and must never be applied in bulk by accident.
 */
export class ResetTestAttemptsDto {
    @ApiProperty({
        description: 'Test whose attempts should be reset for the learner',
        example: 42,
        type: Number,
        minimum: 1,
    })
    @IsNumber({}, { message: 'Test ID must be a valid number' })
    @IsNotEmpty({ message: 'Test ID is required' })
    @Min(1, { message: 'Test ID must be at least 1' })
    testId: number;

    @ApiProperty({
        description: 'Learner whose attempts should be reset',
        example: '123e4567-e89b-12d3-a456-426614174000',
        type: String,
    })
    @IsUUID('4', { message: 'User ID must be a valid UUID' })
    @IsNotEmpty({ message: 'User ID is required' })
    userId: string;

    @ApiProperty({
        description: 'Optional justification stored on the audit record',
        example: 'Learner lost connection during their final attempt',
        required: false,
        maxLength: RESET_REASON_MAX_LENGTH,
    })
    @IsOptional()
    @IsString({ message: 'Reason must be a string' })
    @MaxLength(RESET_REASON_MAX_LENGTH, {
        message: `Reason cannot exceed ${RESET_REASON_MAX_LENGTH} characters`,
    })
    reason?: string;
}
