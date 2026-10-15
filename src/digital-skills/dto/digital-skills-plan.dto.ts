import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { DigitalSkillsClassification } from '../constants/digital-skills.constant';
import { AdminDigitalSkillRatingDto } from './admin-digital-skills-report.dto';

/** One assigned module on a Digital Skills training plan. */
export class DigitalSkillsPlanItemDto {
    @ApiProperty()
    skillKey: string;

    @ApiProperty()
    skillTitle: string;

    @ApiProperty()
    skillGroup: string;

    @ApiProperty()
    level: number;

    @ApiProperty()
    levelLabel: string;

    @ApiPropertyOptional({ nullable: true })
    materialId: number | null;

    @ApiPropertyOptional({ nullable: true })
    materialTitle: string | null;

    @ApiPropertyOptional({ nullable: true })
    testId: number | null;

    @ApiPropertyOptional({ nullable: true })
    testTitle: string | null;

    @ApiPropertyOptional({ nullable: true })
    examStartDate: Date | null;

    @ApiPropertyOptional({ nullable: true })
    examEndDate: Date | null;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Latest knowledge-test percentage; does not change the baseline',
    })
    latestKnowledgePercentage: number | null;

    @ApiPropertyOptional({ nullable: true })
    latestKnowledgePassed: boolean | null;

    @ApiProperty()
    assignedAt: Date;

    @ApiPropertyOptional({
        nullable: true,
        description: 'Date the learner is expected to complete this booked check',
    })
    expectedDueDate: Date | null;
}

/** Learner’s own Digital Skills baseline plus assigned weak-area plan. */
export class DigitalSkillsPlanDto {
    @ApiProperty()
    assessed: boolean;

    @ApiPropertyOptional({ nullable: true })
    digitalSkillsScore: number | null;

    @ApiPropertyOptional({ nullable: true })
    classification: DigitalSkillsClassification | null;

    @ApiPropertyOptional({ nullable: true })
    assessedAt: Date | null;

    @ApiProperty({ type: [AdminDigitalSkillRatingDto] })
    ratings: AdminDigitalSkillRatingDto[];

    @ApiProperty({ type: [DigitalSkillsPlanItemDto] })
    assignedPlan: DigitalSkillsPlanItemDto[];

    @ApiProperty()
    generatedAt: Date;
}
