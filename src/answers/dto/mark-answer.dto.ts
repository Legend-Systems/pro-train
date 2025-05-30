import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MarkAnswerDto {
    @ApiProperty({
        description: 'Points awarded for this answer',
        example: 4.5,
        minimum: 0,
    })
    @IsNumber()
    @Min(0)
    pointsAwarded: number;

    @ApiProperty({
        description: 'Feedback from the marker for manual grading',
        example: 'Good understanding but could provide more detail',
        required: false,
    })
    @IsOptional()
    @IsString()
    feedback?: string;
} 