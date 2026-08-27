import { ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsOptional,
    IsUUID,
    IsNumber,
    IsString,
    IsEnum,
    IsDateString,
    Min,
    Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AttemptStatus } from '../../test_attempts/entities/test_attempt.entity';
import {
    DEFAULT_PENDING_RESULTS_LIMIT,
    DEFAULT_PENDING_RESULTS_PAGE,
    MAX_PENDING_RESULTS_LIMIT,
} from '../constants/pending-results.constants';

/** Narrow the pending list to one stuck-attempt status. */
export enum PendingResultStatusFilter {
    SUBMITTED = AttemptStatus.SUBMITTED,
    IN_PROGRESS = AttemptStatus.IN_PROGRESS,
    EXPIRED = AttemptStatus.EXPIRED,
}

/**
 * Query filters for GET /results/admin/pending-attempts.
 *
 * Lists live attempts that have stored answers but no non-voided result —
 * the recovery surface for submit-timeout failures.
 */
export class PendingResultFilterDto {
    @ApiPropertyOptional({
        description: 'Search by employee name, email, test title, or attempt ID',
        example: '668',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Limit to a single test',
        example: 83,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    testId?: number;

    @ApiPropertyOptional({
        description: 'Limit to a single learner',
        example: '113fc6c7-7d67-440c-a2ce-5682d05cc7f2',
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({
        enum: PendingResultStatusFilter,
        description: 'Restrict to one attempt status (default: all pending states)',
    })
    @IsOptional()
    @IsEnum(PendingResultStatusFilter)
    status?: PendingResultStatusFilter;

    @ApiPropertyOptional({
        description: 'Lower bound for submitTime / updatedAt (ISO date)',
        example: '2026-01-01T00:00:00.000Z',
    })
    @IsOptional()
    @IsDateString()
    from?: string;

    @ApiPropertyOptional({
        description: 'Upper bound for submitTime / updatedAt (ISO date)',
        example: '2026-12-31T23:59:59.999Z',
    })
    @IsOptional()
    @IsDateString()
    to?: string;

    @ApiPropertyOptional({ example: DEFAULT_PENDING_RESULTS_PAGE, default: DEFAULT_PENDING_RESULTS_PAGE })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        example: DEFAULT_PENDING_RESULTS_LIMIT,
        default: DEFAULT_PENDING_RESULTS_LIMIT,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    @Max(MAX_PENDING_RESULTS_LIMIT)
    limit?: number;
}
