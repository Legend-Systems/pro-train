import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

/** Where the learner sent the request from. */
export enum AssistanceSource {
    WEB = 'web',
    MOBILE = 'mobile',
}

/** Training surface the learner was on. */
export enum AssistanceContextType {
    COURSE = 'course',
    TEST = 'test',
}

/** Delivery state of the assistance email. */
export enum AssistanceEmailStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

/** Delivery state of the optional WhatsApp alert. */
export enum AssistanceWhatsappStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
    SKIPPED = 'skipped',
}

/** Maximum length of the optional learner note. */
export const ASSISTANCE_MESSAGE_MAX_LENGTH = 500;

/**
 * Audit row for a learner assistance request.
 * Written before notifications are sent so a failed email is still recorded.
 */
@Entity('assistance_requests')
@Index('IDX_assistance_requests_user', ['userId'])
@Index('IDX_assistance_requests_org', ['orgId'])
@Index('IDX_assistance_requests_requested_at', ['requestedAt'])
export class AssistanceRequest {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid' })
    orgId: string;

    @Column({ type: 'uuid', nullable: true })
    branchId?: string | null;

    @Column({ type: 'enum', enum: AssistanceSource })
    source: AssistanceSource;

    @Column({ type: 'enum', enum: AssistanceContextType })
    contextType: AssistanceContextType;

    @Column({ type: 'int', nullable: true })
    courseId?: number | null;

    @Column({ type: 'int', nullable: true })
    materialId?: number | null;

    @Column({ type: 'int', nullable: true })
    testId?: number | null;

    @Column({ type: 'varchar', length: ASSISTANCE_MESSAGE_MAX_LENGTH, nullable: true })
    message?: string | null;

    @Column({
        type: 'enum',
        enum: AssistanceEmailStatus,
        default: AssistanceEmailStatus.PENDING,
    })
    emailStatus: AssistanceEmailStatus;

    @Column({
        type: 'enum',
        enum: AssistanceWhatsappStatus,
        default: AssistanceWhatsappStatus.PENDING,
    })
    whatsappStatus: AssistanceWhatsappStatus;

    @Column({ type: 'uuid', nullable: true })
    communicationId?: string | null;

    @Column({ type: 'datetime', precision: 6 })
    requestedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}
