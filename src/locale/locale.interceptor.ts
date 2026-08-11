import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { LocaleService } from './locale.service';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

export const LOCALE_REQUEST_KEY = 'locale';

export type RequestWithLocale = AuthenticatedRequest & {
    [LOCALE_REQUEST_KEY]?: string;
};

/**
 * Resolves `request.locale` on every HTTP request using query, header,
 * user preference, and org defaults.
 */
@Injectable()
export class LocaleInterceptor implements NestInterceptor {
    constructor(private readonly localeService: LocaleService) {}

    async intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Promise<Observable<unknown>> {
        const request = context.switchToHttp().getRequest<RequestWithLocale>();

        const queryLocale =
            typeof request.query?.locale === 'string'
                ? request.query.locale
                : undefined;

        const orgConfig = await this.localeService.loadOrgLocaleConfig(
            request.user?.orgId,
        );

        request[LOCALE_REQUEST_KEY] = this.localeService.resolveLocale({
            queryLocale,
            acceptLanguage: request.headers['accept-language'],
            userPreferredLanguage: request.user?.preferredLanguage,
            orgDefaultLanguage: orgConfig.defaultLanguage,
            orgSupportedLanguages: orgConfig.supportedLanguages,
        });

        return next.handle();
    }
}
