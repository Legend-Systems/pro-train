import { Injectable, Logger } from '@nestjs/common';
import type { TranslationProvider } from './content-translation.types';

/**
 * Test / CI adapter. Prefixes strings so unit tests can assert mapping
 * without calling Google Cloud Translation.
 */
@Injectable()
export class NoopTranslationProvider implements TranslationProvider {
    private readonly logger = new Logger(NoopTranslationProvider.name);

    async translateBatch(params: {
        readonly texts: readonly string[];
        readonly sourceLocale: 'en';
        readonly targetLocale: 'pt-PT';
    }): Promise<readonly string[]> {
        this.logger.debug(
            `Noop translation of ${params.texts.length} string(s) ${params.sourceLocale} → ${params.targetLocale}`,
        );

        return params.texts.map((text) => `[pt-PT] ${text}`);
    }
}
