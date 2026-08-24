import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiHeader,
    ApiOkResponse,
    ApiOperation,
    ApiSecurity,
    ApiTags,
    ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    OrgBranchScope,
    type OrgBranchScope as OrgBranchScopeType,
} from '../auth/decorators/org-branch-scope.decorator';
import { HomeCarouselResponseDto } from './dto/home-carousel.dto';
import { HomeInsightsService } from './home-insights.service';

/**
 * Home carousel insights for web HomePage and mobile HomeScreen.
 * Admin-only fields are stripped server-side for regular users,
 * including bottom performers and lowest branch rankings on the leaderboard snapshot.
 */
@ApiTags('🏠 Home Insights')
@Controller('home-insights')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    required: true,
})
export class HomeInsightsController {
    private readonly logger = new Logger(HomeInsightsController.name);

    constructor(private readonly homeInsightsService: HomeInsightsService) {}

    @Get('carousel')
    @ApiOperation({
        summary: 'Get home carousel insights payload',
        description:
            'Returns educational tips, personal XP/performance, leaderboard snapshot, ' +
            'and admin org analytics when the caller is Master Admin, Owner, or Admin.',
        operationId: 'getHomeCarouselInsights',
    })
    @ApiOkResponse({ type: HomeCarouselResponseDto })
    @ApiUnauthorizedResponse({
        description: 'Unauthorized - Invalid or missing JWT token',
    })
    async getCarousel(
        @OrgBranchScope() scope: OrgBranchScopeType,
    ): Promise<HomeCarouselResponseDto> {
        this.logger.log(
            `Home carousel requested by user=${scope.userId} role=${scope.userRole}`,
        );
        return this.homeInsightsService.getCarousel(scope);
    }
}
