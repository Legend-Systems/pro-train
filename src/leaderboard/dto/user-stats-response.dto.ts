import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';
import { LeaderboardResponseDto } from './leaderboard-response.dto';

class PerformanceTrends {
    @ApiProperty({
        description: 'Overall performance trend over time',
        enum: ['improving', 'declining', 'stable'],
        example: 'improving',
    })
    @Expose()
    overallTrend: string;

    @ApiProperty({
        description: 'Score improvement over last 30 days',
        example: 12.5,
    })
    @Expose()
    scoreImprovement: number;

    @ApiProperty({
        description: 'Rank improvement trend (average change per month)',
        example: 2.3,
    })
    @Expose()
    rankImprovementTrend: number;

    @ApiProperty({
        description: 'Consistency score (1-5, higher is more consistent)',
        example: 4,
        minimum: 1,
        maximum: 5,
    })
    @Expose()
    consistencyScore: number;

    @ApiProperty({
        description: 'Activity streak (consecutive days with activity)',
        example: 15,
        minimum: 0,
    })
    @Expose()
    activityStreak: number;

    @ApiProperty({
        description: 'Peak performance period (last best performance)',
        example: '2024-12-15',
    })
    @Expose()
    peakPerformanceDate: Date;
}

class GlobalAchievements {
    @ApiProperty({
        description: 'Total achievement badges earned',
        example: [
            'champion',
            'consistent_performer',
            'dedicated_learner',
            'high_scorer',
        ],
        isArray: true,
    })
    @Expose()
    totalBadges: string[];

    @ApiProperty({
        description: 'Global recognition titles',
        example: [
            'Top 5% Globally',
            'Most Improved Student',
            'Perfect Score Achiever',
        ],
        isArray: true,
    })
    @Expose()
    globalRecognitions: string[];

    @ApiProperty({
        description: 'Major milestones achieved',
        example: [
            '100 Tests Completed',
            'First Perfect Score',
            '6 Month Streak',
        ],
        isArray: true,
    })
    @Expose()
    majorMilestones: string[];

    @ApiProperty({
        description: 'Achievement level across all courses',
        enum: ['beginner', 'intermediate', 'advanced', 'expert', 'master'],
        example: 'advanced',
    })
    @Expose()
    globalAchievementLevel: string;

    @ApiProperty({
        description: 'Next achievement goal',
        example: 'Reach Expert Level (90%+ average)',
        required: false,
    })
    @Expose()
    nextGoal?: string;
}

