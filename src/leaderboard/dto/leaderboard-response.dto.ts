import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

class ComprehensiveUserInfo {
    @ApiProperty({
        description: 'User ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    id: string;

    @ApiProperty({
        description: 'Username',
        example: 'johndoe',
    })
    @Expose()
    username: string;

    @ApiProperty({
        description: 'User first name',
        example: 'John',
    })
    @Expose()
    firstName: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    @Expose()
    lastName: string;

    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
    })
    @Expose()
    email: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const firstName = (obj?.firstName as string) || '';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const lastName = (obj?.lastName as string) || '';
        return (
            `${firstName} ${lastName}`.trim() ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (obj?.username as string) ||
            'Unknown User'
        );
    })
    fullName: string;

    @ApiProperty({
        description: 'User role',
        example: 'student',
    })
    @Expose()
    role: string;

    @ApiProperty({
        description: 'User status',
        example: 'active',
    })
    @Expose()
    status: string;

    @ApiProperty({
        description: 'User profile picture URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
    })
    @Expose()
    profilePicture?: string;

    @ApiProperty({
        description: 'User phone number',
        example: '+1234567890',
        required: false,
    })
    @Expose()
    phoneNumber?: string;

    @ApiProperty({
        description: 'User registration date',
        example: '2024-01-01T00:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Achievement level based on performance',
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        example: 'intermediate',
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const score = Number(obj?.averageScore) || 0;
        if (score >= 90) return 'expert';
        if (score >= 80) return 'advanced';
        if (score >= 70) return 'intermediate';
        return 'beginner';
    })
    achievementLevel: string;
}

