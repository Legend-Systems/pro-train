import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Counts assistance requests per signed-in user rather than per IP address.
 */
@Injectable()
export class AssistanceThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(req: Record<string, any>): Promise<string> {
        const user = req.user as { id?: string } | undefined;
        if (typeof user?.id === 'string' && user.id.length > 0) {
            return `user:${user.id}`;
        }

        const ip = req.ip;
        return typeof ip === 'string' && ip.length > 0 ? ip : 'unknown';
    }

    protected getErrorMessage(
        _context: ExecutionContext,
        _detail: unknown,
    ): Promise<string> {
        return Promise.resolve(
            'Please wait a few minutes before requesting help again.',
        );
    }
}
