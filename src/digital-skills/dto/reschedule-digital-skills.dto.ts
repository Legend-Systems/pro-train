import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';

/**
 * Admin body for opening a new personal exam window on missed weak-skill checks.
 * Both dates stay NULL on assignments until this endpoint is used after due date.
 */
export class RescheduleDigitalSkillsDto {
    @ApiProperty({
        example: '2026-10-20T00:00:00.000Z',
        description: 'Start of the learner’s rescheduled exam window (inclusive day)',
    })
    @IsNotEmpty()
    @IsDateString()
    rescheduledStartDate: string;

    @ApiProperty({
        example: '2026-10-22T00:00:00.000Z',
        description: 'End of the learner’s rescheduled exam window (inclusive day)',
    })
    @IsNotEmpty()
    @IsDateString()
    rescheduledExamEndDate: string;
}
