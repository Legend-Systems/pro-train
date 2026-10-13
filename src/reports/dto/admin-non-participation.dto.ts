import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Why a learner counts as not having participated in one eligible test.
 *
 * - `no_attempts` — no `test_attempts` row exists for this learner and test.
 * - `expired_only` — attempts exist but every one expired.
 * - `not_submitted` — attempts exist, none expired and none submitted (an
 *   `in_progress` attempt abandoned before the window closed).
 * - `missing_result` — an attempt was submitted but no `results` row was
 *   written, so the test was never actually graded.
 */
export type AdminNonParticipationReason =
    | 'no_attempts'
    | 'expired_only'
    | 'not_submitted'
    | 'missing_result';

/** One eligible test a learner did not participate in. */
export class AdminNonParticipationTestDto {
    @ApiProperty({ example: 65 })
    testId: number;

    @ApiProperty({ example: 'Suspended Ceiling Systems' })
    testTitle: string;

    @ApiPropertyOptional({ example: 'Technical Sales', nullable: true })
    courseTitle: string | null;

    @ApiProperty({ description: 'Start of the closed exam window' })
    examStartDate: Date;

    @ApiProperty({ description: 'End of the closed exam window' })
    examEndDate: Date;

    @ApiProperty({
        enum: ['no_attempts', 'expired_only', 'not_submitted', 'missing_result'],
        example: 'no_attempts',
        description: 'Which non-participation rule this test matched',
    })
    reason: AdminNonParticipationReason;

    @ApiProperty({
        example: 0,
        description:
            'Non-voided, non-cancelled attempts on this test. Zero for no_attempts.',
    })
    attemptCount: number;
}

/** A learner with at least one eligible test they did not participate in. */
export class AdminNonParticipatingUserDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    email: string | null;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Short branch code, preferred where space is tight',
    })
    branchAlias: string | null;

    @ApiProperty({
        example: 8,
        description: 'Eligible tests expected of this learner',
    })
    eligibleTestCount: number;

    @ApiProperty({
        example: 6,
        description: 'How many of those the learner did not participate in',
    })
    missedTestCount: number;

    @ApiProperty({
        example: 2,
        description: 'Eligible tests the learner did complete and have graded',
    })
    participatedTestCount: number;

    @ApiProperty({
        example: false,
        description: 'True when the learner participated in none of their eligible tests',
    })
    hasNoParticipation: boolean;

    @ApiProperty({ type: [AdminNonParticipationTestDto] })
    missedTests: AdminNonParticipationTestDto[];
}

/** Org-wide totals for the non-participation section. */
export class AdminNonParticipationSummaryDto {
    @ApiProperty({
        example: 8,
        description: 'Eligible tests in the organisation (active, window closed)',
    })
    totalEligibleTests: number;

    @ApiProperty({ example: 42, description: 'Active learners evaluated' })
    totalLearners: number;

    @ApiProperty({
        example: 17,
        description: 'Learners missing at least one eligible test',
    })
    nonParticipatingUserCount: number;

    @ApiProperty({
        example: 5,
        description: 'Learners who participated in none of their eligible tests',
    })
    fullyNonParticipatingUserCount: number;

    @ApiProperty({
        example: 63,
        description: 'Total learner-test pairs with no participation',
    })
    totalMissedAssignments: number;
}

/**
 * Learners who have not participated in eligible tests.
 *
 * Organisation-wide and not period-scoped: every test whose exam window has
 * fully closed is in scope, so a test missed months ago stays visible until it
 * is completed.
 */
export class AdminNonParticipationReportDto {
    @ApiProperty({ type: AdminNonParticipationSummaryDto })
    summary: AdminNonParticipationSummaryDto;

    @ApiProperty({
        type: [AdminNonParticipatingUserDto],
        description: 'Ordered by missed-test count, highest first',
    })
    users: AdminNonParticipatingUserDto[];

    @ApiProperty({ description: 'When this snapshot was computed' })
    generatedAt: Date;
}
