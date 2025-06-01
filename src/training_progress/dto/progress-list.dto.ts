import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, IsDate, ValidateNested } from 'class-validator';

export class ProgressEntryDto {
    @ApiProperty({
        description: 'Progress ID',
        example: 1,
    })
    @IsNumber()
    progressId: number;

    @ApiProperty({
        description: 'User ID',
        example: 'user-123',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description: 'User first name',
        example: 'John',
    })
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    @IsString()
    lastName: string;

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
        description: 'Test ID (if specific to a test)',
        example: 1,
        nullable: true,
    })
    @IsNumber()
    testId: number | null;

    @ApiProperty({
        description: 'Test title (if specific to a test)',
        example: 'JavaScript Fundamentals Quiz',
        nullable: true,
    })
    @IsString()
    testTitle: string | null;

    @ApiProperty({
        description: 'Completion percentage',
        example: 75.5,
    })
    @IsNumber()
    completionPercentage: number;

    @ApiProperty({
        description: 'Time spent in minutes',
        example: 120,
    })
    @IsNumber()
    timeSpentMinutes: number;

    @ApiProperty({
        description: 'Questions completed',
        example: 15,
    })
    @IsNumber()
    questionsCompleted: number;

    @ApiProperty({
        description: 'Total questions available',
        example: 20,
    })
    @IsNumber()
    totalQuestions: number;

    @ApiProperty({
        description: 'Progress status',
        example: 'in_progress',
        enum: ['not_started', 'in_progress', 'completed', 'paused'],
    })
    @IsString()
    status: string;

    @ApiProperty({
        description: 'Last updated date',
        example: '2025-01-15T14:30:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    lastUpdated: Date;

    @ApiProperty({
        description: 'Estimated completion time (in minutes)',
        example: 40,
    })
    @IsNumber()
    estimatedTimeToComplete: number;

    @ApiProperty({
        description: 'Learning pace (slow/normal/fast)',
        example: 'normal',
        enum: ['slow', 'normal', 'fast'],
    })
    @IsString()
    learningPace: string;
}

export class ProgressSummaryDto {
    @ApiProperty({
        description: 'Total number of users',
        example: 150,
    })
    @IsNumber()
    totalUsers: number;

    @ApiProperty({
        description: 'Number of users who started',
        example: 135,
    })
    @IsNumber()
    usersStarted: number;

    @ApiProperty({
        description: 'Number of users who completed',
        example: 85,
    })
    @IsNumber()
    usersCompleted: number;

    @ApiProperty({
        description: 'Average completion percentage',
        example: 68.5,
    })
    @IsNumber()
    averageCompletion: number;

    @ApiProperty({
        description: 'Average time spent across all users (minutes)',
        example: 145.2,
    })
    @IsNumber()
    averageTimeSpent: number;

    @ApiProperty({
        description: 'Completion rate percentage',
        example: 62.9,
    })
    @IsNumber()
    completionRate: number;

    @ApiProperty({
        description: 'Average learning pace distribution',
        example: { slow: 25, normal: 65, fast: 10 },
    })
    paceDistribution: {
        slow: number;
        normal: number;
        fast: number;
    };
}

export class ProgressListDto {
    @ApiProperty({
        description: 'Array of progress entries',
        type: [ProgressEntryDto],
    })
    @ValidateNested({ each: true })
    @Type(() => ProgressEntryDto)
    progress: ProgressEntryDto[];

    @ApiProperty({
        description: 'Progress summary statistics',
        type: ProgressSummaryDto,
    })
    @ValidateNested()
    @Type(() => ProgressSummaryDto)
    summary: ProgressSummaryDto;

    @ApiProperty({
        description: 'Total number of progress entries',
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
        description: 'Number of entries per page',
        example: 20,
    })
    @IsNumber()
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 8,
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
