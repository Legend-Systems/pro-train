import { ApiProperty } from '@nestjs/swagger';
import { ResultResponseDto } from './result-response.dto';

/** Summary metrics for the org-wide admin results dashboard. */
class AdminResultsSummaryDto {
    @ApiProperty({ example: 128 })
    totalResults: number;

    @ApiProperty({ example: 92 })
    passedCount: number;

    @ApiProperty({ example: 36 })
    failedCount: number;

    @ApiProperty({ example: 71.9 })
    passRate: number;

    @ApiProperty({ example: 74.5 })
    averageScore: number;

    @ApiProperty({ example: 73.2 })
    averagePercentage: number;

    @ApiProperty({ example: 24 })
    uniqueEmployees: number;

    @ApiProperty({ example: 8 })
    activeTests: number;

    @ApiProperty({ example: 15 })
    recentResults: number;
}

/** Per-test performance rollup for leadership review. */
class AdminTestPerformanceDto {
    @ApiProperty({ example: 43 })
    testId: number;

    @ApiProperty({ example: 'Drywall Fundamentals' })
    testTitle: string;

    @ApiProperty({ example: 32 })
    totalAttempts: number;

    @ApiProperty({ example: 78.5 })
    averageScore: number;

    @ApiProperty({ example: 68.8 })
    passRate: number;
}

/** Employee highlight for top performers. */
class AdminEmployeePerformanceDto {
    @ApiProperty()
    userId: string;

    @ApiProperty({ example: 'Jane' })
    firstName: string;

    @ApiProperty({ example: 'Smith' })
    lastName: string;

    @ApiProperty({ example: 88.5 })
    averageScore: number;

    @ApiProperty({ example: 5 })
    testsPassed: number;

    @ApiProperty({ example: 6 })
    totalTests: number;
}

/** Employees who may need coaching or re-training. */
class AdminNeedsAttentionDto {
    @ApiProperty()
    userId: string;

    @ApiProperty({ example: 'John' })
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    lastName: string;

    @ApiProperty({ example: 3 })
    failedAttempts: number;

    @ApiProperty({ example: 'Safety Compliance Quiz' })
    lastFailedTest: string;
}

/** Full admin dashboard payload for CEO / owner review. */
export class AdminResultsDashboardDto {
    @ApiProperty({ type: AdminResultsSummaryDto })
    summary: AdminResultsSummaryDto;

    @ApiProperty({ type: [ResultResponseDto] })
    results: ResultResponseDto[];

    @ApiProperty({ example: 128 })
    total: number;

    @ApiProperty({ example: 1 })
    page: number;

    @ApiProperty({ example: 20 })
    limit: number;

    @ApiProperty({ type: [AdminTestPerformanceDto] })
    testPerformance: AdminTestPerformanceDto[];

    @ApiProperty({ type: [AdminEmployeePerformanceDto] })
    topPerformers: AdminEmployeePerformanceDto[];

    @ApiProperty({ type: [AdminNeedsAttentionDto] })
    needsAttention: AdminNeedsAttentionDto[];
}
