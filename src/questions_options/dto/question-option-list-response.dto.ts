import { ApiProperty } from '@nestjs/swagger';
import { QuestionOptionResponseDto } from './question-option-response.dto';

export class QuestionOptionListResponseDto {
    @ApiProperty({
        description: 'Array of question options',
        type: [QuestionOptionResponseDto],
    })
    options: QuestionOptionResponseDto[];

    @ApiProperty({
        description: 'Total number of options',
        example: 15,
    })
    total: number;

    @ApiProperty({
        description: 'Number of correct options',
        example: 4,
    })
    correctCount: number;

    @ApiProperty({
        description: 'Question information',
        required: false,
    })
    question?: {
        questionId: number;
        questionText: string;
        questionType: string;
        points: number;
    };
}
