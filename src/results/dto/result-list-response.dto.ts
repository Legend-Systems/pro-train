import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, ValidateNested } from 'class-validator';
import { ResultResponseDto } from './result-response.dto';

export class ResultListSummaryDto {
    @ApiProperty({
        description: 'Total number of results',
        example: 150,
    })
    @IsNumber()
    totalResults: number;

    @ApiProperty({
        description: 'Average score across all results',
        example: 85.5,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Average percentage across all results',
        example: 78.2,
    })
    @IsNumber()
    averagePercentage: number;

    @ApiProperty({
        description: 'Number of passed results',
        example: 120,
    })
    @IsNumber()
    passedCount: number;

    @ApiProperty({
        description: 'Number of failed results',
        example: 30,
    })
    @IsNumber()
    failedCount: number;

    @ApiProperty({
        description: 'Pass rate percentage',
        example: 80.0,
    })
    @IsNumber()
    passRate: number;

    @ApiProperty({
        description: 'Highest score achieved',
        example: 100,
    })
    @IsNumber()
    highestScore: number;

    @ApiProperty({
        description: 'Lowest score achieved',
        example: 45,
    })
    @IsNumber()
    lowestScore: number;
}

export class ResultListResponseDto {
    @ApiProperty({
        description: 'Array of result objects',
        type: [ResultResponseDto],
    })
    @ValidateNested({ each: true })
    @Type(() => ResultResponseDto)
    results: ResultResponseDto[];

    @ApiProperty({
        description: 'Summary statistics for the results',
        type: ResultListSummaryDto,
    })
    @ValidateNested()
    @Type(() => ResultListSummaryDto)
    summary: ResultListSummaryDto;

    @ApiProperty({
        description: 'Total number of results (before pagination)',
        example: 150,
    })
    @IsNumber()
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    @IsNumber()
    page: number;

    @ApiProperty({
        description: 'Number of results per page',
        example: 10,
    })
    @IsNumber()
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 15,
    })
    @IsNumber()
    totalPages: number;

    @ApiProperty({
        description: 'Whether there is a next page',
        example: true,
    })
    hasNext: boolean;

    @ApiProperty({
        description: 'Whether there is a previous page',
        example: false,
    })
    hasPrevious: boolean;
}