class DetailedCourseInfo {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Advanced Mathematics',
    })
    @Expose()
    title: string;

    @ApiProperty({
        description: 'Course description',
        example: 'Advanced mathematics course covering calculus and algebra',
    })
    @Expose()
    description: string;

    @ApiProperty({
        description: 'Course code/identifier',
        example: 'MATH-401',
    })
    @Expose()
    courseCode: string;

    @ApiProperty({
        description: 'Course category',
        example: 'Mathematics',
    })
    @Expose()
    category: string;

    @ApiProperty({
        description: 'Course duration in hours',
        example: 40,
    })
    @Expose()
    durationHours: number;

    @ApiProperty({
        description: 'Course difficulty level',
        example: 'advanced',
    })
    @Expose()
    difficultyLevel: string;

    @ApiProperty({
        description: 'Course status',
        example: 'active',
    })
    @Expose()
    status: string;

    @ApiProperty({
        description: 'Course thumbnail URL',
        example: 'https://example.com/course-thumb.jpg',
        required: false,
    })
    @Expose()
    thumbnailUrl?: string;

    @ApiProperty({
        description: 'Number of enrolled students in this course',
        example: 25,
    })
    @Expose()
    enrolledStudents: number;

    @ApiProperty({
        description: 'Total number of tests in this course',
        example: 8,
    })
    @Expose()
    totalTests: number;

    @ApiProperty({
        description: 'Course creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    @Expose()
    createdAt: Date;
}

class PerformanceAnalytics {
    @ApiProperty({
        description: 'Rank improvement since last update',
        example: 3,
    })
    @Expose()
    rankChange: number;

    @ApiProperty({
        description: 'Previous rank for comparison',
        example: 8,
        required: false,
    })
    @Expose()
    previousRank?: number;

    @ApiProperty({
        description: 'Percentage better than class average',
        example: 15.5,
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const userScore = Number(obj?.averageScore) || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const classAverage = Number(obj?.classAverageScore) || 0;
        return Math.round((userScore - classAverage) * 100) / 100;
    })
    scoreDifferenceFromAverage: number;

    @ApiProperty({
        description: 'Percentile ranking (0-100)',
        example: 78,
    })
    @Expose()
    percentileRank: number;

    @ApiProperty({
        description: 'Completion rate percentage',
        example: 87.5,
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const completed = Number(obj?.testsCompleted) || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const total = Number(obj?.totalTestsInCourse) || 1;
        return Math.round((completed / total) * 100 * 100) / 100;
    })
    completionRate: number;

    @ApiProperty({
        description: 'Consistency rating (1-5 based on score variance)',
        example: 4,
    })
    @Expose()
    consistencyRating: number;

    @ApiProperty({
        description: 'Improvement trend (positive/negative/stable)',
        enum: ['improving', 'declining', 'stable'],
        example: 'improving',
    })
    @Expose()
    trend: string;

    @ApiProperty({
        description: 'Days since last test completion',
        example: 3,
    })
    @Expose()
    daysSinceLastActivity: number;

    @ApiProperty({
        description: 'Estimated position to reach next rank',
        example: 2.5,
        required: false,
    })
    @Expose()
    pointsToNextRank?: number;
}

class AchievementBadges {
    @ApiProperty({
        description: 'Achievement badges earned',
        example: ['high_scorer', 'consistent_performer', 'quick_learner'],
        isArray: true,
    })
    @Expose()
    badges: string[];

    @ApiProperty({
        description: 'Special recognition titles',
        example: ['Top 10%', 'Most Improved'],
        isArray: true,
    })
    @Expose()
    recognitions: string[];

    @ApiProperty({
        description: 'Milestone achievements',
        example: ['First Place', '10 Tests Completed', 'Perfect Score'],
        isArray: true,
    })
    @Expose()
    milestones: string[];
}

export class LeaderboardResponseDto {
    @ApiProperty({
        description: 'Leaderboard entry unique identifier',
        example: 1,
    })
    @Expose()
    leaderboardId: number;

    @ApiProperty({
        description: 'Course ID for this leaderboard entry',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'User ID for this leaderboard entry',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    userId: string;

    @ApiProperty({
        description: 'User rank in the course leaderboard',
        example: 1,
        minimum: 1,
    })
    @Expose()
    rank: number;

    @ApiProperty({
        description: 'Average score across all tests in the course',
        example: 92.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    averageScore: number;

    @ApiProperty({
        description: 'Total number of tests completed in the course',
        example: 5,
        minimum: 0,
    })
    @Expose()
    testsCompleted: number;

    @ApiProperty({
        description: 'Total points earned across all tests',
        example: 462.5,
        minimum: 0,
    })
    @Expose()
    totalPoints: number;

    @ApiProperty({
        description: 'When the leaderboard entry was last updated',
        example: '2025-01-01T12:00:00.000Z',
    })
    @Expose()
    lastUpdated: Date;

    @ApiProperty({
        description: 'Leaderboard entry creation timestamp',
        example: '2025-01-01T09:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Leaderboard entry last update timestamp',
        example: '2025-01-01T12:00:00.000Z',
    })
    @Expose()
    updatedAt: Date;

    @ApiProperty({
        description: 'Comprehensive user information with achievement data',
        type: ComprehensiveUserInfo,
    })
    @Expose()
    user: ComprehensiveUserInfo;

    @ApiProperty({
        description: 'Detailed course information with statistics',
        type: DetailedCourseInfo,
    })
    @Expose()
    course: DetailedCourseInfo;

    @ApiProperty({
        description: 'Performance analytics and competitive insights',
        type: PerformanceAnalytics,
    })
    @Expose()
    performanceAnalytics: PerformanceAnalytics;

    @ApiProperty({
        description: 'Achievement badges and recognition',
        type: AchievementBadges,
    })
    @Expose()
    achievements: AchievementBadges;

    @ApiProperty({
        description: 'Letter grade based on average score',
        example: 'A-',
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    letterGrade: string;

    @ApiProperty({
        description: 'Whether user is above class average',
        example: true,
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const userScore = Number(obj?.averageScore) || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const classAverage = Number(obj?.classAverageScore) || 0;
        return userScore > classAverage;
    })
    aboveAverage: boolean;

    @ApiProperty({
        description: 'Estimated time to improve to next rank (in days)',
        example: 7,
        required: false,
    })
    @Expose()
    estimatedDaysToNextRank?: number;

    @ApiProperty({
        description: 'Competition status in this course',
        enum: ['active', 'inactive', 'completed'],
        example: 'active',
    })
    @Expose()
    competitionStatus: string;
}
