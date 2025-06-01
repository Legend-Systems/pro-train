import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ScoreDistributionDto {
    @ApiProperty({
        description: 'Score range (e.g., "90-100")',
        example: '90-100',
    })
    range: string;

    @ApiProperty({
        description: 'Number of results in this range',
        example: 12,
    })
    @IsNumber()
    count: number;

    @ApiProperty({
        description: 'Percentage of total results',
        example: 28.5,
    })
    @IsNumber()
    percentage: number;
}

export class PerformanceTrendDto {
    @ApiProperty({
        description: 'Date/period identifier',
        example: '2025-01-15',
    })
    period: string;

    @ApiProperty({
        description: 'Average score for this period',
        example: 78.5,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Number of attempts in this period',
        example: 15,
    })
    @IsNumber()
    attemptCount: number;

    @ApiProperty({
        description: 'Pass rate for this period',
        example: 73.3,
    })
    @IsNumber()
    passRate: number;
}

export class QuestionPerformanceDto {
    @ApiProperty({
        description: 'Question ID',
        example: 1,
    })
    @IsNumber()
    questionId: number;

    @ApiProperty({
        description: 'Question text (truncated)',
        example: 'What is the difference between let and var in JavaScript?',
    })
    questionText: string;

    @ApiProperty({
        description: 'Average score for this question',
        example: 85.2,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Percentage of correct answers',
        example: 78.5,
    })
    @IsNumber()
    correctPercentage: number;

    @ApiProperty({
        description: 'Number of times attempted',
        example: 42,
    })
    @IsNumber()
    attemptCount: number;

    @ApiProperty({
        description: 'Difficulty rating (1-5, based on performance)',
        example: 3.2,
    })
    @IsNumber()
    difficultyRating: number;
}

export class ResultStatsDto {
    @ApiProperty({
        description: 'Test ID these stats are for',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @ApiProperty({
        description: 'Score distribution breakdown',
        type: [ScoreDistributionDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ScoreDistributionDto)
    scoreDistribution: ScoreDistributionDto[];

    @ApiProperty({
        description: 'Performance trends over time',
        type: [PerformanceTrendDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PerformanceTrendDto)
    performanceTrends: PerformanceTrendDto[];

    @ApiProperty({
        description: 'Question-by-question performance analysis',
        type: [QuestionPerformanceDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QuestionPerformanceDto)
    questionPerformance: QuestionPerformanceDto[];

    @ApiProperty({
        description: 'Overall difficulty score (1-5)',
        example: 3.2,
    })
    @IsNumber()
    overallDifficulty: number;

    @ApiProperty({
        description: "Reliability coefficient (Cronbach's alpha)",
        example: 0.85,
    })
    @IsNumber()
    reliability: number;

    @ApiProperty({
        description: 'Discrimination index',
        example: 0.72,
    })
    @IsNumber()
    discriminationIndex: number;

    @ApiProperty({
        description: 'Average completion time in minutes',
        example: 42.5,
    })
    @IsNumber()
    averageCompletionTime: number;

    @ApiProperty({
        description: 'Fastest completion time in minutes',
        example: 18.5,
    })
    @IsNumber()
    fastestCompletion: number;

    @ApiProperty({
        description: 'Slowest completion time in minutes',
        example: 75.0,
    })
    @IsNumber()
    slowestCompletion: number;

    @ApiProperty({
        description: 'Standard deviation of completion times',
        example: 12.8,
    })
    @IsNumber()
    timeStandardDeviation: number;
}
