import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Employee option for the analytics user filter dropdown. */
export class AdminEmployeeOptionDto {
    @ApiProperty()
    userId: string;

    @ApiProperty({ example: 'Jane' })
    firstName: string;

    @ApiProperty({ example: 'Smith' })
    lastName: string;

    @ApiProperty({ example: 12 })
    totalResults: number;
}

/** Monthly aggregate for a single employee or org-wide. */
export class AdminMonthlyTrendPointDto {
    @ApiProperty({ example: 1 })
    month: number;

    @ApiProperty({ example: 'January' })
    monthLabel: string;

    @ApiProperty({ example: 5 })
    testsPassed: number;

    @ApiProperty({ example: 2 })
    testsFailed: number;

    @ApiProperty({ example: 71.4 })
    passRate: number;

    @ApiProperty({ example: 78.5 })
    averageScore: number;
}

/** Per-course monthly pass counts — one line per course on the chart. */
export class AdminCourseMonthlyPointDto {
    @ApiProperty({ example: 1 })
    month: number;

    @ApiProperty({ example: 'January' })
    monthLabel: string;

    @ApiProperty({ example: 2 })
    passed: number;

    @ApiProperty({ example: 1 })
    failed: number;
}

export class AdminCourseTrendDto {
    @ApiProperty({ example: 4 })
    courseId: number;

    @ApiProperty({ example: 'Drywall Fundamentals' })
    courseTitle: string;

    @ApiProperty({ type: [AdminCourseMonthlyPointDto] })
    monthlyData: AdminCourseMonthlyPointDto[];
}

/** Course-level summary for the selected employee / period. */
export class AdminCourseSummaryDto {
    @ApiProperty({ example: 4 })
    courseId: number;

    @ApiProperty({ example: 'Drywall Fundamentals' })
    courseTitle: string;

    @ApiProperty({ example: 3 })
    passed: number;

    @ApiProperty({ example: 1 })
    failed: number;

    @ApiProperty({ example: 82.5 })
    averageScore: number;

    @ApiProperty({ example: 75 })
    passRate: number;
}

/** Headline KPIs for owners reviewing a single employee. */
export class AdminEmployeeSummaryDto {
    @ApiProperty({ example: 14 })
    totalTests: number;

    @ApiProperty({ example: 10 })
    testsPassed: number;

    @ApiProperty({ example: 4 })
    testsFailed: number;

    @ApiProperty({ example: 71.4 })
    passRate: number;

    @ApiProperty({ example: 79.2 })
    averageScore: number;

    @ApiProperty({ example: 5 })
    coursesAttempted: number;

    @ApiProperty({ example: 4 })
    coursesPassed: number;
}

/** Org-wide monthly pass rate for owner comparison. */
export class AdminOrgMonthlyComparisonDto {
    @ApiProperty({ example: 1 })
    month: number;

    @ApiProperty({ example: 'January' })
    monthLabel: string;

    @ApiProperty({ example: 68.5 })
    orgPassRate: number;

    @ApiProperty({ example: 74.2 })
    orgAverageScore: number;
}

/** Full payload for the Employee Analytics tab. */
export class AdminEmployeeMetricsDto {
    @ApiProperty({ example: 2026 })
    year: number;

    @ApiPropertyOptional({ example: 3 })
    month?: number;

    @ApiPropertyOptional()
    selectedUserId?: string;

    @ApiProperty({ type: [AdminEmployeeOptionDto] })
    employees: AdminEmployeeOptionDto[];

    @ApiProperty({ type: AdminEmployeeSummaryDto })
    summary: AdminEmployeeSummaryDto;

    @ApiProperty({ type: [AdminMonthlyTrendPointDto] })
    monthlyTrend: AdminMonthlyTrendPointDto[];

    @ApiProperty({ type: [AdminCourseTrendDto] })
    courseTrends: AdminCourseTrendDto[];

    @ApiProperty({ type: [AdminCourseSummaryDto] })
    courseSummaries: AdminCourseSummaryDto[];

    @ApiProperty({ type: [AdminOrgMonthlyComparisonDto] })
    orgComparison: AdminOrgMonthlyComparisonDto[];
}
