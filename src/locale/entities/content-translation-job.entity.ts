import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from 'typeorm';
import type {
    TranslationEntityType,
    TranslationJobStatus,
} from '../translation/translation.constants';

/**
 * Tracks automatic pt-PT translation jobs for observability and retry.
 * Unique per (entityType, entityId, locale) so retries upsert the same row.
 */
@Entity('content_translation_jobs')
@Unique('UQ_content_translation_jobs_entity_locale', [
    'entityType',
    'entityId',
    'locale',
])
@Index('IDX_content_translation_jobs_status', ['status'])
export class ContentTranslationJob {
    @PrimaryGeneratedColumn({ name: 'jobId' })
    jobId: number;

    @Column({ type: 'varchar', length: 20 })
    entityType: TranslationEntityType;

    @Column({ type: 'int' })
    entityId: number;

    @Column({ type: 'varchar', length: 10 })
    locale: string;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: TranslationJobStatus;

    @Column({ type: 'text', nullable: true })
    lastError?: string | null;

    @Column({ type: 'varchar', length: 64, nullable: true })
    sourceContentHash?: string | null;

    @Column({ type: 'int', default: 0 })
    charactersTranslated: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
