import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsOptional,
    IsUUID,
    IsNumber,
    IsBoolean,
    IsString,
    IsEnum,
    IsDateString,
    Min,
    Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Sort keys for the admin Employee Performance roster. */
export enum AdminEmployeePerformanceSortBy {
    NAME = 'name',
    PASS_RATE = 'passRate',
    AVERAGE_SCORE = 'averageScore',
    NOT_ATTEMPTED = 'notAttempted',
    LAST_ACTIVITY = 'lastActivity',
    TESTS_PASSED = 'testsPassed',
}

export enum SortOrder {
    ASC = 'ASC',
    DESC = 'DESC',
}

/**
 * Query filters for GET /results/admin/employee-performance.
 *
 * `hasNotAttempted` surfaces employees who missed at least one scheduled exam
 * window (no attempt on/after `examStartDate`).
 */
export class AdminEmployeePerformanceFilterDto {
    @ApiPropertyOptional({
        description: 'Search by employee first name, last name, or email',
        example: 'jane',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Filter employees by branch ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    branchId?: string;

    @ApiPropertyOptional({
        description:
            'Limit performance lists to a specific test (also used for not-attempted matching)',
        example: 12,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    testId?: number;

    @ApiPropertyOptional({
        description:
            'When true, only employees with at least one not-attempted scheduled test',
        example: true,
    })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    hasNotAttempted?: boolean;

    @ApiPropertyOptional({
        description:
            'Lower bound for examStartDate when evaluating not-attempted tests (ISO date)',
        example: '2026-01-01T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    examStartFrom?: string;

    @ApiPropertyOptional({
        description:
            'Upper bound for examStartDate when evaluating not-attempted tests (ISO date)',
        example: '2026-12-31T23:59:59.999Z',
    })
    @IsOptional()
    @IsDateString()
    examStartTo?: string;

    @ApiPropertyOptional({
        enum: AdminEmployeePerformanceSortBy,
        default: AdminEmployeePerformanceSortBy.NOT_ATTEMPTED,
    })
    @IsOptional()
    @IsEnum(AdminEmployeePerformanceSortBy)
    sortBy?: AdminEmployeePerformanceSortBy;

    @ApiPropertyOptional({
        enum: SortOrder,
        default: SortOrder.DESC,
    })
    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder?: SortOrder;

    @ApiPropertyOptional({ example: 1, default: 1 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ example: 20, default: 20 })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;

    @ApiPropertyOptional({
        description:
            'Include results/attempts voided by an admin reset. Defaults to false.',
        example: false,
        default: false,
    })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    includeVoided?: boolean;
}
