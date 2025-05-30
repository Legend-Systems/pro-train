import { ApiProperty } from '@nestjs/swagger';

export class TrainingProgressStatsReportDto {
    @ApiProperty({
        description: 'Total number of courses enrolled',
        example: 8,
    })
    totalCourses: number;

    @ApiProperty({
        description: 'Number of completed courses',
        example: 3,
    })
    completedCourses: number;

    @ApiProperty({
        description: 'Average completion percentage across all courses',
        example: 72.5,
    })
    averageCompletion: number;

    @ApiProperty({
        description: 'Total time spent learning (in minutes)',
        example: 1250,
    })
    totalTimeSpent: number;

    @ApiProperty({
        description: 'Recent activity count (last 7 days)',
        example: 5,
    })
    recentActivity: number;
}

export class LearningVelocityTrendDto {
    @ApiProperty({
        description: 'Date of the learning data',
        type: 'string',
        format: 'date',
        example: '2024-01-15',
    })
    date: string;

    @ApiProperty({
        description: 'Average completion percentage for that date',
        example: 78.5,
    })
    averageCompletion: number;
}

export class CourseProgressReportDto {
    @ApiProperty({
        description: 'Course name',
        example: 'Advanced Mathematics',
    })
    courseName: string;

    @ApiProperty({
        description: 'Completion percentage',
        example: 85.5,
    })
    completionPercentage: number;

    @ApiProperty({
        description: 'Time spent on this course (in minutes)',
        example: 420,
    })
    timeSpent: number;
}

export class TrainingProgressPerformanceReportDto {
    @ApiProperty({
        description: 'Learning velocity trends over time',
        type: [LearningVelocityTrendDto],
    })
    learningVelocity: LearningVelocityTrendDto[];

    @ApiProperty({
        description: 'Progress by course',
        type: [CourseProgressReportDto],
    })
    courseProgress: CourseProgressReportDto[];
}

export class TrainingProgressAnalyticsReportDto {
    @ApiProperty({
        description: 'Training progress statistics',
        type: TrainingProgressStatsReportDto,
    })
    stats: TrainingProgressStatsReportDto;

    @ApiProperty({
        description: 'Performance insights and trends',
        type: TrainingProgressPerformanceReportDto,
    })
    performance: TrainingProgressPerformanceReportDto;

    @ApiProperty({
        description: 'Timestamp when the analytics were generated',
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether the data was retrieved from cache',
        example: false,
    })
    cached: boolean;
}

export class CompletionDistributionDto {
    @ApiProperty({
        description: 'Number of completed courses (100%)',
        example: 25,
    })
    completed: number;

    @ApiProperty({
        description: 'Number of nearly completed courses (75-99%)',
        example: 18,
    })
    nearlyCompleted: number;

    @ApiProperty({
        description: 'Number of halfway completed courses (50-74%)',
        example: 22,
    })
    halfway: number;

    @ApiProperty({
        description: 'Number of started courses (25-49%)',
        example: 35,
    })
    started: number;

    @ApiProperty({
        description: 'Number of just started courses (0-24%)',
        example: 45,
    })
    justStarted: number;
}

export class PopularLearningPathDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Introduction to Data Science',
    })
    title: string;

    @ApiProperty({
        description: 'Number of enrollments',
        example: 156,
    })
    enrollments: number;

    @ApiProperty({
        description: 'Average completion percentage',
        example: 68.5,
    })
    averageCompletion: number;
}

export class LearningVelocityGlobalTrendDto {
    @ApiProperty({
        description: 'Date of the velocity data',
        type: 'string',
        format: 'date',
        example: '2024-01-15',
    })
    date: string;

    @ApiProperty({
        description: 'Average completion percentage across all users',
        example: 72.3,
    })
    averageCompletion: number;

    @ApiProperty({
        description: 'Number of active users on that date',
        example: 45,
    })
    activeUsers: number;
}

export class GlobalTrainingProgressStatsReportDto {
    @ApiProperty({
        description: 'Total number of learning paths',
        example: 1847,
    })
    totalLearningPaths: number;

    @ApiProperty({
        description: 'Average completion percentage across all paths',
        example: 58.7,
    })
    averageCompletion: number;

    @ApiProperty({
        description: 'Number of active learners (last 7 days)',
        example: 285,
    })
    activeLearners: number;

    @ApiProperty({
        description: 'Completion distribution across different stages',
        type: CompletionDistributionDto,
    })
    completionDistribution: CompletionDistributionDto;

    @ApiProperty({
        description: 'Most popular learning paths by enrollment',
        type: [PopularLearningPathDto],
    })
    popularLearningPaths: PopularLearningPathDto[];

    @ApiProperty({
        description: 'Learning velocity trends over time',
        type: [LearningVelocityGlobalTrendDto],
    })
    learningVelocityTrends: LearningVelocityGlobalTrendDto[];

    @ApiProperty({
        description: 'Timestamp when the statistics were generated',
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00Z',
    })
    generatedAt: Date;

    @ApiProperty({
        description: 'Whether the data was retrieved from cache',
        example: false,
    })
    cached: boolean;
}

export class LearningPathCompletionReportDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Advanced JavaScript',
    })
    title: string;

    @ApiProperty({
        description: 'Completion percentage',
        example: 75.5,
    })
    completionPercentage: number;

    @ApiProperty({
        description: 'Current module or chapter',
        example: 'Module 8: Async Programming',
    })
    currentModule: string;

    @ApiProperty({
        description: 'Time spent on this course (in minutes)',
        example: 420,
    })
    timeSpent: number;

    @ApiProperty({
        description: 'Last activity timestamp',
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T14:30:00Z',
    })
    lastActivity: Date;

    @ApiProperty({
        description: 'Estimated time to complete (in minutes)',
        example: 140,
    })
    estimatedTimeToComplete: number;
}

export class SkillDevelopmentReportDto {
    @ApiProperty({
        description: 'Skill area or subject',
        example: 'JavaScript Programming',
    })
    skillArea: string;

    @ApiProperty({
        description: 'Current skill level',
        enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
        example: 'Intermediate',
    })
    skillLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

    @ApiProperty({
        description: 'Progress percentage in this skill area',
        example: 68.5,
    })
    progressPercentage: number;

    @ApiProperty({
        description: 'Average test score in this skill area',
        example: 78.3,
    })
    averageTestScore: number;

    @ApiProperty({
        description: 'Total number of test attempts',
        example: 12,
    })
    totalAttempts: number;

    @ApiProperty({
        description: 'Time spent learning this skill (in minutes)',
        example: 680,
    })
    timeSpent: number;

    @ApiProperty({
        description: 'Improvement rate score (0-100)',
        example: 85.2,
    })
    improvementRate: number;
}

export class ProgressMilestoneReportDto {
    @ApiProperty({
        description: 'Course name',
        example: 'React Development Fundamentals',
    })
    courseName: string;

    @ApiProperty({
        description: 'Current progress percentage',
        example: 65.0,
    })
    currentProgress: number;

    @ApiProperty({
        description: 'Current module or chapter',
        example: 'Module 5: State Management',
    })
    currentModule: string;

    @ApiProperty({
        description: 'List of achieved milestones',
        type: [String],
        example: ['Getting Started', 'Halfway Point'],
    })
    milestonesAchieved: string[];

    @ApiProperty({
        description: 'Next milestone to achieve',
        example: 'Almost There',
    })
    nextMilestone: string;

    @ApiProperty({
        description: 'Last update timestamp',
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T16:45:00Z',
    })
    lastUpdate: Date;
}
