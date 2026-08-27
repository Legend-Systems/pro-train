import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MAX_BULK_GRADE_ATTEMPTS } from '../constants/pending-results.constants';

/** Optional body for POST /results/admin/grade-attempt/:attemptId. */
export class GradeStoredAttemptDto {
    @ApiPropertyOptional({
        description:
            'When true, auto-mark and recalculate even if a result already exists',
        example: false,
        default: false,
    })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    regrade?: boolean;
}

/** Body for POST /results/admin/grade-attempts. */
export class GradeStoredAttemptsDto {
    @ApiProperty({
        description: 'Attempt IDs to grade from stored answers',
        example: [668, 670],
        type: [Number],
    })
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(MAX_BULK_GRADE_ATTEMPTS)
    @IsInt({ each: true })
    @Min(1, { each: true })
    @Transform(({ value }) =>
        Array.isArray(value)
            ? value.map((item: unknown) => Number(item))
            : value,
    )
    attemptIds: number[];

    @ApiPropertyOptional({
        description:
            'When true, re-grade attempts that already have a result row',
        example: false,
        default: false,
    })
    @IsOptional()
    @Transform(({ value }) => value === true || value === 'true')
    @IsBoolean()
    regrade?: boolean;
}
