import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgRoleGuard } from '../guards/org-role.guard';
import { Roles } from '../decorators/roles.decorator';
import {
    AdminOnly,
    OwnerOrAdmin,
    AnyRole,
    BrandonOnly,
    OrgRoles,
} from '../decorators/org-roles.decorator';
import { GetUser } from '../decorators/get-user.decorator';
import { UserRole } from '../../user/entities/user.entity';
import { AuthenticatedUser } from '../interfaces/authenticated-request.interface';

@ApiTags('Role Guard Examples')
@ApiBearerAuth()
@Controller('examples/roles')
export class RoleGuardExamplesController {
    // Basic Role Guard Examples
    @Get('basic/admin-only')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.BRANDON)
    @ApiOperation({ summary: 'Admin only endpoint (basic role guard)' })
    basicAdminOnly(@GetUser() user: AuthenticatedUser) {
        return {
            message: 'This endpoint is accessible by admins and brandon only',
            user: { id: user.id, role: user.role },
        };
    }

    @Get('basic/owner-or-admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.BRANDON)
    @ApiOperation({ summary: 'Owner or admin endpoint (basic role guard)' })
    basicOwnerOrAdmin(@GetUser() user: AuthenticatedUser) {
        return {
            message:
                'This endpoint is accessible by owners, admins, and brandon',
            user: { id: user.id, role: user.role },
        };
    }

    @Get('basic/any-authenticated')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Any authenticated user (no role restriction)' })
    basicAnyAuthenticated(@GetUser() user: AuthenticatedUser) {
        return {
            message: 'This endpoint is accessible by any authenticated user',
            user: { id: user.id, role: user.role },
        };
    }

    // Organizational Role Guard Examples
    @Get('org/:orgId/admin-only')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @AdminOnly()
    @ApiOperation({ summary: 'Admin only within organization' })
    orgAdminOnly(
        @Param('orgId') orgId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'Admin only within the same organization',
            orgId,
            user: { id: user.id, role: user.role, orgId: user.orgId },
        };
    }

    @Get('org/:orgId/admin-cross-org')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @AdminOnly(true) // Allow cross-org access
    @ApiOperation({ summary: 'Admin with cross-organization access' })
    orgAdminCrossOrg(
        @Param('orgId') orgId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'Admin can access across organizations',
            orgId,
            user: { id: user.id, role: user.role, orgId: user.orgId },
        };
    }

    @Get('org/:orgId/owner-or-admin')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @OwnerOrAdmin()
    @ApiOperation({ summary: 'Owner or admin within organization' })
    orgOwnerOrAdmin(
        @Param('orgId') orgId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'Owner or admin within the same organization',
            orgId,
            user: { id: user.id, role: user.role, orgId: user.orgId },
        };
    }

    @Get('org/:orgId/any-role')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @AnyRole()
    @ApiOperation({ summary: 'Any role within organization' })
    orgAnyRole(
        @Param('orgId') orgId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'Any authenticated user within the organization',
            orgId,
            user: { id: user.id, role: user.role, orgId: user.orgId },
        };
    }

    @Delete('org/:orgId/super-admin')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @BrandonOnly()
    @ApiOperation({ summary: 'Brandon only (super admin)' })
    orgBrandonOnly(
        @Param('orgId') orgId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'This is a super admin only operation',
            orgId,
            user: { id: user.id, role: user.role },
        };
    }

    // Branch-specific examples
    @Get('org/:orgId/branches/:branchId/users')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @AnyRole()
    @ApiOperation({ summary: 'Branch users (any role within branch)' })
    branchUsers(
        @Param('orgId') orgId: string,
        @Param('branchId') branchId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'Branch users accessible by any role within the branch',
            orgId,
            branchId,
            user: {
                id: user.id,
                role: user.role,
                orgId: user.orgId,
                branchId: user.branchId,
            },
        };
    }

    @Post('org/:orgId/branches/:branchId/users')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @AdminOnly(true) // Allow cross-org access for admins
    @ApiOperation({ summary: 'Add branch user (admin with cross-org access)' })
    addBranchUser(
        @Param('orgId') orgId: string,
        @Param('branchId') branchId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message: 'Admin can add users across organizations',
            orgId,
            branchId,
            user: {
                id: user.id,
                role: user.role,
                orgId: user.orgId,
                branchId: user.branchId,
            },
        };
    }

    // Custom role configuration example
    @Put('org/:orgId/sensitive-settings')
    @UseGuards(JwtAuthGuard, OrgRoleGuard)
    @OrgRoles({
        roles: [UserRole.OWNER, UserRole.BRANDON],
        allowCrossOrg: false,
        allowCrossBranch: true,
    })
    @ApiOperation({ summary: 'Custom role configuration example' })
    customRoleConfig(
        @Param('orgId') orgId: string,
        @GetUser() user: AuthenticatedUser,
    ) {
        return {
            message:
                'Custom role configuration: Owner or Brandon only, no cross-org',
            orgId,
            user: { id: user.id, role: user.role, orgId: user.orgId },
        };
    }
}
