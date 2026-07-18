import { ApiProperty } from '@nestjs/swagger';

/** Aggregated performance metrics for a single branch within a month. */
export class BranchAnalyticsSummaryDto {
    @ApiProperty({ example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890' })
    branchId: string;

    @ApiProperty({ example: 'Downtown Branch' })
    branchName: string;

    @ApiProperty({
        description: 'Average knowledge score (percentage) across all results',
        example: 82.4,
    })
    averageScore: number;

    @ApiProperty({
        description: 'Percentage of results that passed',
        example: 76.5,
    })
    passRate: number;

    @ApiProperty({
        description: 'Number of results recorded in the period',
        example: 128,
    })
    resultsCount: number;

    @ApiProperty({ example: 2910 })
    totalMinutes: number;

    @ApiProperty({ example: 48.5 })
    totalHours: number;

    @ApiProperty({
        description: 'Distinct learners with training activity in the period',
        example: 12,
    })
    activeLearners: number;
}

/** Ranked learner within a branch (or org-wide) for a month. */
export class BranchPerformerDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    userId: string;

    @ApiProperty({ example: 'Jane' })
    firstName: string;

    @ApiProperty({ example: 'Smith' })
    lastName: string;

    @ApiProperty({ example: 'Downtown Branch', nullable: true })
    branchName: string | null;

    @ApiProperty({ example: 88.2 })
    averageScore: number;

    @ApiProperty({ example: 65.0 })
    passRate: number;

    @ApiProperty({ example: 14 })
    resultsCount: number;
}
