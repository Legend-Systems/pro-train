import { ApiProperty } from '@nestjs/swagger';
import { QuestionResponseDto } from './question-response.dto';

export class QuestionListResponseDto {
    @ApiProperty({
        description: 'Array of questions',
        type: [QuestionResponseDto],
    })
    questions: QuestionResponseDto[];

    @ApiProperty({
        description: 'Total number of questions',
        example: 50,
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: 'Number of questions per page',
        example: 10,
    })
    pageSize: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 5,
    })
    totalPages: number;

    @ApiProperty({
        description: 'Total points for all questions',
        example: 125,
    })
    totalPoints: number;
}
