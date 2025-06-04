# Role Guards Documentation

This directory contains role-based access control (RBAC) guards for the TrainPro application.

## Overview

The role guard system provides two main guards:

1. **RolesGuard** - Basic role-based access control
2. **OrgRoleGuard** - Advanced role-based access control with organizational scope

## User Roles

The system supports four user roles (in order of privilege):

```typescript
enum UserRole {
    BRANDON = 'brandon', // Super admin - access to everything
    OWNER = 'owner', // Organization owner
    ADMIN = 'admin', // Organization admin
    USER = 'user', // Regular user
}
```

## Basic Role Guard

### Usage

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    @Get('users')
    @Roles(UserRole.ADMIN, UserRole.OWNER)
    getUsers() {
        // Only admins and owners can access this
    }

    @Get('super-admin')
    @Roles(UserRole.BRANDON)
    superAdminOnly() {
        // Only brandon role can access this
    }
}
```

### Features

- Simple role checking
- Brandon role has access to everything
- Multiple roles can be specified
- Falls back to allowing access if no roles are specified

## Organizational Role Guard

### Usage

```typescript
import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgRoleGuard } from '../auth/guards/org-role.guard';
import {
    AdminOnly,
    OwnerOrAdmin,
    OrgRoles,
} from '../auth/decorators/org-roles.decorator';
import { UserRole } from '../user/entities/user.entity';

@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class OrganizationController {
    @Get('branches')
    @OwnerOrAdmin(true) // Allow cross-org access for admins
    getBranches(@Param('orgId') orgId: string) {
        // Owners and admins can access, admins can access across orgs
    }

    @Get('branches/:branchId/edit')
    @AdminOnly(false) // No cross-org access
    editBranch(
        @Param('orgId') orgId: string,
        @Param('branchId') branchId: string,
    ) {
        // Only admins within the same organization
    }

    @Get('sensitive-data')
    @OrgRoles({
        roles: [UserRole.OWNER],
        allowCrossOrg: false,
        allowCrossBranch: true,
    })
    getSensitiveData() {
        // Custom role configuration
    }
}
```

### Convenience Decorators

#### `@AdminOnly(allowCrossOrg?: boolean)`

- Allows: ADMIN, BRANDON
- Default: `allowCrossOrg = false`

#### `@OwnerOrAdmin(allowCrossOrg?: boolean)`

- Allows: OWNER, ADMIN, BRANDON
- Default: `allowCrossOrg = false`

#### `@AnyRole()`

- Allows: All roles (USER, ADMIN, OWNER, BRANDON)
- Cross-org: false, Cross-branch: true

#### `@BrandonOnly()`

- Allows: BRANDON only
- Cross-org: true, Cross-branch: true

### Advanced Configuration

```typescript
@OrgRoles({
    roles: [UserRole.ADMIN, UserRole.OWNER],
    allowCrossOrg: true,     // Can access other organizations
    allowCrossBranch: false  // Must be in same branch
})
```

## Special Rules

### Brandon Role

- Has access to **everything** regardless of organization or branch
- Bypasses all organizational scope checks
- Should be used sparingly for super admin accounts

### Owner Role - Business Logic

**Key Business Rule**: OWNER role has access to **everything** within their organization, regardless of branch restrictions.

- Owners can access all branches within their organization
- Owners bypass all branch-level restrictions within their org
- Owners cannot access other organizations (unless they have multiple org memberships)
- This reflects the business logic that organization owners should have full control over their organization

### Admin Cross-Organization Access

Based on the system memory: "Admins and 'brandon' users can edit any branch within their organization, even if their scope includes a specific branchId, as long as their role is sufficiently high and the organization matches the branch being edited."

- Admins can edit any branch within their organization
- With `allowCrossOrg: true`, admins can access other organizations
- Brandon users can always access everything

### Parameter Detection

The guard automatically detects organization and branch IDs from request parameters:

- `orgId` or `organizationId` for organization scope
- `branchId` for branch scope

## Implementation Details

### Request Flow

1. Extract user from JWT token
2. Check if user has required role
3. If organizational scope is enabled:
    - Extract target org/branch from request params
    - Verify user has access to target org/branch
    - Apply cross-org/cross-branch rules

### Guard Behavior

The `OrgRoleGuard` automatically falls back to basic role checking when:
- No organizational role configuration is provided (using `@Roles()` instead of `@OrgRoles()`)
- This allows for simple role-based access without organizational scope
- Business logic still applies: OWNER and BRANDON bypass restrictions even in basic mode

### Error Handling

- Returns `false` (403 Forbidden) if access is denied
- Returns `true` if access is granted
- Falls back to basic role checking if no org config is provided

## Best Practices

1. **Always use with JwtAuthGuard**: Ensure user is authenticated first
2. **Order matters**: `@UseGuards(JwtAuthGuard, OrgRoleGuard)`
3. **Use convenience decorators**: They provide sensible defaults
4. **Be explicit about cross-org access**: Default is `false` for security
5. **Test thoroughly**: Role-based access control is critical for security

## Examples

### Basic Admin Panel

```typescript
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPanelController {
    @Get('dashboard')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.BRANDON)
    getDashboard() {
        return 'Admin dashboard';
    }
}
```

### Organization Management

```typescript
@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class OrgManagementController {
    @Put('settings')
    @OwnerOrAdmin() // Only within same org
    updateSettings(@Param('orgId') orgId: string) {
        // Update organization settings
    }

    @Delete()
    @BrandonOnly() // Super admin only
    deleteOrganization(@Param('orgId') orgId: string) {
        // Delete entire organization
    }
}
```

### Branch-Specific Operations

```typescript
@Controller('organizations/:orgId/branches/:branchId')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class BranchController {
    @Get('users')
    @AnyRole() // All authenticated users in same org/branch
    getUsers() {
        return 'Branch users';
    }

    @Post('users')
    @AdminOnly(true) // Admins can add users across orgs
    addUser() {
        return 'User added';
    }
}
```
 