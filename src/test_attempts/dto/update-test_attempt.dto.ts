import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { AttemptStatus } from '../entities/test_attempt.entity';

export class UpdateTestAttemptDto {
    @ApiProperty({
        description: 'Update the status of the test attempt',
        example: AttemptStatus.SUBMITTED,
        enum: AttemptStatus,
        required: false,
    })
    @IsOptional()
    @IsEnum(AttemptStatus)
    status?: AttemptStatus;

    @ApiProperty({
        description: 'Update progress percentage (0-100)',
        example: 85.5,
        minimum: 0,
        maximum: 100,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    progressPercentage?: number;
}
