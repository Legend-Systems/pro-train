import {
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TranslationServiceClient } from '@google-cloud/translate';
import type { TranslationProvider } from './content-translation.types';
import {
    formatTranslationProviderError,
    isRetryableTranslationError,
} from './translation-error.util';
import {
    hasMismatchedTranslateKeyPair,
    resolveTranslationCredentials,
} from './translation-credentials.util';

/**
 * Google Cloud Translation API v3 adapter.
 *
 * Uses dedicated translate service-account env vars when present so Translation
 * IAM can differ from the GCS storage account (protrain-storage@...).
 */
@Injectable()
export class GoogleCloudTranslationProvider
    implements TranslationProvider, OnModuleInit
{
    private readonly logger = new Logger(GoogleCloudTranslationProvider.name);
    private readonly client: TranslationServiceClient | null;
    private readonly parent: string;
    private readonly clientEmail: string | null;

    constructor(private readonly configService: ConfigService) {
        if (hasMismatchedTranslateKeyPair(configService)) {
            this.logger.error(
                'GOOGLE_TRANSLATE_CLIENT_EMAIL differs from GOOGLE_CLOUD_CLIENT_EMAIL but ' +
                    'GOOGLE_TRANSLATE_PRIVATE_KEY is missing. Requests will fail with PERMISSION_DENIED ' +
                    'because the private key must belong to the translate service account.',
            );
        }

        const credentials = resolveTranslationCredentials(configService);

        if (!credentials) {
            this.logger.warn(
                'Google Cloud Translation credentials are incomplete; provider will fail until ' +
                    'GOOGLE_TRANSLATE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT_ID), client email, and private key are configured',
            );
            this.client = null;
            this.parent = '';
            this.clientEmail = null;
            return;
        }

        this.clientEmail = credentials.clientEmail;
        this.client = new TranslationServiceClient({
            projectId: credentials.projectId,
            credentials: {
                private_key: credentials.privateKey,
                client_email: credentials.clientEmail,
            },
        });
        this.parent = `projects/${credentials.projectId}/locations/global`;
    }

    onModuleInit(): void {
        if (!this.client || !this.clientEmail) {
            return;
        }

        const usesDedicated = Boolean(
            this.configService.get<string>('GOOGLE_TRANSLATE_CLIENT_EMAIL')?.trim(),
        );

        this.logger.log(
            `translation.provider.configured project=${this.parent} serviceAccount=${this.clientEmail} ` +
                `credentialSource=${usesDedicated ? 'GOOGLE_TRANSLATE_*' : 'GOOGLE_CLOUD_* (GCS fallback)'}`,
        );
    }

    async translateBatch(params: {
        readonly texts: readonly string[];
        readonly sourceLocale: 'en';
        readonly targetLocale: 'pt-PT';
    }): Promise<readonly string[]> {
        if (!this.client) {
            throw new Error(
                'Google Cloud Translation is not configured (missing project or service account)',
            );
        }

        if (params.texts.length === 0) {
            return [];
        }

        try {
            const [response] = await this.client.translateText({
                parent: this.parent,
                contents: [...params.texts],
                mimeType: 'text/plain',
                sourceLanguageCode: params.sourceLocale,
                targetLanguageCode: params.targetLocale,
            });

            const translations = response.translations ?? [];
            if (translations.length !== params.texts.length) {
                throw new Error(
                    `Translation response size mismatch: expected ${params.texts.length}, got ${translations.length}`,
                );
            }

            return translations.map((item, index) => {
                const translated = item.translatedText?.trim();
                return translated && translated.length > 0
                    ? translated
                    : params.texts[index];
            });
        } catch (error) {
            const formatted = formatTranslationProviderError(error);
            const wrapped = new Error(formatted);
            if (error instanceof Error && 'code' in error) {
                (wrapped as Error & { code?: number }).code = (
                    error as Error & { code?: number }
                ).code;
            }
            if (!isRetryableTranslationError(error)) {
                this.logger.error(
                    `translation.provider.non_retryable serviceAccount=${this.clientEmail ?? 'unknown'} error=${formatted}`,
                );
            }
            throw wrapped;
        }
    }
}
