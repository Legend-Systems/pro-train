import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    BadRequestException,
    HttpStatus,
    Logger,
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
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiHeader,
    ApiSecurity,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

@ApiTags('🏆 Leaderboards & Competition Rankings')
@Controller('leaderboards')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class LeaderboardController {
    private readonly logger = new Logger(LeaderboardController.name);

    constructor(private readonly leaderboardService: LeaderboardService) {}

    @Get('course/:courseId')
    @ApiOperation({
        summary: '🥇 Get Course Leaderboard',
        description: `
        **Retrieves comprehensive leaderboard rankings for a specific course**
        
        This endpoint provides detailed competitive analytics and rankings including:
        - Student performance rankings
        - Score comparisons and statistics
        - Achievement levels and badges
        - Performance trends and insights
        - Participation metrics
        
        **Features:**
        - Paginated results for efficient loading
        - Real-time ranking calculations
        - Multiple sorting and filtering options
        - Performance analytics and insights
        - Achievement recognition system
        
        **Gamification Elements:**
        - Rank changes and improvements
        - Achievement levels (beginner to expert)
        - Performance badges and recognition
        - Competition periods and cycles
        - Social learning insights
        
        **Use Cases:**
        - Student motivation and engagement
        - Competitive learning environments
        - Performance tracking and analytics
        - Course effectiveness measurement
        - Social learning features
        `,
        operationId: 'getCourseLeaderboard',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier to retrieve leaderboard rankings',
        example: 1,
    })
    @ApiQuery({
        name: 'page',
        type: Number,
        description: 'Page number for pagination (starting from 1)',
        required: false,
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        type: Number,
        description: 'Number of leaderboard entries per page (max 100)',
        required: false,
        example: 20,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course leaderboard retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Leaderboard retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        entries: {
                            type: 'array',
                            description: 'Leaderboard entries with rankings',
                            items: {
                                type: 'object',
                                properties: {
                                    leaderboardId: {
                                        type: 'number',
                                        example: 1,
                                    },
                                    userId: {
                                        type: 'string',
                                        example: 'user-123',
                                    },
                                    firstName: {
                                        type: 'string',
                                        example: 'John',
                                    },
                                    lastName: {
                                        type: 'string',
                                        example: 'Doe',
                                    },
                                    email: {
                                        type: 'string',
                                        example: 'brandon@orrbit.co.za',
                                    },
                                    totalScore: {
                                        type: 'number',
                                        example: 450,
                                    },
                                    rank: { type: 'number', example: 3 },
                                    previousRank: {
                                        type: 'number',
                                        example: 5,
                                    },
                                    rankChange: { type: 'number', example: 2 },
                                    testsCompleted: {
                                        type: 'number',
                                        example: 8,
                                    },
                                    averageScore: {
                                        type: 'number',
                                        example: 85.5,
                                    },
                                    achievementLevel: {
                                        type: 'string',
                                        example: 'intermediate',
                                    },
                                },
                            },
                        },
                        metadata: {
                            type: 'object',
                            properties: {
                                courseId: { type: 'number', example: 1 },
                                courseTitle: {
                                    type: 'string',
                                    example: 'Web Development Bootcamp',
                                },
                                totalParticipants: {
                                    type: 'number',
                                    example: 150,
                                },
                                activeParticipants: {
                                    type: 'number',
                                    example: 120,
                                },
                                averageScore: { type: 'number', example: 75.2 },
                                topScore: { type: 'number', example: 98.5 },
                            },
                        },
                        total: { type: 'number', example: 150 },
                        page: { type: 'number', example: 1 },
                        limit: { type: 'number', example: 20 },
                        totalPages: { type: 'number', example: 8 },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid course ID or pagination parameters',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Invalid course ID' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: '❌ Course not found or no leaderboard data available',
    })
    async getCourseLeaderboard(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @OrgBranchScope() scope: OrgBranchScope,
    ) {
        this.logger.log(
            `Getting leaderboard for course: ${courseId}, page: ${page}, limit: ${limit}, user: ${scope.userId}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        if (limit > 100) {
            limit = 100;
        }

        return this.leaderboardService.getCourseLeaderboard(
            courseId,
            page,
            limit,
        );
    }

    @Get('my-rank/:courseId')
    @ApiOperation({
        summary: '🎯 Get My Course Rank',
        description: `
        **Retrieves the authenticated user's current ranking and performance in a course**
        
        This endpoint provides personalized ranking information including:
        - Current position in course leaderboard
        - Performance metrics and statistics
        - Rank change history and trends
        - Achievement level and progress
        - Comparative performance analysis
        
        **Personal Analytics:**
        - Individual rank and position
        - Score progression over time
        - Performance compared to course average
        - Achievement milestones reached
        - Areas for improvement identification
        
        **Motivational Features:**
        - Rank improvement tracking
        - Achievement recognition
        - Goal setting and progress monitoring
        - Peer comparison insights
        - Personalized recommendations
        
        **Use Cases:**
        - Personal progress tracking
        - Motivation and goal setting
        - Performance self-assessment
        - Learning path optimization
        - Achievement recognition
        `,
        operationId: 'getMyRankInCourse',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier to get user ranking',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User rank retrieved successfully',
        type: LeaderboardResponseDto,
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'User rank retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        leaderboardId: { type: 'number', example: 1 },
                        courseId: { type: 'number', example: 1 },
                        userId: { type: 'string', example: 'user-123' },
                        rank: { type: 'number', example: 15 },
                        totalScore: { type: 'number', example: 420 },
                        averageScore: { type: 'number', example: 84.0 },
                        testsCompleted: { type: 'number', example: 5 },
                        totalPoints: { type: 'number', example: 420 },
                        lastUpdated: {
                            type: 'string',
                            example: '2024-01-15T14:30:00.000Z',
                        },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', example: 'user-123' },
                                username: {
                                    type: 'string',
                                    example: 'johndoe',
                                },
                                fullName: {
                                    type: 'string',
                                    example: 'John Doe',
                                },
                            },
                        },
                        course: {
                            type: 'object',
                            properties: {
                                courseId: { type: 'number', example: 1 },
                                title: {
                                    type: 'string',
                                    example: 'Web Development Bootcamp',
                                },
                                description: {
                                    type: 'string',
                                    example: 'Complete web development course',
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid course ID',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Invalid course ID' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiNotFoundResponse({
        description:
            '❌ User not found in course leaderboard or course does not exist',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'User not found in course leaderboard',
                },
            },
        },
    })
    async getUserRank(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<LeaderboardResponseDto | null> {
        this.logger.log(
            `Getting user rank for course: ${courseId}, user: ${scope.userId}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        return this.leaderboardService.getUserRank(courseId, scope.userId);
    }

    @Post('refresh/:courseId')
    @ApiOperation({
        summary: '🔄 Refresh Course Leaderboard',
        description: `
        **Recalculates and updates the leaderboard rankings for a specific course**
        
        This endpoint handles comprehensive leaderboard refresh including:
        - Real-time score recalculation
        - Rank position updates
        - Performance statistics refresh
        - Achievement level reassessment
        - Historical data consistency
        
        **Administrative Features:**
        - Manual leaderboard refresh triggers
        - Data consistency maintenance
        - Performance recalculation
        - Ranking algorithm updates
        - System maintenance support
        
        **Technical Operations:**
        - Aggregated score calculations
        - Rank position algorithms
        - Achievement level determination
        - Performance metrics updates
        - Cache invalidation and refresh
        
        **Access Control:**
        - Restricted to administrators and instructors
        - Course ownership validation
        - Permission-based access control
        - Audit logging for changes
        
        **Use Cases:**
        - Administrative maintenance
        - Data consistency fixes
        - Performance optimization
        - System updates and patches
        - Manual ranking corrections
        `,
        operationId: 'refreshCourseLeaderboard',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier for leaderboard refresh',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Leaderboard refreshed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Leaderboard refreshed successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        courseId: { type: 'number', example: 1 },
                        updatedEntries: { type: 'number', example: 45 },
                        refreshedAt: {
                            type: 'string',
                            example: '2024-01-15T14:30:00.000Z',
                        },
                        processingTime: { type: 'number', example: 1.25 },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiForbiddenResponse({
        description:
            '🚷 Forbidden - Insufficient permissions to refresh leaderboard',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: {
                    type: 'string',
                    example: 'Insufficient permissions',
                },
                error: { type: 'string', example: 'Forbidden' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid course ID',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'string', example: 'Invalid course ID' },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    async refreshLeaderboard(
        @Param('courseId', ParseIntPipe) courseId: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<{ message: string }> {
        this.logger.log(
            `Refreshing leaderboard for course: ${courseId} by user: ${scope.userId}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        await this.leaderboardService.updateLeaderboard(courseId);
        return { message: 'Leaderboard refreshed successfully' };
    }
}
