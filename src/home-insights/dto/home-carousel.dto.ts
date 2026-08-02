import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PASSING_SCORE_PERCENTAGE } from '../../results/constants/passing-score.constants';

/** Compact person row used across leaderboard carousel slices. */
export class HomeInsightPersonDto {
    @ApiProperty()
    userId: string;

    @ApiProperty()
    firstName: string;

    @ApiProperty()
    lastName: string;

    @ApiPropertyOptional({ nullable: true })
    branchName: string | null;

    @ApiProperty()
    averageScore: number;

    @ApiPropertyOptional()
    passRate?: number;

    @ApiPropertyOptional()
    rank?: number;

    @ApiPropertyOptional()
    totalPoints?: number;

    @ApiPropertyOptional()
    pointsDelta?: number | null;
}

/** Branch ranking row for top/bottom branch insights. */
export class HomeInsightBranchDto {
    @ApiProperty()
    branchId: string;

    @ApiProperty()
    branchName: string;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    resultsCount: number;
}

/** Static + dynamic guidance for educational slides. */
export class HomeInsightEducationDto {
    @ApiProperty({
        description: 'Global pass mark percentage (raised from 60% to 80%)',
        example: PASSING_SCORE_PERCENTAGE,
    })
    passMarkPercent: number;

    @ApiProperty({ type: [String] })
    courseCompletionTips: string[];

    @ApiProperty({ type: [String] })
    testPassTips: string[];
}

/** Logged-in learner XP + performance snapshot. */
export class HomeInsightPersonalDto {
    @ApiProperty()
    knowledgeScore: number;

    @ApiProperty()
    currentXP: number;

    @ApiProperty()
    totalXP: number;

    @ApiProperty()
    level: number;

    @ApiProperty()
    xpRank: string;

    @ApiProperty()
    testsPassed: number;

    @ApiProperty()
    testsFailed: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    totalTrainingHours: number;

    @ApiProperty()
    currentMonthTrainingHours: number;

    @ApiProperty()
    currentStreak: number;

    @ApiProperty()
    longestStreak: number;

    @ApiProperty({ type: [String] })
    achievements: string[];

    @ApiProperty({ type: [String] })
    milestones: string[];

    @ApiProperty({ type: [String] })
    recommendedActions: string[];
}

/** Org-wide leaderboard snapshot for the carousel. */
export class HomeInsightLeaderboardDto {
    @ApiPropertyOptional({ nullable: true })
    yourRank: number | null;

    @ApiPropertyOptional({ nullable: true })
    yourPoints: number | null;

    @ApiProperty()
    totalParticipants: number;

    @ApiProperty()
    averageScore: number;

    @ApiProperty({ type: [HomeInsightPersonDto] })
    topUsers: HomeInsightPersonDto[];

    @ApiProperty({ type: [HomeInsightPersonDto] })
    bottomUsers: HomeInsightPersonDto[];

    @ApiProperty({ type: [HomeInsightPersonDto] })
    topImprovers: HomeInsightPersonDto[];

    @ApiProperty({ type: [HomeInsightBranchDto] })
    topBranches: HomeInsightBranchDto[];

    @ApiProperty({ type: [HomeInsightBranchDto] })
    bottomBranches: HomeInsightBranchDto[];
}

/** Compact course health row for admin slides. */
export class HomeInsightCourseHealthDto {
    @ApiProperty()
    courseId: number;

    @ApiProperty()
    courseTitle: string;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    resultsCount: number;
}

/** Compact test analytics row for admin slides. */
export class HomeInsightTestHealthDto {
    @ApiProperty()
    testId: number;

    @ApiProperty()
    testTitle: string;

    @ApiPropertyOptional({ nullable: true })
    courseTitle: string | null;

    @ApiProperty()
    passRate: number;

    @ApiProperty()
    averageScore: number;

    @ApiProperty()
    totalAttempts: number;
}

/**
 * Admin-only org analytics. Never returned for regular `user` role.
 * Roles: master_admin | owner | admin.
 */
export class HomeInsightAdminDto {
    @ApiProperty()
    averageKnowledgeScore: number;

    @ApiProperty()
    overallPassRate: number;

    @ApiProperty()
    totalResults: number;

    @ApiProperty()
    activeLearners: number;

    @ApiProperty()
    totalTrainingHours: number;

    @ApiProperty()
    atRiskUserCount: number;

    @ApiProperty()
    highPotentialUserCount: number;

    @ApiProperty({ type: [HomeInsightPersonDto] })
    topPerformers: HomeInsightPersonDto[];

    @ApiProperty({ type: [HomeInsightPersonDto] })
    worstPerformers: HomeInsightPersonDto[];

    @ApiProperty({ type: [HomeInsightTestHealthDto] })
    hardestTests: HomeInsightTestHealthDto[];

    @ApiProperty({ type: [HomeInsightTestHealthDto] })
    easiestTests: HomeInsightTestHealthDto[];

    @ApiProperty({ type: [HomeInsightBranchDto] })
    branchComparison: HomeInsightBranchDto[];

    @ApiProperty({ type: [HomeInsightCourseHealthDto] })
    keyTrainingAreas: HomeInsightCourseHealthDto[];

    @ApiProperty({ type: [String] })
    operationalHighlights: string[];
}

/** Full home carousel payload for web + mobile. */
export class HomeCarouselResponseDto {
    @ApiProperty({ type: HomeInsightEducationDto })
    education: HomeInsightEducationDto;

    @ApiProperty({ type: HomeInsightPersonalDto })
    personal: HomeInsightPersonalDto;

    @ApiProperty({ type: HomeInsightLeaderboardDto })
    leaderboard: HomeInsightLeaderboardDto;

    @ApiPropertyOptional({
        type: HomeInsightAdminDto,
        description:
            'Present only for Master Admin, Owner, and Admin roles',
    })
    admin?: HomeInsightAdminDto;

    @ApiProperty()
    generatedAt: string;
}
