import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
    Index,
    Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/** Materialized monthly rollup for fast dashboard queries. */
@Entity('user_training_hours_monthly')
@Index('IDX_user_training_hours_monthly_org_month', ['orgId', 'yearMonth'])
@Unique('UQ_user_training_hours_monthly_user_org_month', [
    'userId',
    'orgId',
    'yearMonth',
])
export class UserTrainingHoursMonthly {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({ description: 'Monthly rollup unique identifier' })
    id: string;

    @Column('uuid')
    userId: string;

    @Column('uuid')
    orgId: string;

    @Column('uuid', { nullable: true })
    branchId?: string;

    /** Format: YYYY-MM */
    @Column({ length: 7 })
    yearMonth: string;

    @Column({ type: 'int', default: 0 })
    totalMinutes: number;

    @Column({ type: 'int', default: 0 })
    sessionCount: number;

    @UpdateDateColumn()
    updatedAt: Date;
}
