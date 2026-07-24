import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
    Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Which exam-date reminder was sent. */
export enum TestExamNotificationType {
    THREE_DAY = 'three_day',
    DAY_OF = 'day_of',
}

/** Delivery lifecycle for a scheduled exam reminder. */
export enum TestExamNotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    SKIPPED = 'skipped',
}

/**
 * Deduplicated log of examDate reminder emails.
 * Unique per (testId, userId, notificationType) so cron never double-sends.
 */
@Entity('test_exam_notification')
@Unique('UQ_test_exam_notification_dedupe', [
    'testId',
    'userId',
    'notificationType',
])
@Index('IDX_test_exam_notification_org', ['orgId'])
@Index('IDX_test_exam_notification_exam_date', ['examDate'])
@Index('IDX_test_exam_notification_status', ['status'])
export class TestExamNotification {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty()
    id: string;

    @Column({ type: 'int' })
    @ApiProperty()
    testId: number;

    @Column({ type: 'uuid' })
    @ApiProperty()
    userId: string;

    @Column({ type: 'uuid' })
    @ApiProperty()
    orgId: string;

    @Column({
        type: 'enum',
        enum: TestExamNotificationType,
    })
    @ApiProperty({ enum: TestExamNotificationType })
    notificationType: TestExamNotificationType;

    @Column({
        type: 'enum',
        enum: TestExamNotificationStatus,
        default: TestExamNotificationStatus.PENDING,
    })
    @ApiProperty({ enum: TestExamNotificationStatus })
    status: TestExamNotificationStatus;

    @Column({ type: 'datetime', precision: 6 })
    @ApiProperty({ description: 'Snapshot of test.examDate when queued' })
    examDate: Date;

    @Column({ type: 'varchar', length: 320 })
    @ApiProperty()
    recipientEmail: string;

    @Column({ type: 'varchar', length: 36, nullable: true })
    @ApiPropertyOptional()
    communicationId?: string | null;

    @Column({ type: 'text', nullable: true })
    @ApiPropertyOptional()
    errorMessage?: string | null;

    @Column({ type: 'timestamp', nullable: true })
    @ApiPropertyOptional()
    sentAt?: Date | null;

    @CreateDateColumn()
    @ApiProperty()
    createdAt: Date;
}
