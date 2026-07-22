import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    OneToMany,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Organization } from '../../org/entities/org.entity';
import { User } from '../../user/entities/user.entity';
import { ReportRun } from './report-run.entity';

/** How often a scheduled admin report is delivered. */
export enum ReportScheduleFrequency {
    WEEKLY = 'weekly',
    MONTHLY = 'monthly',
}

/**
 * Admin-configured report delivery schedule.
 * Inactive schedules (`isActive = false`) are skipped by the cron runner.
 */
@Entity('report_schedule')
@Index('IDX_report_schedule_org_active', ['orgId', 'isActive'])
@Index('IDX_report_schedule_next_run', ['nextRunAt', 'isActive'])
export class ReportSchedule {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty()
    id: string;

    @Column('uuid')
    @Index()
    @ApiProperty({ description: 'Organization that owns this schedule' })
    orgId: string;

    @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orgId' })
    organization: Organization;

    @Column('uuid')
    @ApiProperty({ description: 'User who created the schedule' })
    createdByUserId: string;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'createdByUserId' })
    createdBy: User;

    @Column({ length: 160 })
    @ApiProperty({ example: 'Weekly training performance digest' })
    name: string;

    @Column({ type: 'json' })
    @ApiProperty({
        description: 'Report slices to include',
        example: ['overview', 'performers', 'key-areas'],
    })
    reportTypes: string[];

    @Column({ type: 'json', nullable: true })
    @ApiPropertyOptional({
        description: 'Optional filters (branchId, timeframe, etc.)',
    })
    filters?: Record<string, unknown> | null;

    @Column({
        type: 'enum',
        enum: ReportScheduleFrequency,
        default: ReportScheduleFrequency.WEEKLY,
    })
    @ApiProperty({ enum: ReportScheduleFrequency })
    frequency: ReportScheduleFrequency;

    @Column({ type: 'int', nullable: true })
    @ApiPropertyOptional({
        description: 'Day of week for weekly schedules (0=Sunday … 6=Saturday)',
    })
    dayOfWeek?: number | null;

    @Column({ type: 'int', nullable: true })
    @ApiPropertyOptional({
        description: 'Day of month for monthly schedules (1–28)',
    })
    dayOfMonth?: number | null;

    @Column({ length: 5, default: '08:00' })
    @ApiProperty({ example: '08:00', description: 'UTC send time HH:mm' })
    timeUtc: string;

    @Column({ length: 64, default: 'UTC' })
    @ApiProperty({ example: 'UTC' })
    timezone: string;

    @Column({ type: 'json', nullable: true })
    @ApiPropertyOptional({ type: [String] })
    recipientUserIds?: string[] | null;

    @Column({ type: 'json', nullable: true })
    @ApiPropertyOptional({ type: [String] })
    recipientEmails?: string[] | null;

    @Column({ type: 'json', nullable: true })
    @ApiPropertyOptional({
        description: 'Recipient roles (e.g. admin, owner)',
        type: [String],
    })
    recipientRoles?: string[] | null;

    @Column({ default: true })
    @ApiProperty({ description: 'Attach CSV summary when emailing' })
    includeCsv: boolean;

    @Column({ default: false })
    @ApiProperty({
        description: 'Include motivational leaderboard section in email',
    })
    includeMotivationalLeaderboard: boolean;

    @Column({ default: true })
    @ApiProperty({
        description:
            'When false, cron skips this schedule and no emails are sent',
    })
    isActive: boolean;

    @Column({ type: 'timestamp', nullable: true })
    @ApiPropertyOptional()
    lastRunAt?: Date | null;

    @Column({ type: 'timestamp', nullable: true })
    @ApiPropertyOptional()
    nextRunAt?: Date | null;

    @OneToMany(() => ReportRun, run => run.schedule)
    runs: ReportRun[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
