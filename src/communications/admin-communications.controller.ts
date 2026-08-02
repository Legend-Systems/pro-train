import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { UserRole } from '../user/entities/user.entity';
import { StandardResponse } from '../common/types/standard-response.type';
import { SendRoleBroadcastDto } from './dto/send-role-broadcast.dto';
import { RoleBroadcastResult } from './interfaces/role-broadcast-result.interface';
import { RoleRecipientCount } from './interfaces/role-recipient-count.interface';
import { RoleBroadcastService } from './services/role-broadcast.service';

/**
 * Administrative communications: one-time, role-targeted email broadcasts.
 *
 * Separate from `CommunicationsController` (which owns per-message CRUD) so the
 * broadcast surface can be documented in Swagger and guarded independently.
 */
@ApiTags('📣 Admin Communications')
@Controller('communications/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminCommunicationsController {
    constructor(private readonly roleBroadcastService: RoleBroadcastService) {}

    @Get('recipients')
    @ApiOperation({
        summary: '👥 Preview Broadcast Reach by Role',
        description: `
        **How many people would receive a broadcast?**

        Returns the number of active, contactable users behind every role in the
        caller's organization. The UI uses these counts to show reach next to
        each role checkbox and to warn before an empty send.

        **Security:**
        - Requires the admin, owner or master admin role
        - Counts are scoped to the caller's organization (master admins with no
          organization see platform-wide counts)
        `,
        operationId: 'getBroadcastRecipientCounts',
    })
    @ApiResponse({
        status: 200,
        description: 'Recipient counts per role',
    })
    @ApiResponse({ status: 403, description: 'Caller is not an administrator' })
    async getRecipientCounts(
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardResponse<RoleRecipientCount[]>> {
        const data = await this.roleBroadcastService.countRecipientsByRole(
            scope,
        );

        return {
            success: true,
            message: 'Recipient counts retrieved successfully',
            data,
        };
    }

    @Post('broadcasts')
    @ApiOperation({
        summary: '📧 Send a One-Time Email to Selected Roles',
        description: `
        **Compose once, send immediately, never again**

        The message is rendered into the branded email template and delivered
        synchronously to every active user whose role appears in
        \`recipientRoles\`. Users outside the selected roles are never contacted.

        **Business Rules:**
        - The send is immediate and happens exactly once — there is no schedule
          and no automatic re-send
        - The body is HTML-escaped, so pasted content cannot inject markup
        - Every recipient gets an audit row in \`communications\` recording the
          delivery outcome

        **Edge Cases:**
        - \`404\` when the selected roles match no active users
        - \`400\` when the selection exceeds the per-broadcast recipient ceiling
        - Partial SMTP failures are reported in \`failedCount\` /
          \`failedRecipients\` rather than failing the whole request

        **Security:**
        - Requires the admin, owner or master admin role
        - Recipients are restricted to the caller's organization
        `,
        operationId: 'sendRoleBroadcast',
    })
    @ApiBody({
        type: SendRoleBroadcastDto,
        description: 'Message content and the roles that should receive it',
        examples: {
            'learners-only': {
                summary: '🎓 Announce a new module to learners',
                value: {
                    title: 'New fire safety module available',
                    subject: 'Action required: complete your fire safety training',
                    body: 'A new fire safety module is now live.\n\nPlease complete it before the end of the month.',
                    recipientRoles: [UserRole.USER],
                },
            },
            'admins-and-owners': {
                summary: '🛠️ Notify the administration team',
                value: {
                    title: 'Quarterly reporting window opens Monday',
                    subject: 'Quarterly reporting window opens Monday',
                    body: 'Please review your branch reports before Friday.',
                    recipientRoles: [UserRole.ADMIN, UserRole.OWNER],
                },
            },
        },
    })
    @ApiResponse({
        status: 201,
        description: 'Broadcast sent with per-recipient delivery counts',
    })
    @ApiResponse({ status: 400, description: 'Invalid payload or audience too large' })
    @ApiResponse({ status: 403, description: 'Caller is not an administrator' })
    @ApiResponse({
        status: 404,
        description: 'No active users match the selected roles',
    })
    async sendBroadcast(
        @Body() sendRoleBroadcastDto: SendRoleBroadcastDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardResponse<RoleBroadcastResult>> {
        const data = await this.roleBroadcastService.sendRoleBroadcast(
            sendRoleBroadcastDto,
            scope,
        );

        return {
            success: true,
            message: this.buildOutcomeMessage(data),
            data,
        };
    }

    /** Human-readable summary the clients surface directly in a toast. */
    private buildOutcomeMessage(result: RoleBroadcastResult): string {
        const recipientLabel = result.sentCount === 1 ? 'recipient' : 'recipients';

        if (result.failedCount === 0) {
            return `Email sent to ${result.sentCount} ${recipientLabel}`;
        }

        return `Email sent to ${result.sentCount} of ${result.totalRecipients} recipients — ${result.failedCount} failed`;
    }
}
