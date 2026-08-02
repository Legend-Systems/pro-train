import { ApiProperty } from '@nestjs/swagger';

/**
 * Audit view of a single attempt reset, returned by the reset endpoint and by
 * the reset history endpoint.
 */
export class TestAttemptResetResponseDto {
    @ApiProperty({
        description: 'Reset record unique identifier',
        example: 1,
    })
    resetId: number;

    @ApiProperty({
        description: 'Test whose attempts were reset',
        example: 42,
    })
    testId: number;

    @ApiProperty({
        description: 'Title of the test at the time of reading',
        example: 'JavaScript Fundamentals Quiz',
    })
    testTitle: string;

    @ApiProperty({
        description: 'Learner whose attempts were reset',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    userId: string;

    @ApiProperty({
        description: 'Full name of the learner whose attempts were reset',
        example: 'Jane Doe',
    })
    userName: string;

    @ApiProperty({
        description: 'Administrator who performed the reset',
        example: '223e4567-e89b-12d3-a456-426614174111',
    })
    resetByUserId: string;

    @ApiProperty({
        description: 'Full name of the administrator who performed the reset',
        example: 'John Smith',
    })
    resetByName: string;

    @ApiProperty({
        description: 'Justification supplied by the administrator',
        example: 'Learner lost connection during their final attempt',
        nullable: true,
    })
    reason: string | null;

    @ApiProperty({
        description: 'Number of test attempts voided by this reset',
        example: 3,
    })
    attemptsVoided: number;

    @ApiProperty({
        description: 'Number of results voided by this reset',
        example: 3,
    })
    resultsVoided: number;

    @ApiProperty({
        description: 'ISO timestamp of the moment the reset took effect',
        example: '2025-01-15T10:30:00.000Z',
    })
    resetAt: string;

    @ApiProperty({
        description: 'Maximum attempts configured on the test',
        example: 3,
    })
    maxAttempts: number;

    @ApiProperty({
        description:
            'Attempts the learner may still use, counting only live, non-cancelled attempts',
        example: 3,
    })
    attemptsRemaining: number;
}
