import {
    formatTranslationProviderError,
    isRetryableTranslationError,
} from './translation-error.util';
import {
    hasMismatchedTranslateKeyPair,
    resolveTranslationCredentials,
} from './translation-credentials.util';

describe('translation-error.util', () => {
    it('adds a PERMISSION_DENIED hint with credential guidance', () => {
        const error = Object.assign(new Error(''), { code: 7 });
        const actual = formatTranslationProviderError(error);

        expect(actual).toContain('7');
        expect(actual).toContain('GOOGLE_TRANSLATE_CLIENT_EMAIL');
        expect(actual).toContain('roles/cloudtranslate.user');
    });

    it('treats PERMISSION_DENIED as non-retryable', () => {
        const error = Object.assign(new Error('denied'), { code: 7 });
        expect(isRetryableTranslationError(error)).toBe(false);
    });

    it('treats unknown errors as retryable', () => {
        expect(isRetryableTranslationError(new Error('timeout'))).toBe(true);
    });
});

describe('translation-credentials.util', () => {
    const baseConfig = {
        GOOGLE_TRANSLATE_PROJECT_ID: 'protrain-496010',
        GOOGLE_CLOUD_CLIENT_EMAIL: 'storage@example.com',
        GOOGLE_CLOUD_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
    };

    it('prefers dedicated translate credentials when set', () => {
        const configService = {
            get: (key: string) =>
                ({
                    ...baseConfig,
                    GOOGLE_TRANSLATE_CLIENT_EMAIL: 'translate@example.com',
                    GOOGLE_TRANSLATE_PRIVATE_KEY:
                        '-----BEGIN PRIVATE KEY-----\\ntranslate\\n-----END PRIVATE KEY-----\\n',
                })[key],
        };

        const actual = resolveTranslationCredentials(configService as never);

        expect(actual).toEqual({
            projectId: 'protrain-496010',
            clientEmail: 'translate@example.com',
            privateKey: '-----BEGIN PRIVATE KEY-----\ntranslate\n-----END PRIVATE KEY-----\n',
            usesDedicatedTranslateAccount: true,
        });
    });

    it('falls back to GCS credentials when translate vars are unset', () => {
        const configService = {
            get: (key: string) => baseConfig[key as keyof typeof baseConfig],
        };

        const actual = resolveTranslationCredentials(configService as never);

        expect(actual?.clientEmail).toBe('storage@example.com');
        expect(actual?.usesDedicatedTranslateAccount).toBe(false);
    });

    it('detects email/key mismatch misconfiguration', () => {
        const configService = {
            get: (key: string) =>
                ({
                    GOOGLE_TRANSLATE_CLIENT_EMAIL: 'translate@example.com',
                    GOOGLE_CLOUD_CLIENT_EMAIL: 'storage@example.com',
                })[key],
        };

        expect(hasMismatchedTranslateKeyPair(configService as never)).toBe(true);
    });
});
