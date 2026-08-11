import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Compact test reference used in per-employee performance lists. */
export class AdminEmployeePerformanceTestRefDto {
    @ApiProperty({ example: 12 })
    testId: number;

    @ApiProperty({ example: 'Safety Fundamentals Exam' })
    testTitle: string;

    @ApiPropertyOptional({
        description: 'Exam window start (UTC calendar day semantics)',
        nullable: true,
        type: String,
    })
    examStartDate?: string | null;

    @ApiPropertyOptional({
        description: 'Exam window end (inclusive UTC calendar day)',
        nullable: true,
        type: String,
    })
    examEndDate?: string | null;

    @ApiPropertyOptional({
        description: 'Latest percentage for this test when a result exists',
        example: 82.5,
    })
    percentage?: number;

    @ApiPropertyOptional({
        description: 'When the latest result was calculated',
        type: String,
    })
    calculatedAt?: string;

    @ApiPropertyOptional({
        description: 'In-progress attempt id when status is in_progress',
        example: 45,
    })
    attemptId?: number;

    @ApiPropertyOptional({
        description: 'When the in-progress attempt started',
        type: String,
    })
    startTime?: string;

    @ApiPropertyOptional({
        description: 'Exam window status relative to now',
        enum: ['open', 'closed', 'pending'],
    })
    windowStatus?: 'open' | 'closed' | 'pending';
}

/** One employee row for the Employee Performance tab. */
export class AdminEmployeePerformanceRowDto {
    @ApiProperty()
    userId: string;

    @ApiProperty({ example: 'Jane' })
    firstName: string;

    @ApiProperty({ example: 'Smith' })
    lastName: string;

    @ApiProperty({ example: 'jane.smith@example.com' })
    email: string;

    @ApiPropertyOptional({ nullable: true })
    branchId?: string | null;

    @ApiPropertyOptional({ nullable: true, example: 'Lisbon' })
    branchName?: string | null;

    @ApiProperty({ example: 8 })
    totalTestsPassed: number;

    @ApiProperty({ example: 2 })
    totalTestsFailed: number;

    @ApiProperty({ example: 80 })
    passRate: number;

    @ApiProperty({ example: 84.2 })
    averageScore: number;

    @ApiPropertyOptional({
        description: 'Most recent attempt or result activity',
        nullable: true,
        type: String,
    })
    lastActivityAt?: string | null;

    @ApiProperty({
        description:
            'Count of active tests available to this employee (org/branch scoped)',
        example: 12,
    })
    testsAvailable: number;

    @ApiProperty({
        description: 'Distinct tests with a non-voided result',
        example: 10,
    })
    testsCompleted: number;

    @ApiProperty({ type: [AdminEmployeePerformanceTestRefDto] })
    testsPassed: AdminEmployeePerformanceTestRefDto[];

    @ApiProperty({ type: [AdminEmployeePerformanceTestRefDto] })
    testsFailed: AdminEmployeePerformanceTestRefDto[];

    @ApiProperty({
        description: 'Attempts currently in_progress (not voided)',
        type: [AdminEmployeePerformanceTestRefDto],
    })
    testsInProgress: AdminEmployeePerformanceTestRefDto[];

    @ApiProperty({
        description:
            'Scheduled tests (examStartDate set, window opened) with no attempt on/after examStartDate',
        type: [AdminEmployeePerformanceTestRefDto],
    })
    testsNotAttempted: AdminEmployeePerformanceTestRefDto[];

    @ApiProperty({
        description: 'Convenience count of testsNotAttempted',
        example: 3,
    })
    notAttemptedCount: number;
}

/** Org-level headline KPIs for the Employee Performance tab. */
export class AdminEmployeePerformanceSummaryDto {
    @ApiProperty({ example: 42 })
    totalEmployees: number;

    @ApiProperty({
        description: 'Employees with at least one not-attempted scheduled test',
        example: 7,
    })
    employeesWithNotAttempted: number;

    @ApiProperty({
        description: 'Sum of not-attempted assignments across employees',
        example: 15,
    })
    totalNotAttemptedAssignments: number;

    @ApiProperty({ example: 4 })
    totalInProgress: number;

    @ApiProperty({ example: 76.5 })
    averagePassRate: number;

    @ApiProperty({
        description: 'Active scheduled tests (with examStartDate) in scope',
        example: 9,
    })
    scheduledTests: number;
}

/** Full payload for GET /results/admin/employee-performance. */
export class AdminEmployeePerformanceDto {
    @ApiProperty({ type: AdminEmployeePerformanceSummaryDto })
    summary: AdminEmployeePerformanceSummaryDto;

    @ApiProperty({ type: [AdminEmployeePerformanceRowDto] })
    employees: AdminEmployeePerformanceRowDto[];

    @ApiProperty({ example: 42 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 20 })
    limit: number;
}
