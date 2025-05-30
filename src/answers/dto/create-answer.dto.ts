import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class CreateAnswerDto {
    @ApiProperty({
        description: 'Test attempt ID this answer belongs to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    attemptId: number;

    @ApiProperty({
        description: 'Question ID this answer responds to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    questionId: number;

    @ApiProperty({
        description: 'Selected option ID for multiple choice questions',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    selectedOptionId?: number;

    @ApiProperty({
        description: 'Text answer for open-ended questions',
        example: 'The time complexity of binary search is O(log n)',
        required: false,
    })
    @IsOptional()
    @IsString()
    textAnswer?: string;
}
