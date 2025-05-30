import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiParam,
    ApiQuery,
    ApiBearerAuth,
    ApiNotFoundResponse,
    ApiBadRequestResponse,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('leaderboards')
@Controller('leaderboards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeaderboardController {
    constructor(private readonly leaderboardService: LeaderboardService) {}

    @Get('course/:courseId')
    @ApiOperation({
        summary: 'Get course leaderboard',
        description: 'Retrieve the leaderboard for a specific course with pagination',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID to get leaderboard for',
        type: 'number',
        example: 1,
    })
    @ApiQuery({
        name: 'page',
        description: 'Page number for pagination',
        required: false,
        type: 'number',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of items per page',
        required: false,
        type: 'number',
        example: 10,
    })
    @ApiResponse({
        status: 200,
        description: 'Course leaderboard retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                leaderboard: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/LeaderboardResponseDto' },
                },
                total: { type: 'number', example: 50 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
            },
        },
    })
    async getCourseLeaderboard(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));

        return this.leaderboardService.getCourseLeaderboard(courseId, pageNum, limitNum);
    }

    @Get('my-rank/:courseId')
    @ApiOperation({
        summary: 'Get user rank in course',
        description: 'Get the current user rank and stats for a specific course',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID to get user rank for',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'User rank retrieved successfully',
        type: LeaderboardResponseDto,
    })
    @ApiNotFoundResponse({
        description: 'User not found in course leaderboard',
    })
    async getUserRank(
        @Param('courseId', ParseIntPipe) courseId: number,
        @GetUser() user: User,
    ): Promise<LeaderboardResponseDto | null> {
        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        return this.leaderboardService.getUserRank(courseId, user.id);
    }

    @Post('refresh/:courseId')
    @ApiOperation({
        summary: 'Refresh course leaderboard',
        description: 'Recalculate and update the leaderboard for a specific course (admin only)',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID to refresh leaderboard for',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Leaderboard refreshed successfully',
    })
    @ApiBadRequestResponse({
        description: 'Invalid course ID',
    })
    async refreshLeaderboard(
        @Param('courseId', ParseIntPipe) courseId: number,
        @GetUser() user: User,
    ): Promise<{ message: string }> {
        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        await this.leaderboardService.updateLeaderboard(courseId);

        return { message: 'Leaderboard refreshed successfully' };
    }
}
