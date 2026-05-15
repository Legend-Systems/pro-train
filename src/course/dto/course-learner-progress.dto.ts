import { ApiProperty } from '@nestjs/swagger';

/**
 * Tracks whether the learner ever passed each mandatory exam (Section 1.1).
 */
export class MandatoryExamCompletionItemDto {
    @ApiProperty({ description: 'Test identifier', example: 12 })
    testId!: number;

    @ApiProperty({ description: 'Exam title', example: 'Final exam' })
    title!: string;

    @ApiProperty({
        description: 'True if at least one result row exists with passed=true',
        example: true,
    })
    everPassed!: boolean;
}

/**
 * Course completion gate: all active mandatory exams must have been passed at least once.
 */
export class CourseCompletionBlockDto {
    @ApiProperty({
        description: 'Count of active exams (testType=exam, isActive=true) for this course',
        example: 3,
    })
    mandatoryExamCount!: number;

    @ApiProperty({
        description: 'How many of those mandatory exams the user has ever passed',
        example: 2,
    })
    passedMandatoryCount!: number;

    @ApiProperty({
        description: 'True when passedMandatoryCount === mandatoryExamCount',
        example: false,
    })
    isCourseComplete!: boolean;

    @ApiProperty({
        type: [MandatoryExamCompletionItemDto],
        description: 'Per-exam pass status for transparency',
    })
    mandatoryExams!: MandatoryExamCompletionItemDto[];
}

/**
 * One test’s contribution to personal knowledge (Section 1.2).
 */
export class KnowledgeTestContributionDto {
    @ApiProperty({ example: 5 })
    testId!: number;

    @ApiProperty({ example: 'Safety quiz' })
    title!: string;

    @ApiProperty({ example: 'quiz' })
    testType!: string;

    @ApiProperty({
        description: 'Latest attempt percentage for this test (corporate default)',
        example: 82.5,
    })
    latestPercentage!: number;
}

/**
 * Personal knowledge: mean of latest percentage per attempted test, all activity types.
 */
export class PersonalKnowledgeBlockDto {
    @ApiProperty({
        description:
            'Average of latest result.percentage over attempted tests only (Section 1.2)',
        example: 76.25,
    })
    knowledgePercent!: number;

    @ApiProperty({
        description: 'Number of tests in the course the learner has at least one result for',
        example: 7,
    })
    attemptedTestCount!: number;

    @ApiProperty({
        type: [KnowledgeTestContributionDto],
        description: 'Breakdown used to compute knowledgePercent',
    })
    testsIncluded!: KnowledgeTestContributionDto[];
}

/**
 * Primary payload for GET /courses/:courseId/learner-progress (Phase 2).
 * Completion and knowledge are derived from tests + results, not training_progress.
 */
export class CourseLearnerProgressPayloadDto {
    @ApiProperty({ type: CourseCompletionBlockDto })
    courseCompletion!: CourseCompletionBlockDto;

    @ApiProperty({ type: PersonalKnowledgeBlockDto })
    personalKnowledge!: PersonalKnowledgeBlockDto;
}
