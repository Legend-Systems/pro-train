import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class AutoMarkResponseDto {
    @ApiProperty({
        description: 'Success message indicating completion of auto-marking',
        example: 'Auto-marking completed for attempt 1',
    })
    @IsString()
    message: string;

    @ApiProperty({
        description: 'Number of questions that were successfully auto-marked',
        example: 5,
        minimum: 0,
    })
    @IsNumber()
    markedQuestions: number;

    @ApiProperty({
        description: 'Total number of unmarked answers found in the attempt',
        example: 8,
        minimum: 0,
    })
    @IsNumber()
    totalUnmarkedAnswers: number;

    @ApiProperty({
        description:
            'Number of questions skipped (text-based or missing options)',
        example: 3,
        minimum: 0,
    })
    @IsNumber()
    skippedQuestions: number;
}
