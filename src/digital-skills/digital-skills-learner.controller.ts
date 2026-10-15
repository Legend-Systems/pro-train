import { Controller, Get, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';

import {
    OrgBranchScope,
    type OrgBranchScope as OrgBranchScopeType,
} from '../auth/decorators/org-branch-scope.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../user/entities/user.entity';
import { StandardApiResponse } from '../user/dto/common-response.dto';
import { DigitalSkillsPlanDto } from './dto/digital-skills-plan.dto';
import { DigitalSkillsPlanService } from './services/digital-skills-plan.service';

/**
 * Learner Digital Skills plan: own baseline score and assigned modules.
 */
@ApiTags('Digital Skills')
@Controller('digital-skills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
    UserRole.USER,
    UserRole.ADMINISTRATIVE_STAFF,
    UserRole.SENIOR_MANAGERS,
    UserRole.WAREHOUSE_STAFF,
    UserRole.DRIVERS,
    UserRole.ADMIN,
    UserRole.OWNER,
    UserRole.MASTER_ADMIN,
)
@ApiBearerAuth('JWT-auth')
export class DigitalSkillsLearnerController {
    constructor(private readonly planService: DigitalSkillsPlanService) {}

    @Get('me')
    @ApiOperation({
        summary: 'Own Digital Skills score, levels, and assigned training plan',
    })
    @ApiOkResponse({ type: DigitalSkillsPlanDto })
    async getMyPlan(
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<StandardApiResponse<DigitalSkillsPlanDto>> {
        const data = await this.planService.getPlanForUser(
            scope.userId,
            scope.orgId,
        );
        return {
            success: true,
            message: 'Digital Skills plan retrieved successfully',
            data,
        };
    }
}
