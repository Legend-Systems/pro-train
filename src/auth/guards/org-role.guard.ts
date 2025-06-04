import { Reflector } from '@nestjs/core';
import { UserRole } from '../../user/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
    AuthenticatedRequest,
    AuthenticatedUser,
} from '../interfaces/authenticated-request.interface';
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

export interface OrgRoleConfig {
    roles: UserRole[];
    allowCrossOrg?: boolean; // Allows access across organizations
    allowCrossBranch?: boolean; // Allows access across branches within org
}

export const ORG_ROLE_KEY = 'orgRole';

@Injectable()
export class OrgRoleGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const orgRoleConfig = this.reflector.getAllAndOverride<OrgRoleConfig>(
            ORG_ROLE_KEY,
            [context.getHandler(), context.getClass()],
        );

        // Fall back to basic roles if no org role config
        if (!orgRoleConfig) {
            const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
                ROLES_KEY,
                [context.getHandler(), context.getClass()],
            );

            if (!requiredRoles) {
                return true;
            }

            const request = context
                .switchToHttp()
                .getRequest<AuthenticatedRequest>();
            const user = request.user;

            if (!user) {
                return false;
            }

            return this.checkBasicRole(user.role, requiredRoles);
        }

        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        const user = request.user;

        if (!user) {
            return false;
        }

        return this.checkOrgRole(user, orgRoleConfig, request);
    }

    private checkBasicRole(
        userRole: UserRole | undefined,
        requiredRoles: UserRole[],
    ): boolean {
        // Brandon role has access to everything
        if (userRole === UserRole.BRANDON) {
            return true;
        }

        // Check if user has any of the required roles
        return requiredRoles.some(role => userRole === role);
    }

    private checkOrgRole(
        user: AuthenticatedUser,
        config: OrgRoleConfig,
        request: AuthenticatedRequest,
    ): boolean {
        // Brandon role has access to everything everywhere
        if (user.role === UserRole.BRANDON) {
            return true;
        }

        // Check if user has required role
        const hasRequiredRole = config.roles.some(role => user.role === role);
        if (!hasRequiredRole) {
            return false;
        }

        // Extract org/branch info from request params
        const params = request.params;
        const targetOrgId = params.orgId || params.organizationId;
        const targetBranchId = params.branchId;

        // If no target org specified, user must have org access
        if (!targetOrgId && !user.orgId) {
            return false;
        }

        // Business Logic: OWNER has access to everything within their organization
        if ((user.role as UserRole) === UserRole.OWNER) {
            // Owners have full access within their organization, regardless of branch
            if (targetOrgId && user.orgId === targetOrgId) {
                return true;
            }
            // If no specific org in URL, owner has access within their org
            if (!targetOrgId && user.orgId) {
                return true;
            }
            return false;
        }

        // For admins, allow cross-organization access if configured
        if (user.role === UserRole.ADMIN && config.allowCrossOrg) {
            return true;
        }

        // Check organization scope for non-owner/non-brandon roles
        if (targetOrgId && user.orgId !== targetOrgId) {
            return false;
        }

        // Check branch scope if specified
        if (targetBranchId && config.allowCrossBranch === false) {
            // OWNER bypasses branch restrictions within their organization
            if (
                (user.role as UserRole) === UserRole.OWNER &&
                user.orgId === targetOrgId
            ) {
                return true;
            }
            return user.branchId === targetBranchId;
        }

        return true;
    }
}
