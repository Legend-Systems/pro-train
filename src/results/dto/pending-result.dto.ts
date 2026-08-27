import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttemptStatus } from '../../test_attempts/entities/test_attempt.entity';

/**
 * Why this attempt appears on the Pending Results tab.
 *
 * `submitted_without_result` is the attempt-668 class: answers saved and
 * often auto-marked, HTTP submit reported success, but no `results` row.
 */
export enum PendingResultReason {
    SUBMITTED_WITHOUT_RESULT = 'submitted_without_result',
    IN_PROGRESS_COMPLETE_WITHOUT_RESULT = 'in_progress_complete_without_result',
    EXPIRED_WITHOUT_RESULT = 'expired_without_result',
}

/** One stuck attempt that can be graded from stored answers. */
export class PendingResultAttemptDto {
    @ApiProperty({ example: 668 })
    attemptId: number;

    @ApiProperty({ example: 83 })
    testId: number;

    @ApiProperty({ example: 'Safety Fundamentals Exam' })
    testTitle: string;

    @ApiProperty()
    userId: string;

    @ApiProperty({ example: 'Jane' })
    firstName: string;

    @ApiProperty({ example: 'Smith' })
    lastName: string;

    @ApiProperty({ example: 'jane.smith@example.com' })
    email: string;

    @ApiPropertyOptional({ nullable: true })
    branchName?: string | null;

    @ApiProperty({ enum: AttemptStatus, example: AttemptStatus.SUBMITTED })
    status: AttemptStatus;

    @ApiProperty({ example: 100 })
    progressPercentage: number;

    @ApiPropertyOptional({ nullable: true, type: String })
    submitTime?: string | null;

    @ApiProperty({ type: String })
    startTime: string;

    @ApiProperty({ type: String })
    updatedAt: string;

    @ApiProperty({ example: 5 })
    answerCount: number;

    @ApiProperty({ example: 5 })
    markedCount: number;

    @ApiProperty({ enum: PendingResultReason })
    reason: PendingResultReason;
}

export class PendingResultSummaryDto {
    @ApiProperty({ example: 3 })
    totalPending: number;

    @ApiProperty({ example: 2 })
    submittedWithoutResult: number;

    @ApiProperty({ example: 1 })
    inProgressCompleteWithoutResult: number;

    @ApiProperty({ example: 0 })
    expiredWithoutResult: number;
}

export class PendingResultListDto {
    @ApiProperty({ type: PendingResultSummaryDto })
    summary: PendingResultSummaryDto;

    @ApiProperty({ type: [PendingResultAttemptDto] })
    attempts: PendingResultAttemptDto[];

    @ApiProperty({ example: 3 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 20 })
    limit: number;
}

/** Outcome of grading one attempt from its stored answers. */
export class GradeStoredAttemptResultDto {
    @ApiProperty({ example: 668 })
    attemptId: number;

    @ApiProperty({
        enum: ['created', 'updated', 'already_graded'],
        description:
            '`created` inserts a missing result; `updated` re-grades an existing row; `already_graded` is the idempotent no-op',
    })
    action: 'created' | 'updated' | 'already_graded';

    @ApiProperty({ example: 412 })
    resultId: number;

    @ApiProperty({ example: 5 })
    score: number;

    @ApiProperty({ example: 5 })
    maxScore: number;

    @ApiProperty({ example: 100 })
    percentage: number;

    @ApiProperty({ example: true })
    passed: boolean;

    @ApiProperty({
        example: 0,
        description: 'How many previously unmarked answers were auto-marked this call',
    })
    answersMarked: number;

    @ApiProperty({ enum: AttemptStatus })
    attemptStatus: AttemptStatus;
}

export class GradeStoredAttemptFailureDto {
    @ApiProperty({ example: 668 })
    attemptId: number;

    @ApiProperty({ example: false })
    success: false;

    @ApiProperty({ example: 'Cannot grade an attempt with no stored answers' })
    message: string;
}

export class GradeStoredAttemptsResponseDto {
    @ApiProperty({ example: 3 })
    processed: number;

    @ApiProperty({ example: 2 })
    succeeded: number;

    @ApiProperty({ example: 1 })
    failed: number;

    @ApiProperty({
        type: 'array',
        items: {
            oneOf: [
                { $ref: '#/components/schemas/GradeStoredAttemptResultDto' },
                { $ref: '#/components/schemas/GradeStoredAttemptFailureDto' },
            ],
        },
    })
    results: Array<GradeStoredAttemptResultDto | GradeStoredAttemptFailureDto>;
}
