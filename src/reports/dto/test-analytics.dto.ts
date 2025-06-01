import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class TestStatsDto {
    @ApiProperty({
        description: 'Total number of attempts for this test',
        example: 150,
    })
    @IsNumber()
    totalAttempts: number;

    @ApiProperty({
        description: 'Number of completed attempts',
        example: 125,
    })
    @IsNumber()
    completedAttempts: number;

    @ApiProperty({
        description: 'Test completion rate as percentage',
        example: 83.3,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    completionRate: number;

    @ApiProperty({
        description: 'Average test duration in minutes',
        example: 45.5,
    })
    @IsNumber()
    averageDurationMinutes: number;

    @ApiProperty({
        description: 'Average score across all attempts',
        example: 78.2,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Pass rate percentage',
        example: 72.0,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    passRate: number;

    @ApiProperty({
        description: 'Average number of attempts per user',
        example: 2.3,
    })
    @IsNumber()
    averageAttemptsPerUser: number;

    @ApiProperty({
        description: 'First attempt success rate',
        example: 58.5,
    })
    @IsNumber()
    firstAttemptSuccessRate: number;
}

export class TestPerformanceDto {
    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'Mathematics Final Exam',
    })
    @IsString()
    testTitle: string;

    @ApiProperty({
        description: 'Test type (EXAM, QUIZ, TRAINING)',
        example: 'EXAM',
    })
    @IsString()
    testType: string;

    @ApiProperty({
        description: 'Highest score achieved',
        example: 98.5,
    })
    @IsNumber()
    highestScore: number;

    @ApiProperty({
        description: 'Lowest score achieved',
        example: 32.0,
    })
    @IsNumber()
    lowestScore: number;

    @ApiProperty({
        description: 'Score standard deviation',
        example: 18.3,
    })
    @IsNumber()
    scoreStandardDeviation: number;

    @ApiProperty({
        description: 'Most challenging question (lowest success rate)',
        example: 'Question 15: Complex Integration',
    })
    @IsString()
    @IsOptional()
    mostChallengingQuestion?: string;

    @ApiProperty({
        description: 'Easiest question (highest success rate)',
        example: 'Question 1: Basic Addition',
    })
    @IsString()
    @IsOptional()
    easiestQuestion?: string;

    @ApiProperty({
        description: 'Average time per question in seconds',
        example: 120.5,
    })
    @IsNumber()
    averageTimePerQuestion: number;
}

export class TestQualityDto {
    @ApiProperty({
        description: 'Test difficulty score (0-100)',
        example: 65.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    difficultyScore: number;

    @ApiProperty({
        description: 'Test reliability coefficient',
        example: 0.85,
        minimum: 0,
        maximum: 1,
    })
    @IsNumber()
    reliabilityCoefficient: number;

    @ApiProperty({
        description:
            'Discrimination index (how well test distinguishes performance)',
        example: 0.72,
        minimum: 0,
        maximum: 1,
    })
    @IsNumber()
    discriminationIndex: number;

    @ApiProperty({
        description: 'Percentage of questions with good discrimination',
        example: 78.5,
    })
    @IsNumber()
    effectiveQuestionsPercentage: number;

    @ApiProperty({
        description: 'Optimal duration recommendation in minutes',
        example: 50,
    })
    @IsNumber()
    optimalDurationMinutes: number;

    @ApiProperty({
        description: 'Time pressure factor (based on completion patterns)',
        example: 'moderate',
        enum: ['low', 'moderate', 'high'],
    })
    @IsString()
    timePressureFactor: string;
}

export class TestAnalyticsResponseDto {
    @ApiProperty({
        description: 'Test basic statistics',
        type: TestStatsDto,
    })
    stats: TestStatsDto;

    @ApiProperty({
        description: 'Test performance metrics',
        type: TestPerformanceDto,
    })
    performance: TestPerformanceDto;

    @ApiProperty({
        description: 'Test quality metrics',
        type: TestQualityDto,
    })
    quality: TestQualityDto;

    @ApiProperty({
        description: 'Timestamp when the report was generated',
        example: '2025-01-15T10:30:45.123Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether this data is from cache',
        example: true,
    })
    cached: boolean;
}

export class GlobalTestStatsDto {
    @ApiProperty({
        description: 'Total number of tests in the system',
        example: 45,
    })
    @IsNumber()
    totalTests: number;

    @ApiProperty({
        description: 'Total test attempts across all tests',
        example: 1250,
    })
    @IsNumber()
    totalAttempts: number;

    @ApiProperty({
        description: 'Tests taken today',
        example: 85,
    })
    @IsNumber()
    testsToday: number;

    @ApiProperty({
        description: 'Tests taken this week',
        example: 420,
    })
    @IsNumber()
    testsThisWeek: number;

    @ApiProperty({
        description: 'Average test completion rate across all tests',
        example: 78.5,
    })
    @IsNumber()
    averageCompletionRate: number;

    @ApiProperty({
        description: 'Average score across all tests',
        example: 75.2,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Most popular test type',
        example: 'QUIZ',
    })
    @IsString()
    mostPopularTestType: string;

    @ApiProperty({
        description: 'Peak testing hours (hour of day)',
        example: [14, 15, 16],
        type: [Number],
    })
    peakTestingHours: number[];
}
