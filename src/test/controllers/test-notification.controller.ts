import {
    Controller,
    Get,
    Logger,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator';
import {
    OrgBranchScope,
    type OrgBranchScope as OrgBranchScopeType,
} from '../../auth/decorators/org-branch-scope.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UserRole } from '../../user/entities/user.entity';
import { StandardApiResponse } from '../../user/dto/common-response.dto';
import { TestNotificationService } from '../services/test-notification.service';

@ApiTags('Test Exam Notifications')
@ApiBearerAuth()
@Controller('tests/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestNotificationController {
    private readonly logger = new Logger(TestNotificationController.name);

    constructor(
        private readonly testNotificationService: TestNotificationService,
    ) {}

    @Get('upcoming')
    @Roles(UserRole.USER, UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({
        summary: 'List upcoming exams for the current user (in-app banners)',
    })
    @ApiQuery({ name: 'withinDays', required: false, type: Number })
    @ApiOkResponse({ description: 'Upcoming exams the user should take' })
    async listUpcomingForCurrentUser(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('withinDays') withinDays?: string,
    ): Promise<StandardApiResponse<unknown>> {
        if (!scope.userId) {
            return {
                success: false,
                message: 'User context required',
                data: [],
            };
        }
        const data =
            await this.testNotificationService.listUpcomingExamsForUser({
                userId: scope.userId,
                orgId: scope.orgId,
                withinDays: withinDays ? Number(withinDays) : 7,
            });
        return {
            success: true,
            message: 'Upcoming exams retrieved',
            data,
        };
    }

    @Get('history')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({
        summary: 'Admin: sent/failed exam reminder history for the org',
    })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async listHistory(
        @OrgBranchScope() scope: OrgBranchScopeType,
        @Query('limit') limit?: string,
    ): Promise<StandardApiResponse<unknown>> {
        if (!scope.orgId) {
            return {
                success: false,
                message: 'Organization context required',
                data: [],
            };
        }
        const data = await this.testNotificationService.listNotifications({
            orgId: scope.orgId,
            limit: limit ? Number(limit) : 100,
        });
        return {
            success: true,
            message: 'Exam notification history retrieved',
            data,
        };
    }

    @Post('process')
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({
        summary: 'Admin: manually trigger exam reminder processing',
    })
    async processNow(): Promise<StandardApiResponse<unknown>> {
        this.logger.log('Manual exam reminder processing triggered');
        const data =
            await this.testNotificationService.processUpcomingExamReminders();
        return {
            success: true,
            message: 'Exam reminder processing completed',
            data,
        };
    }
}
