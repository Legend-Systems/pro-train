import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { DigitalSkillsClassification } from '../constants/digital-skills.constant';
import { DigitalSkillsPlanItemDto } from './digital-skills-plan.dto';

/** One skill rating on a completed Digital Skills assessment. */
export class AdminDigitalSkillRatingDto {
    @ApiProperty({ example: 'excel-basic-formulas' })
    skillKey: string;

    @ApiProperty({ example: 'Using basic formulas' })
    skillTitle: string;

    @ApiProperty({ example: 'Microsoft Excel' })
    skillGroup: string;

    @ApiProperty({ example: 2, minimum: 1, maximum: 6 })
    level: number;

    @ApiProperty({ example: 'Very Basic' })
    levelLabel: string;

    @ApiProperty({ example: true })
    isWeakArea: boolean;
}

/** One learner’s latest Digital Skills assessment. */
export class AdminDigitalSkillsUserDto {
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

    @ApiPropertyOptional({ nullable: true })
    branchAlias: string | null;

    @ApiProperty({ example: 33.5, description: 'Digital Skills Score 0–100' })
    digitalSkillsScore: number;

    @ApiProperty({ example: 'Beginner' })
    classification: DigitalSkillsClassification;

    @ApiProperty({ example: 8 })
    weakSkillCount: number;

    @ApiProperty({ type: [AdminDigitalSkillRatingDto] })
    ratings: AdminDigitalSkillRatingDto[];

    @ApiProperty({ description: 'When the latest assessment was scored' })
    assessedAt: Date;

    @ApiProperty()
    resultId: number;

    @ApiProperty()
    attemptId: number;

    @ApiProperty({ type: [DigitalSkillsPlanItemDto] })
    assignedPlan: DigitalSkillsPlanItemDto[];
}

/** Org-wide totals for the Digital Skills admin report. */
export class AdminDigitalSkillsSummaryDto {
    @ApiProperty({ example: 31 })
    skillCount: number;

    @ApiProperty({ example: 42, description: 'Active learners in the org' })
    totalLearners: number;

    @ApiProperty({ example: 18 })
    assessedUserCount: number;

    @ApiProperty({ example: 24, description: 'Active learners with no scored assessment' })
    notAssessedUserCount: number;

    @ApiProperty({
        example: 7,
        description: 'Assessed learners classified Urgent Training or Beginner',
    })
    needsTrainingUserCount: number;
}

/**
 * Admin snapshot of Digital Skills self-assessments.
 *
 * Score and classification follow `digital-skills-setup.md`. Needs-training
 * means Urgent Training (0–25) or Beginner (26–45).
 */
export class AdminDigitalSkillsReportDto {
    @ApiProperty({ type: AdminDigitalSkillsSummaryDto })
    summary: AdminDigitalSkillsSummaryDto;

    @ApiProperty({ type: [AdminDigitalSkillsUserDto] })
    assessedUsers: AdminDigitalSkillsUserDto[];

    @ApiProperty({
        type: [AdminDigitalSkillsUserDto],
        description: 'Assessed users in Urgent Training or Beginner',
    })
    usersNeedingTraining: AdminDigitalSkillsUserDto[];

    @ApiProperty({ description: 'When this snapshot was computed' })
    generatedAt: Date;
}