class ComparativeMetrics {
    @ApiProperty({
        description: 'Percentile ranking globally',
        example: 85,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    globalPercentile: number;

    @ApiProperty({
        description: 'Average rank across all courses',
        example: 3.5,
        minimum: 1,
    })
    @Expose()
    averageRank: number;

    @ApiProperty({
        description: 'Percentage above global average',
        example: 18.7,
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const userScore = Number(obj?.averageScore) || 0;
        const globalAverage = 75; // Could be calculated from database
        return Math.round((userScore - globalAverage) * 100) / 100;
    })
    scoreAboveGlobalAverage: number;

    @ApiProperty({
        description: 'Completion rate across all enrolled courses',
        example: 92.3,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    overallCompletionRate: number;

    @ApiProperty({
        description: 'Time efficiency rating (1-5, based on time per test)',
        example: 4,
        minimum: 1,
        maximum: 5,
    })
    @Expose()
    timeEfficiencyRating: number;
}

class LearningInsights {
    @ApiProperty({
        description: 'Strongest subject/category based on performance',
        example: 'Mathematics',
    })
    @Expose()
    strongestSubject: string;

    @ApiProperty({
        description: 'Subject needing improvement',
        example: 'Physics',
    })
    @Expose()
    improvementSubject: string;

    @ApiProperty({
        description: 'Optimal study time (hours per week for best performance)',
        example: 12,
    })
    @Expose()
    optimalStudyTime: number;

    @ApiProperty({
        description: 'Learning velocity (tests completed per month)',
        example: 8.5,
    })
    @Expose()
    learningVelocity: number;

    @ApiProperty({
        description: 'Knowledge retention score (1-5)',
        example: 4,
        minimum: 1,
        maximum: 5,
    })
    @Expose()
    knowledgeRetention: number;

    @ApiProperty({
        description: 'Recommended next courses based on performance',
        example: ['Advanced Calculus', 'Linear Algebra', 'Statistics'],
        isArray: true,
    })
    @Expose()
    recommendedCourses: string[];
}

export class UserStatsResponseDto {
    @ApiProperty({
        description: 'Total points earned across all courses',
        example: 1250.75,
        minimum: 0,
    })
    @Expose()
    totalPoints: number;

    @ApiProperty({
        description: 'Total number of tests completed across all courses',
        example: 15,
        minimum: 0,
    })
    @Expose()
    totalTestsCompleted: number;

    @ApiProperty({
        description: 'Overall average score across all tests',
        example: 88.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    averageScore: number;

    @ApiProperty({
        description: 'Number of courses the user is enrolled in',
        example: 3,
        minimum: 0,
    })
    @Expose()
    coursesEnrolled: number;

    @ApiProperty({
        description: 'Best rank achieved across all courses',
        example: 2,
        minimum: 1,
        nullable: true,
    })
    @Expose()
    bestRank: number | null;

    @ApiProperty({
        description: 'Recent activity in the last 5 courses',
        type: [LeaderboardResponseDto],
        isArray: true,
    })
    @Expose()
    recentActivity: LeaderboardResponseDto[];

    @ApiProperty({
        description: 'Number of courses completed (100% test completion)',
        example: 2,
        minimum: 0,
    })
    @Expose()
    coursesCompleted: number;

    @ApiProperty({
        description: 'Total study time in hours (estimated)',
        example: 156.5,
        minimum: 0,
    })
    @Expose()
    totalStudyHours: number;

    @ApiProperty({
        description: 'Current active learning streak in days',
        example: 23,
        minimum: 0,
    })
    @Expose()
    currentStreak: number;

    @ApiProperty({
        description: 'Longest learning streak achieved in days',
        example: 45,
        minimum: 0,
    })
    @Expose()
    longestStreak: number;

    @ApiProperty({
        description: 'Overall letter grade across all courses',
        example: 'B+',
    })
    @Expose()
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const percentage = Number(obj?.averageScore) || 0;
        if (percentage >= 97) return 'A+';
        if (percentage >= 93) return 'A';
        if (percentage >= 90) return 'A-';
        if (percentage >= 87) return 'B+';
        if (percentage >= 83) return 'B';
        if (percentage >= 80) return 'B-';
        if (percentage >= 77) return 'C+';
        if (percentage >= 73) return 'C';
        if (percentage >= 70) return 'C-';
        if (percentage >= 67) return 'D+';
        if (percentage >= 63) return 'D';
        if (percentage >= 60) return 'D-';
        return 'F';
    })
    overallGrade: string;

    @ApiProperty({
        description: 'User account registration date',
        example: '2024-01-15T00:00:00.000Z',
    })
    @Expose()
    memberSince: Date;

    @ApiProperty({
        description: 'Last activity timestamp',
        example: '2025-01-16T14:30:00.000Z',
    })
    @Expose()
    lastActivity: Date;

    @ApiProperty({
        description: 'Performance trends and analytics',
        type: PerformanceTrends,
    })
    @Expose()
    performanceTrends: PerformanceTrends;

    @ApiProperty({
        description: 'Global achievements and recognition',
        type: GlobalAchievements,
    })
    @Expose()
    globalAchievements: GlobalAchievements;

    @ApiProperty({
        description: 'Comparative performance metrics',
        type: ComparativeMetrics,
    })
    @Expose()
    comparativeMetrics: ComparativeMetrics;

    @ApiProperty({
        description: 'Personalized learning insights and recommendations',
        type: LearningInsights,
    })
    @Expose()
    learningInsights: LearningInsights;

    @ApiProperty({
        description: 'Whether user is in top 10% globally',
        example: true,
    })
    @Expose()
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const percentile = Number(obj?.globalPercentile) || 0;
        return percentile >= 90;
    })
    isTopPerformer: boolean;

    @ApiProperty({
        description: 'Estimated next rank up timeframe in days',
        example: 14,
        required: false,
    })
    @Expose()
    estimatedImprovementDays?: number;

    @ApiProperty({
        description: 'Gamification level (1-100 based on overall performance)',
        example: 67,
        minimum: 1,
        maximum: 100,
    })
    @Expose()
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const score = Number(obj?.averageScore) || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const completed = Number(obj?.totalTestsCompleted) || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const streak = Number(obj?.currentStreak) || 0;

        // Complex calculation based on multiple factors
        const scoreComponent = (score / 100) * 40;
        const activityComponent = Math.min((completed / 50) * 30, 30);
        const streakComponent = Math.min((streak / 30) * 30, 30);
        
        return Math.round(scoreComponent + activityComponent + streakComponent);
    })
    gamificationLevel: number;
}
