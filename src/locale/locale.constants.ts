/** Default content and UI locale when nothing else matches. */
export const DEFAULT_LOCALE = 'en' as const;

/** Locales supported by ProTrain (aligned with web client). */
export const SUPPORTED_LOCALES = ['en', 'pt-PT'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** BCP-47 pattern for validation (`en`, `pt-PT`). */
export const LOCALE_TAG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
