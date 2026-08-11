import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
    LOCALE_REQUEST_KEY,
    type RequestWithLocale,
} from './locale.interceptor';
import { DEFAULT_LOCALE } from './locale.constants';

/**
 * Injects the locale resolved by {@link LocaleInterceptor}.
 */
export const ResolvedLocale = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest<RequestWithLocale>();
        return request[LOCALE_REQUEST_KEY] ?? DEFAULT_LOCALE;
    },
);
