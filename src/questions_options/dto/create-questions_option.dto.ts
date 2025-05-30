import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsBoolean,
    IsNumber,
    IsOptional,
} from 'class-validator';

export class CreateQuestionOptionDto {
    @ApiProperty({
        description: 'Question ID that this option belongs to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    questionId: number;

    @ApiProperty({
        description: 'The option text/content',
        example: 'O(log n) - Logarithmic time complexity',
    })
    @IsString()
    @IsNotEmpty()
    optionText: string;

    @ApiProperty({
        description: 'Whether this option is the correct answer',
        example: true,
        default: false,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    isCorrect?: boolean = false;
}
