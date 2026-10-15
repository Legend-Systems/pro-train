import { Controller, Get, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiSecurity,
    ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import {
    OrgBranchScope,
    type OrgBranchScope as OrgBranchScopeType,
} from '../auth/decorators/org-branch-scope.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../user/entities/user.entity';
import { StandardApiResponse } from '../user/dto/common-response.dto';
import { AdminDigitalSkillsReportDto } from './dto/admin-digital-skills-report.dto';
import { DigitalSkillsAdminService } from './services/digital-skills-admin.service';

/**
 * Admin Digital Skills report. Lives under reports/admin so the web hub
 * can call it the same way as the other insight endpoints.
 */
@ApiTags('📊 Admin Reporting')
@Controller('reports/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MASTER_ADMIN)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token',
    required: true,
})
export class DigitalSkillsController {
    constructor(
        private readonly digitalSkillsAdminService: DigitalSkillsAdminService,
    ) {}

    @Get('digital-skills')
    @ApiOperation({
        summary: 'Digital Skills assessments and who needs training',
        description:
            'Latest self-assessment per active learner on course 50. ' +
            'Score is 0–100 from the 1–6 ratings. Needs training = ' +
            'Urgent Training (0–25) or Beginner (26–45). Not an exam and ' +
            'not mixed into the leaderboard.',
    })
    @ApiOkResponse({ type: AdminDigitalSkillsReportDto })
    async getDigitalSkillsReport(
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<StandardApiResponse<AdminDigitalSkillsReportDto>> {
        const data = await this.digitalSkillsAdminService.getAdminReport(scope);
        return {
            success: true,
            message: 'Digital Skills report retrieved successfully',
            data,
        };
    }
}
