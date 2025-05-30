import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, IsArray, ValidateNested } from 'class-validator';

export class LearningTrendDto {
    @ApiProperty({
        description: 'Time period (week/month)',
        example: '2024-W03',
    })
    @IsString()
    period: string;

    @ApiProperty({
        description: 'Average completion percentage for this period',
        example: 65.5,
    })
    @IsNumber()
    averageCompletion: number;

    @ApiProperty({
        description: 'Total time spent in this period (minutes)',
        example: 1200,
    })
    @IsNumber()
    totalTimeSpent: number;

    @ApiProperty({
        description: 'Number of active learners',
        example: 45,
    })
    @IsNumber()
    activeLearners: number;

    @ApiProperty({
        description: 'Number of questions completed',
        example: 350,
    })
    @IsNumber()
    questionsCompleted: number;
}

export class CourseProgressBreakdownDto {
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
        description: 'Total enrolled users',
        example: 120,
    })
    @IsNumber()
    totalEnrolled: number;

    @ApiProperty({
        description: 'Users who started',
        example: 100,
    })
    @IsNumber()
    usersStarted: number;

    @ApiProperty({
        description: 'Users who completed',
        example: 65,
    })
    @IsNumber()
    usersCompleted: number;

    @ApiProperty({
        description: 'Average completion percentage',
        example: 72.5,
    })
    @IsNumber()
    averageCompletion: number;

    @ApiProperty({
        description: 'Average time per user (minutes)',
        example: 180,
    })
    @IsNumber()
    averageTimePerUser: number;

    @ApiProperty({
        description: 'Completion rate percentage',
        example: 65.0,
    })
    @IsNumber()
    completionRate: number;
}

export class LearningPathAnalysisDto {
    @ApiProperty({
        description: 'Test ID',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'JavaScript Fundamentals',
    })
    @IsString()
    testTitle: string;

    @ApiProperty({
        description: 'Average time to complete (minutes)',
        example: 45.5,
    })
    @IsNumber()
    averageCompletionTime: number;

    @ApiProperty({
        description: 'Difficulty rating (1-5)',
        example: 3.2,
    })
    @IsNumber()
    difficultyRating: number;

    @ApiProperty({
        description: 'Success rate percentage',
        example: 78.5,
    })
    @IsNumber()
    successRate: number;

    @ApiProperty({
        description: 'Common struggle areas',
        example: ['Async/Await', 'Closures', 'Prototypes'],
    })
    @IsArray()
    struggleAreas: string[];
}

export class PersonalizedInsightsDto {
    @ApiProperty({
        description: 'User ID',
        example: 'user-123',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description: 'Learning style identified',
        example: 'visual',
        enum: ['visual', 'auditory', 'kinesthetic', 'reading'],
    })
    @IsString()
    learningStyle: string;

    @ApiProperty({
        description: 'Optimal learning pace (questions per hour)',
        example: 12.5,
    })
    @IsNumber()
    optimalPace: number;

    @ApiProperty({
        description: 'Best performance time of day',
        example: 'morning',
        enum: ['morning', 'afternoon', 'evening'],
    })
    @IsString()
    bestPerformanceTime: string;

    @ApiProperty({
        description: 'Recommended next topics',
        example: ['Advanced JavaScript', 'React Fundamentals'],
    })
    @IsArray()
    recommendedTopics: string[];

    @ApiProperty({
        description: 'Weak areas needing attention',
        example: ['Array Methods', 'DOM Manipulation'],
    })
    @IsArray()
    weakAreas: string[];

    @ApiProperty({
        description: 'Strong areas',
        example: ['Variables', 'Functions', 'Loops'],
    })
    @IsArray()
    strongAreas: string[];
}

export class ProgressAnalyticsDto {
    @ApiProperty({
        description: 'Overall analytics summary',
    })
    @ValidateNested()
    @Type(() => Object)
    overview: {
        totalUsers: number;
        activeUsers: number;
        averageProgress: number;
        totalTimeSpent: number;
        completionRate: number;
    };

    @ApiProperty({
        description: 'Learning trends over time',
        type: [LearningTrendDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LearningTrendDto)
    learningTrends: LearningTrendDto[];

    @ApiProperty({
        description: 'Progress breakdown by course',
        type: [CourseProgressBreakdownDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CourseProgressBreakdownDto)
    courseBreakdown: CourseProgressBreakdownDto[];

    @ApiProperty({
        description: 'Learning path analysis',
        type: [LearningPathAnalysisDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LearningPathAnalysisDto)
    learningPathAnalysis: LearningPathAnalysisDto[];

    @ApiProperty({
        description: 'Personalized insights (if user-specific)',
        type: PersonalizedInsightsDto,
        nullable: true,
    })
    @ValidateNested()
    @Type(() => PersonalizedInsightsDto)
    personalizedInsights?: PersonalizedInsightsDto;

    @ApiProperty({
        description: 'Performance predictions',
    })
    predictions: {
        estimatedCompletionDate: string;
        successProbability: number;
        recommendedStudyHours: number;
    };
}
