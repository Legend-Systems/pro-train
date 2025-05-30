import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuestionDto } from './create-question.dto';

export class BulkCreateQuestionsDto {
    @ApiProperty({
        description: 'Array of questions to create',
        type: [CreateQuestionDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateQuestionDto)
    questions: CreateQuestionDto[];
}
