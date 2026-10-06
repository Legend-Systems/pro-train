import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Records downloads of a named training manual.
 * One row per user and manual key.
 */
@Entity('training_manual_downloads')
@Unique('UQ_training_manual_user_key', ['userId', 'manualKey'])
@Index('IDX_training_manual_org', ['orgId'])
export class TrainingManualDownload {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('uuid')
    userId: string;

    @Column('uuid')
    orgId: string;

    @Column({ type: 'varchar', length: 80 })
    manualKey: string;

    @CreateDateColumn()
    firstDownloadedAt: Date;

    @UpdateDateColumn()
    lastDownloadedAt: Date;

    @Column({ type: 'int', default: 1 })
    downloadCount: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;
}
