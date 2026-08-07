import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../org/entities/org.entity';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
    type AppLocale,
} from './locale.constants';

export interface ResolveLocaleInput {
    readonly queryLocale?: string | null;
    readonly acceptLanguage?: string | null;
    readonly userPreferredLanguage?: string | null;
    readonly orgDefaultLanguage?: string | null;
    readonly orgSupportedLanguages?: readonly string[] | null;
}

/**
 * Normalizes raw locale tags to a supported AppLocale.
 * Examples: `pt` / `pt-BR` / `PT-pt` → `pt-PT`; unknown → null.
 */
export function normalizeLocale(
    raw: string | null | undefined,
): AppLocale | null {
    if (!raw) {
        return null;
    }

    const trimmed = raw.trim().replace(/_/g, '-');
    if (!trimmed) {
        return null;
    }

    const lower = trimmed.toLowerCase();

    if (lower === 'en' || lower.startsWith('en-')) {
        return 'en';
    }

    if (lower === 'pt' || lower.startsWith('pt-')) {
        return 'pt-PT';
    }

    const exact = SUPPORTED_LOCALES.find(
        (locale) => locale.toLowerCase() === lower,
    );
    return exact ?? null;
}

/**
 * Parses the first language tag from an Accept-Language header value.
 */
export function parseAcceptLanguage(
    header: string | null | undefined,
): AppLocale | null {
    if (!header) {
        return null;
    }

    const first = header.split(',')[0]?.trim();
    if (!first) {
        return null;
    }

    const tag = first.split(';')[0]?.trim();
    return normalizeLocale(tag);
}

@Injectable()
export class LocaleService {
    constructor(
        @InjectRepository(Organization)
        private readonly organizationRepository: Repository<Organization>,
    ) {}

    /**
     * Resolves the effective locale using the platform priority chain.
     */
    resolveLocale(input: ResolveLocaleInput): AppLocale {
        const supported = this.buildSupportedSet(input.orgSupportedLanguages);

        const candidates: Array<string | null | undefined> = [
            input.queryLocale,
            input.userPreferredLanguage,
            parseAcceptLanguage(input.acceptLanguage),
            input.orgDefaultLanguage,
            DEFAULT_LOCALE,
        ];

        for (const candidate of candidates) {
            const normalized = normalizeLocale(candidate);
            if (!normalized) {
                continue;
            }
            if (supported.has(normalized)) {
                return normalized;
            }
        }

        return DEFAULT_LOCALE;
    }

    /**
     * Validates a preferred language against org policy.
     */
    validatePreferredLanguage(
        locale: string,
        options: {
            readonly supportedLanguages?: readonly string[] | null;
            readonly allowUserLanguageChange?: boolean;
        },
    ): AppLocale {
        if (options.allowUserLanguageChange === false) {
            throw new Error('Organization disallows user language changes');
        }

        const normalized = normalizeLocale(locale);
        if (!normalized) {
            throw new Error(`Unsupported locale tag: ${locale}`);
        }

        const supported = this.buildSupportedSet(options.supportedLanguages);
        if (!supported.has(normalized)) {
            throw new Error(
                `Locale "${normalized}" is not enabled for this organization`,
            );
        }

        return normalized;
    }

    async loadOrgLocaleConfig(orgId: string | undefined): Promise<{
        defaultLanguage: AppLocale;
        supportedLanguages: AppLocale[];
        allowUserLanguageChange: boolean;
    }> {
        if (!orgId) {
            return {
                defaultLanguage: DEFAULT_LOCALE,
                supportedLanguages: [...SUPPORTED_LOCALES],
                allowUserLanguageChange: true,
            };
        }

        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
            select: ['id', 'whiteLabelingConfig'],
        });

        const localization = org?.whiteLabelingConfig?.localization;
        const supportedRaw = localization?.supportedLanguages ?? [
            ...SUPPORTED_LOCALES,
        ];
        const supported = supportedRaw
            .map((tag) => normalizeLocale(tag))
            .filter((tag): tag is AppLocale => tag !== null);

        return {
            defaultLanguage:
                normalizeLocale(localization?.defaultLanguage) ?? DEFAULT_LOCALE,
            supportedLanguages:
                supported.length > 0 ? supported : [...SUPPORTED_LOCALES],
            allowUserLanguageChange:
                localization?.allowUserLanguageChange ?? true,
        };
    }

    private buildSupportedSet(
        orgSupported?: readonly string[] | null,
    ): Set<AppLocale> {
        const tags = orgSupported?.length
            ? orgSupported
            : [...SUPPORTED_LOCALES];

        const normalized = tags
            .map((tag) => normalizeLocale(tag))
            .filter((tag): tag is AppLocale => tag !== null);

        return new Set(
            normalized.length > 0 ? normalized : [...SUPPORTED_LOCALES],
        );
    }
}
