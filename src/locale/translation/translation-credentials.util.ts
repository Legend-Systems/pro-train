import type { ConfigService } from '@nestjs/config';

export interface TranslationServiceAccountCredentials {
    readonly projectId: string;
    readonly clientEmail: string;
    readonly privateKey: string;
    /** True when GOOGLE_TRANSLATE_* vars supply the active credentials. */
    readonly usesDedicatedTranslateAccount: boolean;
}

/**
 * Resolves Cloud Translation credentials.
 *
 * Storage (GCS) and Translation often use different service accounts in GCP.
 * Prefer GOOGLE_TRANSLATE_CLIENT_EMAIL / GOOGLE_TRANSLATE_PRIVATE_KEY when set;
 * otherwise fall back to the existing GCS service-account env vars.
 */
export function resolveTranslationCredentials(
    configService: ConfigService,
): TranslationServiceAccountCredentials | null {
    const projectId =
        configService.get<string>('GOOGLE_TRANSLATE_PROJECT_ID') ||
        configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');

    const translateClientEmail = configService.get<string>(
        'GOOGLE_TRANSLATE_CLIENT_EMAIL',
    );
    const storageClientEmail = configService.get<string>(
        'GOOGLE_CLOUD_CLIENT_EMAIL',
    );
    const clientEmail = translateClientEmail?.trim() || storageClientEmail?.trim();

    const translatePrivateKey = normalizePrivateKey(
        configService.get<string>('GOOGLE_TRANSLATE_PRIVATE_KEY'),
    );
    const storagePrivateKey = normalizePrivateKey(
        configService.get<string>('GOOGLE_CLOUD_PRIVATE_KEY'),
    );

    const usesDedicatedTranslateAccount = Boolean(translateClientEmail?.trim());
    const privateKey = translatePrivateKey ?? storagePrivateKey;

    if (!projectId || !clientEmail || !privateKey) {
        return null;
    }

    return {
        projectId,
        clientEmail,
        privateKey,
        usesDedicatedTranslateAccount,
    };
}

/**
 * Detects a common misconfiguration: translate email set to account A while
 * still using account B's private key from the GCS fallback.
 */
export function hasMismatchedTranslateKeyPair(
    configService: ConfigService,
): boolean {
    const translateClientEmail = configService
        .get<string>('GOOGLE_TRANSLATE_CLIENT_EMAIL')
        ?.trim();
    const storageClientEmail = configService
        .get<string>('GOOGLE_CLOUD_CLIENT_EMAIL')
        ?.trim();
    const translatePrivateKey = configService.get<string>(
        'GOOGLE_TRANSLATE_PRIVATE_KEY',
    );

    return Boolean(
        translateClientEmail &&
            storageClientEmail &&
            translateClientEmail !== storageClientEmail &&
            !translatePrivateKey?.trim(),
    );
}

function normalizePrivateKey(raw: string | undefined): string | undefined {
    const trimmed = raw?.trim();
    return trimmed ? trimmed.replace(/\\n/g, '\n') : undefined;
}
