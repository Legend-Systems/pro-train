import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** User training hours headline summary. */
export class UserTrainingHoursSummaryDto {
    @ApiProperty({ example: 720 })
    totalMinutes: number;

    @ApiProperty({ example: 12 })
    totalHours: number;

    @ApiProperty({ example: 180 })
    currentMonthMinutes: number;

    @ApiProperty({ example: 3 })
    currentMonthHours: number;

    @ApiProperty({ example: 45 })
    weeklyMinutes: number;

    @ApiProperty({ example: 0.8 })
    weeklyHours: number;

    @ApiProperty({ example: 24 })
    sessionCount: number;

    @ApiPropertyOptional({ example: '2026-06-30T10:00:00.000Z' })
    lastActivityAt?: string;
}

/** Monthly training hours bucket. */
export class MonthlyTrainingHoursDto {
    @ApiProperty({ example: '2026-06' })
    yearMonth: string;

    @ApiProperty({ example: 180 })
    totalMinutes: number;

    @ApiProperty({ example: 3 })
    totalHours: number;

    @ApiProperty({ example: 8 })
    sessionCount: number;
}

/** Org-wide monthly trend point for admin charts. */
export class AdminTrainingHoursTrendDto {
    @ApiProperty({ example: '2026-06' })
    yearMonth: string;

    @ApiProperty({ example: 48.5 })
    totalHours: number;

    @ApiProperty({ example: 12 })
    activeLearners: number;

    @ApiProperty({ example: 4 })
    averageHoursPerLearner: number;
}

/** Org summary for a single month. */
export class AdminOrgTrainingHoursSummaryDto {
    @ApiProperty({ example: '2026-06' })
    yearMonth: string;

    @ApiProperty({ example: 2910 })
    totalMinutes: number;

    @ApiProperty({ example: 48.5 })
    totalHours: number;

    @ApiProperty({ example: 12 })
    activeLearners: number;

    @ApiProperty({ example: 4 })
    averageHoursPerLearner: number;
}

/** Ranked learner by training hours. */
export class AdminUserTrainingHoursRankingDto {
    @ApiProperty()
    userId: string;

    @ApiProperty({ example: 'Jane' })
    firstName: string;

    @ApiProperty({ example: 'Smith' })
    lastName: string;

    @ApiProperty({ example: 600 })
    totalMinutes: number;

    @ApiProperty({ example: 10 })
    totalHours: number;

    @ApiProperty({ example: 8 })
    sessionCount: number;
}

/** Sign-in payload fragment for training hours. */
export class TrainingHoursSignInSummaryDto {
    @ApiProperty({ example: 12 })
    totalHours: number;

    @ApiProperty({ example: 3 })
    currentMonthHours: number;

    @ApiProperty({ example: 0.8 })
    weeklyHours: number;
}
