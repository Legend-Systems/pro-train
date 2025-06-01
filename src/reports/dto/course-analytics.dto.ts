import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CourseStatsDto {
    @ApiProperty({
        description: 'Total number of students enrolled in the course',
        example: 125,
    })
    @IsNumber()
    totalStudentsEnrolled: number;

    @ApiProperty({
        description: 'Course completion rate as percentage',
        example: 78.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    completionRate: number;

    @ApiProperty({
        description: 'Average study duration in hours',
        example: 45.2,
    })
    @IsNumber()
    averageStudyDurationHours: number;

    @ApiProperty({
        description:
            'Course popularity score based on enrollments and completions',
        example: 85.7,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    popularityScore: number;

    @ApiProperty({
        description: 'Total number of tests in the course',
        example: 8,
    })
    @IsNumber()
    totalTests: number;

    @ApiProperty({
        description: 'Average test score across all students',
        example: 82.3,
    })
    @IsNumber()
    averageTestScore: number;
}

export class CoursePerformanceDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Introduction to Computer Science',
    })
    @IsString()
    courseTitle: string;

    @ApiProperty({
        description: 'Total number of test attempts in the course',
        example: 450,
    })
    @IsNumber()
    totalAttempts: number;

    @ApiProperty({
        description: 'Success rate percentage for first attempts',
        example: 65.5,
    })
    @IsNumber()
    firstAttemptSuccessRate: number;

    @ApiProperty({
        description: 'Average number of attempts per student',
        example: 2.3,
    })
    @IsNumber()
    averageAttemptsPerStudent: number;

    @ApiProperty({
        description: 'Most challenging test in the course',
        example: 'Final Exam',
        required: false,
    })
    @IsString()
    @IsOptional()
    mostChallengingTest?: string;
}

export class CourseAnalyticsResponseDto {
    @ApiProperty({
        description: 'Course basic statistics',
        type: CourseStatsDto,
    })
    stats: CourseStatsDto;

    @ApiProperty({
        description: 'Course performance metrics',
        type: CoursePerformanceDto,
    })
    performance: CoursePerformanceDto;

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
