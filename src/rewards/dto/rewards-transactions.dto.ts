import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/** Query params for GET /rewards/transactions/:userId */
export class RewardsTransactionsQueryDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;
}

/** Single XP ledger entry for audit/history API. */
export class XpTransactionResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    action: string;

    @ApiProperty()
    xpAmount: number;

    @ApiProperty()
    metadata: Record<string, unknown>;

    @ApiPropertyOptional()
    idempotencyKey?: string;

    @ApiProperty()
    timestamp: Date;
}

export class RewardsTransactionsResponseDto {
    @ApiProperty({ type: [XpTransactionResponseDto] })
    transactions: XpTransactionResponseDto[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;
}
