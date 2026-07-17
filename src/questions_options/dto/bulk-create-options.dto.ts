import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    ValidateNested,
    IsNumber,
    IsString,
    IsNotEmpty,
    IsBoolean,
    IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkOptionDto {
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

export class BulkCreateOptionsDto {
    @ApiProperty({
        description: 'Question ID that these options belong to',
        example: 1,
    })
    @IsNumber()
    questionId: number;

    @ApiProperty({
        description: 'Array of options to create',
        type: [BulkOptionDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkOptionDto)
    options: BulkOptionDto[];
}
