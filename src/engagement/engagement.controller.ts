import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StandardResponse } from '../common/types/standard-response.type';
import { UserRole } from '../user/entities/user.entity';
import { EngagementOverviewQueryDto } from './dto/engagement-overview-query.dto';
import { EngagementOverview } from './dto/engagement-overview.types';
import { EngagementService } from './engagement.service';

@ApiTags('Material engagement')
@ApiBearerAuth('JWT-auth')
@Controller('engagement')
@UseGuards(JwtAuthGuard)
export class EngagementController {
    constructor(private readonly engagementService: EngagementService) {}

    @Post('courses/:courseId/view')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Record that a learner opened a training course',
    })
    recordCourseView(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardResponse<{ recorded: boolean }>> {
        return this.engagementService.recordCourseView(scope, courseId);
    }

    @Post('manuals/:manualKey/download')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Record that a learner downloaded a training manual',
    })
    recordManualDownload(
        @Param('manualKey') manualKey: string,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardResponse<{ recorded: boolean }>> {
        return this.engagementService.recordManualDownload(scope, manualKey);
    }

    @Get('overview')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.OWNER, UserRole.MASTER_ADMIN)
    @ApiOperation({
        summary: 'List which learners opened courses and downloaded materials',
    })
    getOverview(
        @OrgBranchScope() scope: OrgBranchScope,
        @Query() query: EngagementOverviewQueryDto,
    ): Promise<StandardResponse<EngagementOverview>> {
        return this.engagementService.getOverview(scope, query);
    }
}
