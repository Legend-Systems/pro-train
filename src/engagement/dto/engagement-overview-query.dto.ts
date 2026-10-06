import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Filters for the admin material-engagement list. */
export class EngagementOverviewQueryDto {
    @ApiPropertyOptional({ description: 'Limit rows to one course' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    courseId?: number;

    @ApiPropertyOptional({ description: 'Match learner name or email' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ default: 25 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
