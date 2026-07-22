import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportSchedule } from './report-schedule.entity';

/** Lifecycle status for a single scheduled/on-demand report execution. */
export enum ReportRunStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    SUCCESS = 'success',
    FAILED = 'failed',
}

/** Execution log row for a report schedule (or on-demand generate). */
@Entity('report_run')
@Index('IDX_report_run_schedule', ['scheduleId'])
@Index('IDX_report_run_org_started', ['orgId', 'startedAt'])
export class ReportRun {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty()
    id: string;

    @Column('uuid', { nullable: true })
    @ApiPropertyOptional({
        description: 'Null for on-demand runs without a saved schedule',
    })
    scheduleId?: string | null;

    @ManyToOne(() => ReportSchedule, schedule => schedule.runs, {
        onDelete: 'SET NULL',
        nullable: true,
    })
    @JoinColumn({ name: 'scheduleId' })
    schedule?: ReportSchedule | null;

    @Column('uuid')
    @Index()
    @ApiProperty()
    orgId: string;

    @Column({
        type: 'enum',
        enum: ReportRunStatus,
        default: ReportRunStatus.PENDING,
    })
    @ApiProperty({ enum: ReportRunStatus })
    status: ReportRunStatus;

    @Column({ type: 'timestamp' })
    @ApiProperty()
    startedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    @ApiPropertyOptional()
    finishedAt?: Date | null;

    @Column({ type: 'text', nullable: true })
    @ApiPropertyOptional()
    errorMessage?: string | null;

    @Column({ type: 'int', default: 0 })
    @ApiProperty()
    recipientCount: number;

    @Column({ type: 'int', nullable: true })
    @ApiPropertyOptional()
    csvRowCount?: number | null;

    @Column({ type: 'json', nullable: true })
    @ApiPropertyOptional()
    metadata?: Record<string, unknown> | null;

    @CreateDateColumn()
    createdAt: Date;
}
