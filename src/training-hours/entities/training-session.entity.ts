import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import {
    TRAINING_SESSION_TYPES,
    type TrainingSessionType,
} from '../constants/training-hours.constants';

/** Append-only ledger row for a bounded learning session. */
@Entity('training_session')
@Index('IDX_training_session_user', ['userId'])
@Index('IDX_training_session_org_date', ['orgId', 'activityDate'])
@Unique('UQ_training_session_type_source', ['sessionType', 'sourceId'])
export class TrainingSession {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({ description: 'Training session unique identifier' })
    id: string;

    @Column('uuid')
    @Index()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orgId' })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'branchId' })
    branchId?: Branch;

    @Column({
        type: 'enum',
        enum: TRAINING_SESSION_TYPES,
    })
    sessionType: TrainingSessionType;

    /** attemptId or materialId as string — unique per sessionType. */
    @Column({ length: 64 })
    sourceId: string;

    @Column({ nullable: true })
    courseId?: number;

    @Column({ type: 'timestamp' })
    startedAt: Date;

    @Column({ type: 'timestamp' })
    endedAt: Date;

    @Column({ type: 'int', default: 0 })
    durationMinutes: number;

    @Column({ type: 'date' })
    activityDate: string;

    @Column({ type: 'json', nullable: true })
    metadata?: Record<string, unknown>;

    @CreateDateColumn()
    createdAt: Date;
}
