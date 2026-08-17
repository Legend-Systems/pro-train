import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentTranslationJob } from '../entities/content-translation-job.entity';
import {
    TRANSLATION_TARGET_LOCALE,
    type TranslationEntityType,
    type TranslationJobStatus,
} from './translation.constants';
import type { TranslationJobSnapshot } from './content-translation.types';

/** Upserts translation job status rows used by retry/status admin APIs. */
@Injectable()
export class ContentTranslationJobService {
    constructor(
        @InjectRepository(ContentTranslationJob)
        private readonly jobRepository: Repository<ContentTranslationJob>,
    ) {}

    async markPending(
        entityType: TranslationEntityType,
        entityId: number,
        sourceContentHash: string,
    ): Promise<ContentTranslationJob> {
        return this.upsertJob(entityType, entityId, {
            status: 'pending',
            lastError: null,
            sourceContentHash,
        });
    }

    async markCompleted(
        entityType: TranslationEntityType,
        entityId: number,
        params: {
            readonly sourceContentHash: string;
            readonly charactersTranslated: number;
        },
    ): Promise<void> {
        await this.upsertJob(entityType, entityId, {
            status: 'completed',
            lastError: null,
            sourceContentHash: params.sourceContentHash,
            charactersTranslated: params.charactersTranslated,
        });
    }

    async markSkipped(
        entityType: TranslationEntityType,
        entityId: number,
        sourceContentHash: string,
    ): Promise<void> {
        await this.upsertJob(entityType, entityId, {
            status: 'skipped',
            lastError: null,
            sourceContentHash,
        });
    }

    async markFailed(
        entityType: TranslationEntityType,
        entityId: number,
        lastError: string,
        sourceContentHash?: string,
    ): Promise<void> {
        await this.upsertJob(entityType, entityId, {
            status: 'failed',
            lastError: lastError.slice(0, 2000),
            sourceContentHash: sourceContentHash ?? null,
        });
    }

    async findLatest(
        entityType: TranslationEntityType,
        entityId: number,
    ): Promise<TranslationJobSnapshot | null> {
        const job = await this.jobRepository.findOne({
            where: {
                entityType,
                entityId,
                locale: TRANSLATION_TARGET_LOCALE,
            },
        });

        if (!job) {
            return null;
        }

        return {
            jobId: job.jobId,
            entityType: job.entityType,
            entityId: job.entityId,
            locale: job.locale,
            status: job.status,
            lastError: job.lastError ?? null,
            sourceContentHash: job.sourceContentHash ?? null,
            charactersTranslated: job.charactersTranslated,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        };
    }

    private async upsertJob(
        entityType: TranslationEntityType,
        entityId: number,
        patch: {
            readonly status: TranslationJobStatus;
            readonly lastError: string | null;
            readonly sourceContentHash?: string | null;
            readonly charactersTranslated?: number;
        },
    ): Promise<ContentTranslationJob> {
        let job = await this.jobRepository.findOne({
            where: {
                entityType,
                entityId,
                locale: TRANSLATION_TARGET_LOCALE,
            },
        });

        if (!job) {
            job = this.jobRepository.create({
                entityType,
                entityId,
                locale: TRANSLATION_TARGET_LOCALE,
                status: patch.status,
                lastError: patch.lastError,
                sourceContentHash: patch.sourceContentHash ?? null,
                charactersTranslated: patch.charactersTranslated ?? 0,
            });
        } else {
            job.status = patch.status;
            job.lastError = patch.lastError;
            if (patch.sourceContentHash !== undefined) {
                job.sourceContentHash = patch.sourceContentHash;
            }
            if (patch.charactersTranslated !== undefined) {
                job.charactersTranslated = patch.charactersTranslated;
            }
        }

        return this.jobRepository.save(job);
    }
}
