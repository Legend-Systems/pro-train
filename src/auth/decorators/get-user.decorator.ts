import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

export const GetUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
        const user = request.user;

        // If no specific data key is requested, return the entire user object
        if (!data) {
            return user;
        }

        // Return specific property of the user object
        return user[data as keyof typeof user];
    },
);
