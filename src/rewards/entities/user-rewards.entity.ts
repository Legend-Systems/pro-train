import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
    ManyToOne,
    OneToMany,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsUUID, IsOptional } from 'class-validator';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { XPTransaction } from './xp-transaction.entity';
import {
    DEFAULT_LEVEL,
    DEFAULT_RANK,
    type XpRank,
} from '../constants/xp.constants';
import type { XpBreakdown } from '../utils/xp-breakdown.util';

/** Closed monthly challenge snapshot stored in monthlyChallengeHistory JSON. */
export interface MonthlyChallengeRecord {
    month: string;
    xp: number;
    breakdown: XpBreakdown;
    closedAt: string;
}

/**
 * Per-user XP aggregate scoped to an organization.
 * Lazy-created on first awardXP() call — one row per (userId, orgId).
 * Separate from course leaderboards which track test score performance.
 */
@Entity('user_rewards')
@Unique('UQ_user_rewards_user_org', ['userId', 'orgId'])
@Index('IDX_user_rewards_user', ['userId'])
@Index('IDX_user_rewards_org_month_xp', ['orgId', 'challengeMonthXP'])
export class UserRewards {
    @PrimaryGeneratedColumn()
    @ApiProperty({ description: 'User rewards record ID', example: 1 })
    id: number;

    @Column('uuid')
    @ApiProperty({
        description: 'Learner user ID (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @IsUUID()
    userId: string;

    @OneToOne(() => User, (user) => user.rewards)
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Organization, { nullable: false })
    @JoinColumn({ name: 'orgId' })
    @ApiProperty({ description: 'Organization scope for this rewards row' })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branchId' })
    @ApiProperty({
        description: 'Optional branch scope',
        required: false,
    })
    branchId?: Branch;

    @Column({ default: 0 })
    @ApiProperty({ description: 'Display XP total (mirrors totalXP)', example: 0 })
    @IsNumber()
    currentXP: number;

    @Column({ default: 0 })
    @ApiProperty({ description: 'Lifetime XP — drives level calculation', example: 0 })
    @IsNumber()
    totalXP: number;

    @Column({ default: DEFAULT_LEVEL })
    @ApiProperty({ description: 'Current level (1–10)', example: 1 })
    @IsNumber()
    level: number;

    @Column({ type: 'varchar', length: 20, default: DEFAULT_RANK })
    @ApiProperty({ description: 'Rank tier label', example: 'ROOKIE' })
    @IsString()
    rank: XpRank;

    @Column({ type: 'json' })
    @ApiProperty({ description: 'Lifetime XP breakdown by category' })
    xpBreakdown: XpBreakdown;

    @Column({ type: 'varchar', length: 7 })
    @ApiProperty({ description: 'Active UTC challenge month (YYYY-MM)', example: '2026-06' })
    @IsString()
    challengeMonth: string;

    @Column({ default: 0 })
    @ApiProperty({ description: 'XP earned in the active challenge month', example: 0 })
    @IsNumber()
    challengeMonthXP: number;

    @Column({ type: 'json' })
    @ApiProperty({ description: 'Monthly XP breakdown for active challenge month' })
    challengeMonthXpBreakdown: XpBreakdown;

    @Column({ type: 'json', default: () => "'[]'" })
    @ApiProperty({ description: 'History of closed monthly challenges (max 48)' })
    monthlyChallengeHistory: MonthlyChallengeRecord[];

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'Last XP award timestamp',
        required: false,
    })
    @IsOptional()
    lastActionAt?: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => XPTransaction, (transaction) => transaction.userRewards)
    transactions: XPTransaction[];

    constructor(partial?: Partial<UserRewards>) {
        if (partial) {
            Object.assign(this, partial);
        }
    }
}
