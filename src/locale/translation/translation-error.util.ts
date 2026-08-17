/** gRPC status codes that should not be retried (configuration / auth failures). */
const NON_RETRYABLE_GRPC_CODES = new Set([
    3, // INVALID_ARGUMENT
    7, // PERMISSION_DENIED
    16, // UNAUTHENTICATED
]);

interface GrpcLikeError {
    readonly code?: number;
    readonly message?: string;
    readonly details?: string;
}

/**
 * Normalizes Google Cloud / gRPC errors into a single log-friendly string.
 * Training content is never included in the output.
 */
export function formatTranslationProviderError(error: unknown): string {
    if (!(error instanceof Error)) {
        return 'Unknown translation provider error';
    }

    const grpc = error as Error & GrpcLikeError;
    const code =
        typeof grpc.code === 'number' && Number.isFinite(grpc.code)
            ? grpc.code
            : undefined;
    const detail = extractGrpcDetail(grpc);
    const base = code !== undefined ? `${code} ${detail}` : detail;

    if (code === 7) {
        return (
            `${base}. ` +
            'Cloud Translation rejected the service account. Grant roles/cloudtranslate.user ' +
            'to the account configured in GOOGLE_TRANSLATE_CLIENT_EMAIL (or GOOGLE_CLOUD_CLIENT_EMAIL ' +
            'when no dedicated translate credentials are set). If using a separate translate service ' +
            'account, set both GOOGLE_TRANSLATE_CLIENT_EMAIL and GOOGLE_TRANSLATE_PRIVATE_KEY.'
        );
    }

    if (code === 16) {
        return (
            `${base}. ` +
            'Check GOOGLE_TRANSLATE_CLIENT_EMAIL and GOOGLE_TRANSLATE_PRIVATE_KEY (or the GCS fallback vars).'
        );
    }

    return base;
}

/**
 * Returns false for auth/permission/config errors where retries cannot succeed.
 */
export function isRetryableTranslationError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return true;
    }

    const code = (error as GrpcLikeError).code;
    return !(typeof code === 'number' && NON_RETRYABLE_GRPC_CODES.has(code));
}

function extractGrpcDetail(error: Error & GrpcLikeError): string {
    const trimmedMessage = error.message?.trim();
    if (trimmedMessage && trimmedMessage.length > 0) {
        return trimmedMessage;
    }

    if (typeof error.details === 'string' && error.details.trim().length > 0) {
        return error.details.trim();
    }

    return error.name || 'Translation provider error';
}
