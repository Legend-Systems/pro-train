import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../user/entities/user.entity';
import { ORG_ROLE_KEY, OrgRoleConfig } from '../guards/org-role.guard';

export const OrgRoles = (config: OrgRoleConfig) =>
    SetMetadata(ORG_ROLE_KEY, config);

// Convenience decorators for common scenarios
export const AdminOnly = (allowCrossOrg: boolean = false) =>
    OrgRoles({
        roles: [UserRole.ADMIN, UserRole.MASTER_ADMIN],
        allowCrossOrg,
        allowCrossBranch: true,
    });

export const OwnerOrAdmin = (allowCrossOrg: boolean = false) =>
    OrgRoles({
        roles: [UserRole.OWNER, UserRole.ADMIN, UserRole.MASTER_ADMIN],
        allowCrossOrg,
        allowCrossBranch: true,
    });

export const AnyRole = () =>
    OrgRoles({
        roles: [
            UserRole.USER,
            UserRole.ADMIN,
            UserRole.OWNER,
            UserRole.MASTER_ADMIN,
        ],
        allowCrossOrg: false,
        allowCrossBranch: true,
    });

export const MasterAdminOnly = () =>
    OrgRoles({
        roles: [UserRole.MASTER_ADMIN],
        allowCrossOrg: true,
        allowCrossBranch: true,
    });

/** @deprecated Use {@link MasterAdminOnly} instead. */
export const BrandonOnly = MasterAdminOnly;
