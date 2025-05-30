import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class ResultSummaryDto {
    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'JavaScript Fundamentals Quiz',
    })
    @IsString()
    testTitle: string;

    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Web Development Bootcamp',
    })
    @IsString()
    courseTitle: string;

    @ApiProperty({
        description: 'Total number of attempts',
        example: 45,
    })
    @IsNumber()
    totalAttempts: number;

    @ApiProperty({
        description: 'Number of completed attempts',
        example: 42,
    })
    @IsNumber()
    completedAttempts: number;

    @ApiProperty({
        description: 'Average score',
        example: 78.5,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Average percentage',
        example: 73.2,
    })
    @IsNumber()
    averagePercentage: number;

    @ApiProperty({
        description: 'Highest score achieved',
        example: 100,
    })
    @IsNumber()
    highestScore: number;

    @ApiProperty({
        description: 'Lowest score achieved',
        example: 42,
    })
    @IsNumber()
    lowestScore: number;

    @ApiProperty({
        description: 'Number of passed attempts',
        example: 35,
    })
    @IsNumber()
    passedAttempts: number;

    @ApiProperty({
        description: 'Number of failed attempts',
        example: 7,
    })
    @IsNumber()
    failedAttempts: number;

    @ApiProperty({
        description: 'Pass rate percentage',
        example: 83.3,
    })
    @IsNumber()
    passRate: number;

    @ApiProperty({
        description: 'Median score',
        example: 76.0,
    })
    @IsNumber()
    medianScore: number;

    @ApiProperty({
        description: 'Standard deviation of scores',
        example: 12.5,
    })
    @IsNumber()
    standardDeviation: number;

    @ApiProperty({
        description: 'Number of unique students who attempted',
        example: 38,
    })
    @IsNumber()
    uniqueStudents: number;

    @ApiProperty({
        description: 'Average time spent (in minutes)',
        example: 45.5,
    })
    @IsNumber()
    averageTimeSpent: number;

    @ApiProperty({
        description: 'Date range start',
        example: '2024-01-01T00:00:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    dateRangeStart: Date;

    @ApiProperty({
        description: 'Date range end',
        example: '2024-01-31T23:59:59.999Z',
    })
    @IsDate()
    @Type(() => Date)
    dateRangeEnd: Date;

    @ApiProperty({
        description: 'Most recent attempt date',
        example: '2024-01-30T14:30:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    lastAttemptDate: Date;
}
