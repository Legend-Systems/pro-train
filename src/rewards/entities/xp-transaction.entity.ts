import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';
import { UserRewards } from './user-rewards.entity';

/** Metadata stored alongside each XP ledger entry. */
export interface XpTransactionMetadata {
    sourceId?: string;
    sourceType?: string;
    details?: string;
    idempotencyKey?: string;
}

/**
 * Append-only XP ledger — one row per award.
 * Parent aggregate (UserRewards) is updated in the same DB transaction.
 */
@Entity('xp_transaction')
@Index('IDX_xp_transaction_rewards_timestamp', ['userRewardsId', 'timestamp'])
@Index('IDX_xp_transaction_idempotency', ['userRewardsId', 'idempotencyKey'], {
    unique: true,
})
export class XPTransaction {
    @PrimaryGeneratedColumn()
    @ApiProperty({ description: 'Transaction ID', example: 1 })
    id: number;

    @Column()
    @ApiProperty({ description: 'Parent UserRewards ID', example: 1 })
    @IsNumber()
    userRewardsId: number;

    @ManyToOne(() => UserRewards, (rewards) => rewards.transactions, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'userRewardsId' })
    userRewards: UserRewards;

    @Column({ type: 'varchar', length: 50 })
    @ApiProperty({ description: 'XP action code', example: 'PASS_TEST' })
    @IsString()
    action: string;

    @Column()
    @ApiProperty({ description: 'Points awarded (always positive)', example: 20 })
    @IsNumber()
    xpAmount: number;

    @Column({ type: 'json' })
    @ApiProperty({ description: 'Source context and audit details' })
    metadata: XpTransactionMetadata;

    @Column({ type: 'varchar', length: 255, nullable: true })
    @ApiProperty({
        description: 'Idempotency key — prevents duplicate awards',
        required: false,
    })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    @ApiProperty({ description: 'When the award occurred' })
    timestamp: Date;

    constructor(partial?: Partial<XPTransaction>) {
        if (partial) {
            Object.assign(this, partial);
        }
    }
}
