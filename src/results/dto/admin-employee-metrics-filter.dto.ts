import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsNumber, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/** Filters for per-employee and per-month admin analytics. */
export class AdminEmployeeMetricsFilterDto {
    @ApiPropertyOptional({
        description: 'Employee user ID — omit for org-wide aggregate',
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Calendar year for trend data',
        example: 2026,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    year?: number;

    @ApiPropertyOptional({
        description: 'Specific month (1–12). Omit to show all months in the year.',
        example: 3,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value, 10))
    @IsNumber()
    @Min(1)
    @Max(12)
    month?: number;
}
