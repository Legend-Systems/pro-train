import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

class UserInfo {
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
        description: 'User full name (computed from first and last name)',
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
        description: 'User role in the system',
        example: 'student',
        enum: ['student', 'instructor', 'admin'],
    })
    @Expose()
    role: string;

    @ApiProperty({
        description: 'User account status',
        example: 'active',
        enum: ['active', 'inactive', 'suspended'],
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
        description: 'User account registration date',
        example: '2024-01-01T00:00:00.000Z',
    })
    @Expose()
    createdAt: Date;
}

class InstructorInfo {
    @ApiProperty({
        description: 'Instructor ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    id: string;

    @ApiProperty({
        description: 'Instructor full name (computed)',
        example: 'Dr. Jane Smith',
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
            'Unknown Instructor'
        );
    })
    fullName: string;

    @ApiProperty({
        description: 'Instructor email address',
        example: 'jane.smith@example.com',
    })
    @Expose()
    email: string;
}

class TestInfo {
    @ApiProperty({
        description: 'Test unique identifier',
        example: 1,
    })
    @Expose()
    testId: number;

    @ApiProperty({
        description: 'Test title',
        example: 'Advanced Mathematics Quiz',
    })
    @Expose()
    title: string;

    @ApiProperty({
        description: 'Test description',
        example: 'Comprehensive quiz covering advanced mathematical concepts',
    })
    @Expose()
    description: string;

    @ApiProperty({
        description: 'Test type classification',
        enum: ['exam', 'quiz', 'training', 'assessment', 'practice'],
        example: 'quiz',
    })
    @Expose()
    testType: string;

    @ApiProperty({
        description: 'Test duration in minutes',
        example: 60,
        minimum: 1,
    })
    @Expose()
    durationMinutes: number;

    @ApiProperty({
        description: 'Maximum allowed attempts for this test',
        example: 3,
        minimum: 1,
    })
    @Expose()
    maxAttempts: number;

    @ApiProperty({
        description: 'Minimum percentage required to pass',
        example: 70,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    passingScore: number;

    @ApiProperty({
        description: 'Total number of questions in the test',
        example: 20,
        minimum: 1,
    })
    @Expose()
    totalQuestions: number;

    @ApiProperty({
        description: 'Total possible points for the test',
        example: 100,
        minimum: 0,
    })
    @Expose()
    totalPoints: number;

    @ApiProperty({
        description: 'Test status',
        example: 'active',
        enum: ['draft', 'active', 'archived', 'suspended'],
    })
    @Expose()
    status: string;

    @ApiProperty({
        description: 'Test creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Special instructions for test takers',
        example: 'Read each question carefully and select the best answer.',
        required: false,
    })
    @Expose()
    instructions?: string;

    @ApiProperty({
        description: 'Test creator/instructor information',
        type: InstructorInfo,
        required: false,
    })
    @Expose()
    instructor?: InstructorInfo;

    @ApiProperty({
        description: 'Difficulty level indicator (computed from performance data)',
        example: 'intermediate',
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const passingScore = Number(obj?.passingScore) || 70;
        if (passingScore >= 90) return 'expert';
        if (passingScore >= 80) return 'advanced';
        if (passingScore >= 70) return 'intermediate';
        return 'beginner';
    })
    difficultyLevel: string;
}

class CourseInfo {
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
        description: 'Course instructor information',
        type: InstructorInfo,
        required: false,
    })
    @Expose()
    instructor?: InstructorInfo;

    @ApiProperty({
        description: 'Number of enrolled students',
        example: 25,
    })
    @Expose()
    enrolledStudents: number;

