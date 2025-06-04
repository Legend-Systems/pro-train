import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface OrgBranchScope {
    orgId?: string;
    branchId?: string;
    userId: string;
    userRole?: string;
}

interface AuthenticatedUser {
    id: string;
    orgId?: string;
    branchId?: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
}

interface RequestWithUser extends Request {
    user?: AuthenticatedUser;
}

export const OrgBranchScope = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): OrgBranchScope => {
        const request = ctx.switchToHttp().getRequest<RequestWithUser>();
        const user = request.user;

        if (!user) {
            throw new Error('User not found in request');
        }

        return {
            orgId: user.orgId,
            branchId: user.branchId,
            userId: user.id,
            userRole: user.role,
        };
    },
);

export const GetOrgId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string | undefined => {
        const request = ctx.switchToHttp().getRequest<RequestWithUser>();
        return request.user?.orgId;
    },
);

export const GetBranchId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string | undefined => {
        const request = ctx.switchToHttp().getRequest<RequestWithUser>();
        return request.user?.branchId;
    },
);

export const GetUserId = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): string => {
        const request = ctx.switchToHttp().getRequest<RequestWithUser>();
        const user = request.user;

        if (!user) {
            throw new Error('User not found in request');
        }

        return user.id;
    },
);
