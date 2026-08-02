import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** Query filters for the paginated attempt-reset audit history. */
export class TestAttemptResetFilterDto {
    @ApiPropertyOptional({
        description: 'Only return resets for this test',
        example: 42,
    })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    testId?: number;

    @ApiPropertyOptional({
        description: 'Only return resets for this learner',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        default: 1,
        minimum: 1,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 20,
        default: 20,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    limit?: number = 20;
}
