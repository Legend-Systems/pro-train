import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ResultAnalyticsDto {
    @ApiProperty({
        description: 'Total number of results',
        example: 150,
    })
    @Expose()
    totalResults: number;

    @ApiProperty({
        description: 'Average percentage score',
        example: 78.5,
    })
    @Expose()
    averagePercentage: number;

    @ApiProperty({
        description: 'Average raw score',
        example: 82.3,
    })
    @Expose()
    averageScore: number;

    @ApiProperty({
        description: 'Highest percentage score',
        example: 98.5,
    })
    @Expose()
    highestPercentage: number;

    @ApiProperty({
        description: 'Lowest percentage score',
        example: 45.2,
    })
    @Expose()
    lowestPercentage: number;

    @ApiProperty({
        description: 'Number of passed results',
        example: 120,
    })
    @Expose()
    passedCount: number;

    @ApiProperty({
        description: 'Number of failed results',
        example: 30,
    })
    @Expose()
    failedCount: number;

    @ApiProperty({
        description: 'Pass rate percentage',
        example: 80,
    })
    @Expose()
    passRate: number;

    @ApiProperty({
        description: 'Score distribution by ranges',
        example: {
            '0-20': 5,
            '21-40': 10,
            '41-60': 25,
            '61-80': 50,
            '81-100': 60,
        },
    })
    @Expose()
    scoreDistribution: Record<string, number>;

    @ApiProperty({
        description: 'Grade distribution',
        example: {
            'A': 30,
            'B': 40,
            'C': 35,
            'D': 20,
            'F': 25,
        },
    })
    @Expose()
    gradeDistribution: Record<string, number>;
} 