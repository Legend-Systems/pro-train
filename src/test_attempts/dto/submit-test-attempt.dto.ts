import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Maximum options a learner may select for one multiple-choice question. */
export const MAX_SELECTED_OPTION_IDS = 3;

export class SubmitAnswerDto {
    @ApiProperty({
        description: 'Question ID for this answer',
        example: 45,
    })
    @IsNumber()
    questionId: number;

    @ApiProperty({
        description: 'Selected option ID for multiple choice questions',
        example: 180,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    selectedOptionId?: number;

    @ApiProperty({
        description:
            'Selected option IDs for multi-select multiple-choice questions (max 3)',
        example: [180, 181],
        required: false,
        type: [Number],
        maxItems: MAX_SELECTED_OPTION_IDS,
    })
    @IsOptional()
    @IsArray()
    @ArrayUnique()
    @ArrayMaxSize(MAX_SELECTED_OPTION_IDS)
    @IsNumber({}, { each: true })
    selectedOptionIds?: number[];

    @ApiProperty({
        description: 'Text answer for open-ended questions',
        example: 'The time complexity of binary search is O(log n)',
        required: false,
    })
    @IsOptional()
    @IsString()
    answerText?: string;

    @ApiProperty({
        description: 'Time spent on this question in seconds',
        example: 45,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    timeSpent?: number;
}

export class SubmitTestAttemptDto {
    @ApiProperty({
        description: 'All answers for the test',
        type: [SubmitAnswerDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SubmitAnswerDto)
    answers: SubmitAnswerDto[];

    @ApiProperty({
        description: 'Whether the student has reviewed their answers',
        example: true,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    finalReview?: boolean = false;

    @ApiProperty({
        description: 'Confirmation that the student wants to submit',
        example: true,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    confirmSubmission?: boolean = true;
}