    @ApiProperty({
        description: 'Course creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    @Expose()
    createdAt: Date;
}

class AttemptInfo {
    @ApiProperty({
        description: 'Attempt ID',
        example: 1,
    })
    @Expose()
    attemptId: number;

    @ApiProperty({
        description: 'Attempt number for this user/test combination',
        example: 2,
    })
    @Expose()
    attemptNumber: number;

    @ApiProperty({
        description: 'Attempt start time',
        example: '2025-01-01T10:00:00.000Z',
    })
    @Expose()
    startTime: Date;

    @ApiProperty({
        description: 'Attempt submission time',
        example: '2025-01-01T11:00:00.000Z',
        required: false,
    })
    @Expose()
    submitTime?: Date;

    @ApiProperty({
        description: 'Attempt status',
        example: 'submitted',
    })
    @Expose()
    status: string;

    @ApiProperty({
        description: 'Time spent on attempt in minutes',
        example: 58,
        required: false,
    })
    @Expose()
    @Transform(({ obj }) => {
        if (obj.startTime && obj.submitTime) {
            const diffMs = new Date(obj.submitTime).getTime() - new Date(obj.startTime).getTime();
            return Math.round(diffMs / (1000 * 60));
        }
        return null;
    })
    timeSpentMinutes?: number;

    @ApiProperty({
        description: 'Number of questions answered',
        example: 18,
    })
    @Expose()
    questionsAnswered: number;

    @ApiProperty({
        description: 'Total questions in the test',
        example: 20,
    })
    @Expose()
    totalQuestions: number;

    @ApiProperty({
        description: 'Completion percentage of the attempt',
        example: 90,
    })
    @Expose()
    @Transform(({ obj }) => {
        if (obj.totalQuestions && obj.questionsAnswered) {
            return Math.round((obj.questionsAnswered / obj.totalQuestions) * 100);
        }
        return 0;
    })
    completionPercentage: number;
}

class QuestionSummary {
    @ApiProperty({
        description: 'Question ID',
        example: 1,
    })
    @Expose()
    questionId: number;

    @ApiProperty({
        description: 'Question text/title',
        example: 'What is the derivative of x²?',
    })
    @Expose()
    questionText: string;

    @ApiProperty({
        description: 'Question type',
        example: 'multiple_choice',
    })
    @Expose()
    questionType: string;

    @ApiProperty({
        description: 'Points allocated to this question',
        example: 5,
    })
    @Expose()
    points: number;

    @ApiProperty({
        description: 'Points awarded for this question',
        example: 5,
    })
    @Expose()
    pointsAwarded: number;

    @ApiProperty({
        description: 'Whether the question was answered correctly',
        example: true,
    })
    @Expose()
    isCorrect: boolean;

    @ApiProperty({
        description: 'User answer text or selected option',
        example: '2x',
    })
    @Expose()
    userAnswer: string;

    @ApiProperty({
        description: 'Correct answer text',
        example: '2x',
        required: false,
    })
    @Expose()
    correctAnswer?: string;
}

class PerformanceMetrics {
    @ApiProperty({
        description: 'Average time spent per question in minutes',
        example: 2.9,
        minimum: 0,
    })
    @Expose()
    avgTimePerQuestion: number;

    @ApiProperty({
        description: 'Answer accuracy percentage (correct answers / total questions)',
        example: 85,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    accuracy: number;

    @ApiProperty({
        description: 'Perceived difficulty rating based on performance (1-5 scale)',
        example: 3,
        minimum: 1,
        maximum: 5,
    })
    @Expose()
    difficultyRating: number;

    @ApiProperty({
        description: 'Total questions answered correctly',
        example: 17,
        minimum: 0,
    })
    @Expose()
    correctAnswers: number;

    @ApiProperty({
        description: 'Total questions answered incorrectly',
        example: 3,
        minimum: 0,
    })
    @Expose()
    incorrectAnswers: number;

    @ApiProperty({
        description: 'Questions left unanswered',
        example: 0,
        minimum: 0,
    })
    @Expose()
    unansweredQuestions: number;

    @ApiProperty({
        description: 'Time efficiency rating (1-5, based on time usage)',
        example: 4,
        minimum: 1,
        maximum: 5,
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const avgTime = Number(obj?.avgTimePerQuestion) || 0;
        if (avgTime <= 1) return 5; // Very efficient
        if (avgTime <= 2) return 4; // Efficient
        if (avgTime <= 3) return 3; // Average
        if (avgTime <= 4) return 2; // Slow
        return 1; // Very slow
    })
    timeEfficiency: number;

    @ApiProperty({
        description: 'Overall performance score (1-100, weighted average)',
        example: 87,
        minimum: 1,
        maximum: 100,
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const accuracy = Number(obj?.accuracy) || 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const timeEff = Number(obj?.timeEfficiency) || 1;
        // Weighted calculation: 80% accuracy, 20% time efficiency
        return Math.round(accuracy * 0.8 + (timeEff / 5) * 100 * 0.2);
    })
    overallPerformanceScore: number;
}

export class ResultResponseDto {
    @ApiProperty({
        description: 'Result unique identifier',
        example: 1,
    })
    @Expose()
    resultId: number;

    @ApiProperty({
        description: 'Test attempt ID this result belongs to',
        example: 1,
    })
    @Expose()
    attemptId: number;

    @ApiProperty({
        description: 'User ID who took the test',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    userId: string;

    @ApiProperty({
        description: 'Test ID for this result',
        example: 1,
    })
    @Expose()
    testId: number;

    @ApiProperty({
        description: 'Course ID for this result',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'Total score achieved by the student',
        example: 85.5,
        minimum: 0,
    })
    @Expose()
    score: number;

    @ApiProperty({
        description: 'Maximum possible score for the test',
        example: 100,
        minimum: 0,
    })
    @Expose()
    maxScore: number;

    @ApiProperty({
        description: 'Percentage score (0-100)',
        example: 85.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    percentage: number;

    @ApiProperty({
        description: 'Whether the student passed the test (meets passing score)',
        example: true,
    })
    @Expose()
    passed: boolean;

    @ApiProperty({
        description: 'Letter grade based on percentage score',
        example: 'B+',
        enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'],
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const percentage = Number(obj?.percentage) || 0;
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
        description: 'When the result was calculated and finalized',
        example: '2025-01-01T11:00:00.000Z',
    })
    @Expose()
    calculatedAt: Date;

    @ApiProperty({
        description: 'Result creation timestamp',
        example: '2025-01-01T11:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Result last update timestamp',
        example: '2025-01-01T11:00:00.000Z',
    })
    @Expose()
    updatedAt: Date;

    @ApiProperty({
        description: 'Comprehensive user information',
        type: UserInfo,
    })
    @Expose()
    user: UserInfo;

    @ApiProperty({
        description: 'Comprehensive test information',
        type: TestInfo,
    })
    @Expose()
    test: TestInfo;

    @ApiProperty({
        description: 'Comprehensive course information',
        type: CourseInfo,
    })
    @Expose()
    course: CourseInfo;

    @ApiProperty({
        description: 'Detailed attempt information',
        type: AttemptInfo,
    })
    @Expose()
    attempt: AttemptInfo;

    @ApiProperty({
        description: 'Performance metrics and analytics',
        type: PerformanceMetrics,
    })
    @Expose()
    performanceMetrics: PerformanceMetrics;

    @ApiProperty({
        description: 'Question-by-question breakdown (available for detailed reports)',
        type: [QuestionSummary],
        required: false,
    })
    @Expose()
    questionBreakdown?: QuestionSummary[];

    @ApiProperty({
        description: 'Class rank for this result (position among all students)',
        example: 5,
        minimum: 1,
        required: false,
    })
    @Expose()
    classRank?: number;

    @ApiProperty({
        description: 'Total students who took this test',
        example: 25,
        minimum: 1,
        required: false,
    })
    @Expose()
    totalStudents?: number;

    @ApiProperty({
        description: 'Percentile ranking (0-100, higher is better)',
        example: 78,
        minimum: 0,
        maximum: 100,
        required: false,
    })
    @Expose()
    percentileRank?: number;

    @ApiProperty({
        description: 'Achievement status for this result',
        example: 'excellent',
        enum: ['poor', 'fair', 'good', 'excellent', 'outstanding'],
    })
    @Expose()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    @Transform(({ obj }: { obj: any }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const percentage = Number(obj?.percentage) || 0;
        if (percentage >= 95) return 'outstanding';
        if (percentage >= 85) return 'excellent';
        if (percentage >= 75) return 'good';
        if (percentage >= 60) return 'fair';
        return 'poor';
    })
    achievementStatus: string;

    @ApiProperty({
        description: 'Whether this is a personal best score for the user in this course',
        example: true,
        required: false,
    })
    @Expose()
    isPersonalBest?: boolean;

    @ApiProperty({
        description: 'Improvement from previous attempt (percentage points)',
        example: 12.5,
        required: false,
    })
    @Expose()
    improvementFromPrevious?: number;
}
