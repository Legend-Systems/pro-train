import { MachineTranslationService } from './machine-translation.service';
import type { TranslationProvider } from './content-translation.types';

describe('MachineTranslationService', () => {
    const provider: TranslationProvider = {
        translateBatch: jest.fn(async ({ texts }) =>
            texts.map((text) => `[pt-PT] ${text}`),
        ),
    };

    const configService = {
        get: jest.fn((key: string) => {
            const values: Record<string, string> = {
                CONTENT_TRANSLATION_MAX_BATCH_CHARS: '10',
                CONTENT_TRANSLATION_RETRY_ATTEMPTS: '2',
                CONTENT_TRANSLATION_MIN_REQUEST_INTERVAL_MS: '0',
                CONTENT_TRANSLATION_MONTHLY_CHAR_BUDGET: '100000',
            };
            return values[key];
        }),
    };

    const cacheStore = new Map<string, number>();
    const cacheManager = {
        get: jest.fn(async (key: string) => cacheStore.get(key)),
        set: jest.fn(async (key: string, value: number) => {
            cacheStore.set(key, value);
        }),
    };

    let service: MachineTranslationService;

    beforeEach(() => {
        cacheStore.clear();
        jest.clearAllMocks();
        service = new MachineTranslationService(
            provider,
            configService as never,
            cacheManager as never,
        );
    });

    it('returns an empty array without calling the provider', async () => {
        const actual = await service.translateTexts([]);
        expect(actual).toEqual([]);
        expect(provider.translateBatch).not.toHaveBeenCalled();
    });

    it('preserves order across character batches', async () => {
        const actual = await service.translateTexts([
            '12345',
            '67890',
            'abcde',
        ]);

        expect(actual).toEqual([
            '[pt-PT] 12345',
            '[pt-PT] 67890',
            '[pt-PT] abcde',
        ]);
        expect(provider.translateBatch).toHaveBeenCalledTimes(2);
    });

    it('retries a failed provider call then succeeds', async () => {
        (provider.translateBatch as jest.Mock)
            .mockRejectedValueOnce(new Error('transient'))
            .mockResolvedValueOnce(['[pt-PT] Hello']);

        const actual = await service.translateTexts(['Hello']);
        expect(actual).toEqual(['[pt-PT] Hello']);
        expect(provider.translateBatch).toHaveBeenCalledTimes(2);
    });

    it('does not retry PERMISSION_DENIED provider errors', async () => {
        const denied = Object.assign(new Error('7 PERMISSION_DENIED:'), {
            code: 7,
        });
        (provider.translateBatch as jest.Mock).mockRejectedValue(denied);

        await expect(service.translateTexts(['Hello'])).rejects.toThrow(
            'PERMISSION_DENIED',
        );
        expect(provider.translateBatch).toHaveBeenCalledTimes(1);
    });
});
