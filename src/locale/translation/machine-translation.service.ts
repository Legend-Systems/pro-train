import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import type { TranslationProvider } from './content-translation.types';
import {
    DEFAULT_MAX_BATCH_CHARS,
    DEFAULT_MIN_REQUEST_INTERVAL_MS,
    DEFAULT_MONTHLY_CHAR_BUDGET,
    DEFAULT_RETRY_ATTEMPTS,
    TRANSLATION_PROVIDER_TOKEN,
    TRANSLATION_SOURCE_LOCALE,
    TRANSLATION_TARGET_LOCALE,
} from './translation.constants';
import {
    countCharacters,
    splitIntoCharacterBatches,
} from './translation-text.util';
import {
    formatTranslationProviderError,
    isRetryableTranslationError,
} from './translation-error.util';

/**
 * Batches, retries, and budgets calls to the configured translation provider.
 * Never logs source question/option text (training content).
 */
@Injectable()
export class MachineTranslationService {
    private readonly logger = new Logger(MachineTranslationService.name);

    constructor(
        @Inject(TRANSLATION_PROVIDER_TOKEN)
        private readonly provider: TranslationProvider,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) {}

    /**
     * Translates English strings to pt-PT, preserving input order.
     * Empty input returns an empty array without calling the provider.
     */
    async translateTexts(texts: readonly string[]): Promise<readonly string[]> {
        if (texts.length === 0) {
            return [];
        }

        const maxBatchChars = this.readPositiveInt(
            'CONTENT_TRANSLATION_MAX_BATCH_CHARS',
            DEFAULT_MAX_BATCH_CHARS,
        );
        const retryAttempts = this.readPositiveInt(
            'CONTENT_TRANSLATION_RETRY_ATTEMPTS',
            DEFAULT_RETRY_ATTEMPTS,
        );
        const minIntervalMs = this.readPositiveInt(
            'CONTENT_TRANSLATION_MIN_REQUEST_INTERVAL_MS',
            DEFAULT_MIN_REQUEST_INTERVAL_MS,
        );

        await this.assertWithinMonthlyBudget(countCharacters(texts));

        const batches = splitIntoCharacterBatches(texts, maxBatchChars);
        const translated: string[] = [];

        this.logger.log(
            `translation.provider.start strings=${texts.length} batches=${batches.length} chars=${countCharacters(texts)}`,
        );

        for (let index = 0; index < batches.length; index += 1) {
            const batch = batches[index];
            const result = await this.translateBatchWithRetry(
                batch,
                retryAttempts,
            );
            translated.push(...result);
            await this.incrementMonthlyUsage(countCharacters(batch));

            if (index < batches.length - 1 && minIntervalMs > 0) {
                await this.delay(minIntervalMs);
            }
        }

        this.logger.log(
            `translation.provider.completed strings=${translated.length} chars=${countCharacters(texts)}`,
        );

        return translated;
    }

    private async translateBatchWithRetry(
        texts: readonly string[],
        retryAttempts: number,
    ): Promise<readonly string[]> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
            try {
                return await this.provider.translateBatch({
                    texts,
                    sourceLocale: TRANSLATION_SOURCE_LOCALE,
                    targetLocale: TRANSLATION_TARGET_LOCALE,
                });
            } catch (error) {
                lastError = error;
                const formatted = formatTranslationProviderError(error);

                if (!isRetryableTranslationError(error)) {
                    this.logger.error(
                        `translation.provider.failed strings=${texts.length} error=${formatted}`,
                    );
                    throw error instanceof Error
                        ? error
                        : new Error(formatted);
                }

                this.logger.warn(
                    `translation.provider.retry attempt=${attempt}/${retryAttempts} strings=${texts.length} error=${formatted}`,
                );
                await this.delay(250 * attempt);
            }
        }

        const formatted = formatTranslationProviderError(lastError);
        throw lastError instanceof Error
            ? lastError
            : new Error(formatted || 'Translation provider failed after retries');
    }

    private async assertWithinMonthlyBudget(
        additionalChars: number,
    ): Promise<void> {
        const budget = this.readPositiveInt(
            'CONTENT_TRANSLATION_MONTHLY_CHAR_BUDGET',
            DEFAULT_MONTHLY_CHAR_BUDGET,
        );
        const used = await this.readMonthlyUsage();

        if (used + additionalChars > budget) {
            throw new Error(
                `Monthly translation budget exceeded (${used + additionalChars}/${budget} chars)`,
            );
        }
    }

    private monthlyUsageKey(): string {
        const now = new Date();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        return `translation:monthly-chars:${now.getUTCFullYear()}-${month}`;
    }

    private async readMonthlyUsage(): Promise<number> {
        const value = await this.cacheManager.get<number>(this.monthlyUsageKey());
        return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }

    private async incrementMonthlyUsage(chars: number): Promise<void> {
        const next = (await this.readMonthlyUsage()) + chars;
        // 32 days so the key outlives the calendar month with a small buffer.
        await this.cacheManager.set(this.monthlyUsageKey(), next, 32 * 24 * 60 * 60);
    }

    private readPositiveInt(envKey: string, fallback: number): number {
        const raw = this.configService.get<string>(envKey);
        const parsed = raw ? Number(raw) : fallback;
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
}
