import {
    IsString,
    IsNumber,
    IsOptional,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Source context for an XP award — links ledger entry to a domain entity. */
export class AwardXpSourceDto {
    @ApiProperty({ description: 'Source entity ID (resultId, attemptId, etc.)' })
    @IsString()
    id: string;

    @ApiProperty({ description: 'Source type (XP_SOURCE_TYPES.*)' })
    @IsString()
    type: string;

    @ApiPropertyOptional({ description: 'Human-readable award context' })
    @IsOptional()
    @IsString()
    details?: string;
}

/**
 * Input DTO for RewardsService.awardXP() — single entry point for all XP awards.
 */
export class AwardXpDto {
    @ApiProperty({ description: 'Target user UUID' })
    @IsUUID()
    userId: string;

    @ApiProperty({ description: 'XP points to award (positive integer)', example: 20 })
    @IsNumber()
    @Min(1)
    amount: number;

    @ApiProperty({ description: 'Action code (XP_ACTIONS.*)', example: 'PASS_TEST' })
    @IsString()
    action: string;

    @ApiPropertyOptional({ description: 'Source entity linking this award to domain data' })
    @IsOptional()
    @ValidateNested()
    @Type(() => AwardXpSourceDto)
    source?: AwardXpSourceDto;

    @ApiPropertyOptional({
        description: 'Stable key to prevent duplicate awards on retries',
        example: 'result:42:PASS_TEST',
    })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;
}
