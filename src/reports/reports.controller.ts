import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    UseGuards,
    HttpStatus,
    ParseUUIDPipe,
    Query,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiBearerAuth,
    ApiOkResponse,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CourseReportsService } from './services/course-reports.service';
import { UserReportsService } from './services/user-reports.service';
import { TestReportsService } from './services/test-reports.service';
import { ResultsReportsService } from './services/results-reports.service';
import { LeaderboardReportsService } from './services/leaderboard-reports.service';
import { TrainingProgressReportsService } from './services/training-progress-reports.service';
import { CourseAnalyticsResponseDto } from './dto/course-analytics.dto';
import {
    UserAnalyticsResponseDto,
    GlobalUserStatsDto,
} from './dto/user-analytics.dto';
import {
    TestAnalyticsResponseDto,
    GlobalTestStatsDto,
} from './dto/test-analytics.dto';

@ApiTags('Reports')
@Controller('api/reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
    constructor(
        private readonly courseReportsService: CourseReportsService,
        private readonly userReportsService: UserReportsService,
        private readonly testReportsService: TestReportsService,
        private readonly resultsReportsService: ResultsReportsService,
        private readonly leaderboardReportsService: LeaderboardReportsService,
        private readonly trainingProgressReportsService: TrainingProgressReportsService,
    ) {}

    @Get('courses/:courseId/analytics')
    @ApiOperation({
        summary: 'Get comprehensive course analytics',
        description:
            'Retrieve detailed analytics for a specific course including enrollment stats, completion rates, and performance metrics. Data is cached for optimal performance.',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Unique identifier of the course',
        type: 'integer',
        example: 1,
    })
    @ApiOkResponse({
        description: 'Course analytics data retrieved successfully',
        type: CourseAnalyticsResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Course not found',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
    })
    async getCourseAnalytics(
        @Param('courseId', ParseIntPipe) courseId: number,
    ): Promise<CourseAnalyticsResponseDto> {
        return this.courseReportsService.getCourseAnalytics(courseId);
    }

    @Get('courses/:courseId/enrollment')
    @ApiOperation({
        summary: 'Get course enrollment trends',
        description:
            'Retrieve enrollment statistics and trends over time for a specific course.',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Unique identifier of the course',
        type: 'integer',
        example: 1,
    })
    @ApiOkResponse({
        description: 'Course enrollment data retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    date: {
                        type: 'string',
                        format: 'date',
                        example: '2024-01-15',
                    },
                    newEnrollments: {
                        type: 'number',
                        example: 12,
                    },
                },
            },
        },
    })
    async getCourseEnrollment(
        @Param('courseId', ParseIntPipe) courseId: number,
    ) {
        return this.courseReportsService.getCourseEnrollmentStats(courseId);
    }

    @Get('courses/popularity-ranking')
    @ApiOperation({
        summary: 'Get global course popularity ranking',
        description:
            'Retrieve the top 10 most popular courses based on enrollment and engagement metrics.',
    })
    @ApiOkResponse({
        description: 'Course popularity ranking retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    courseId: {
                        type: 'number',
                        example: 1,
                    },
                    title: {
                        type: 'string',
                        example: 'Introduction to Computer Science',
                    },
                    enrollments: {
                        type: 'number',
                        example: 150,
                    },
                    totalAttempts: {
                        type: 'number',
                        example: 450,
                    },
                },
            },
        },
    })
    async getCoursesPopularityRanking() {
        return this.courseReportsService.getAllCoursesPopularityRanking();
    }

    @Get('users/:userId/analytics')
    @ApiOperation({
        summary: 'Get comprehensive user analytics',
        description:
            'Retrieve detailed analytics for a specific user including test performance, engagement metrics, and learning insights. Data is cached for optimal performance.',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique identifier of the user',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiOkResponse({
        description: 'User analytics data retrieved successfully',
        type: UserAnalyticsResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
    })
    async getUserAnalytics(
        @Param('userId', ParseUUIDPipe) userId: string,
    ): Promise<UserAnalyticsResponseDto> {
        return this.userReportsService.getUserAnalytics(userId);
    }

    @Get('users/global-stats')
    @ApiOperation({
        summary: 'Get global user statistics',
        description:
            'Retrieve system-wide user statistics including active users, registration trends, and engagement metrics.',
    })
    @ApiOkResponse({
        description: 'Global user statistics retrieved successfully',
        type: GlobalUserStatsDto,
    })
    async getGlobalUserStats(): Promise<GlobalUserStatsDto> {
        return this.userReportsService.getGlobalUserStats();
    }

    @Get('users/registration-trends')
    @ApiOperation({
        summary: 'Get user registration trends',
        description:
            'Retrieve user registration trends over the last 30 days.',
    })
    @ApiOkResponse({
        description: 'User registration trends retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    date: {
                        type: 'string',
                        format: 'date',
                        example: '2024-01-15',
                    },
                    newRegistrations: {
                        type: 'number',
                        example: 5,
                    },
                },
            },
        },
    })
    async getUserRegistrationTrends() {
        return this.userReportsService.getUserRegistrationTrends();
    }

    @Get('tests/:testId/analytics')
    @ApiOperation({
        summary: 'Get comprehensive test analytics',
        description:
            'Retrieve detailed analytics for a specific test including performance metrics, quality insights, and completion statistics. Data is cached for optimal performance.',
    })
    @ApiParam({
        name: 'testId',
        description: 'Unique identifier of the test',
        type: 'integer',
        example: 1,
    })
    @ApiOkResponse({
        description: 'Test analytics data retrieved successfully',
        type: TestAnalyticsResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Test not found',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Authentication required',
    })
    async getTestAnalytics(
        @Param('testId', ParseIntPipe) testId: number,
    ): Promise<TestAnalyticsResponseDto> {
        return this.testReportsService.getTestAnalytics(testId);
    }

    @Get('tests/global-stats')
    @ApiOperation({
        summary: 'Get global test statistics',
        description:
            'Retrieve system-wide test statistics including completion rates, popular test types, and peak testing hours.',
    })
    @ApiOkResponse({
        description: 'Global test statistics retrieved successfully',
        type: GlobalTestStatsDto,
    })
    async getGlobalTestStats(): Promise<GlobalTestStatsDto> {
        return this.testReportsService.getGlobalTestStats();
    }

    @Get('tests/:testId/attempt-trends')
    @ApiOperation({
        summary: 'Get test attempt trends',
        description:
            'Retrieve test attempt trends over the last 30 days for a specific test.',
    })
    @ApiParam({
        name: 'testId',
        description: 'Unique identifier of the test',
        type: 'integer',
        example: 1,
    })
    @ApiOkResponse({
        description: 'Test attempt trends retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    date: {
                        type: 'string',
                        format: 'date',
                        example: '2024-01-15',
                    },
                    attempts: {
                        type: 'number',
                        example: 25,
                    },
                    completed: {
                        type: 'number',
                        example: 18,
                    },
                },
            },
        },
    })
    async getTestAttemptTrends(@Param('testId', ParseIntPipe) testId: number) {
        return this.testReportsService.getTestAttemptTrends(testId);
    }

    // Results Reports Endpoints
    @Get('results/:userId/analytics')
    @ApiOperation({
        summary: 'Get comprehensive results analytics for user',
        description:
            'Retrieve detailed results analytics for a specific user including score distribution, performance insights, and quality metrics.',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique identifier of the user',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    async getUserResultsAnalytics(@Param('userId', ParseUUIDPipe) userId: string) {
        return this.resultsReportsService.getResultsAnalytics(userId);
    }

    @Get('results/global-stats')
    @ApiOperation({
        summary: 'Get global results statistics',
        description:
            'Retrieve system-wide results statistics including pass rates, score distribution, and top performing courses.',
    })
    async getGlobalResultsStats() {
        return this.resultsReportsService.getGlobalResultsStats();
    }

    @Get('results/performance-trends')
    @ApiOperation({
        summary: 'Get performance trends',
        description:
            'Retrieve performance trends over time for users or courses.',
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        description: 'Filter by specific user',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by specific course',
    })
    async getPerformanceTrends(
        @Query('userId') userId?: string,
        @Query('courseId') courseId?: number,
    ) {
        return this.resultsReportsService.getPerformanceTrends(userId, courseId);
    }

    // Leaderboard Reports Endpoints
    @Get('leaderboard/analytics')
    @ApiOperation({
        summary: 'Get leaderboard analytics',
        description:
            'Retrieve comprehensive leaderboard analytics including rankings, competitive metrics, and performance trends.',
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        description: 'Filter by specific user',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by specific course',
    })
    async getLeaderboardAnalytics(
        @Query('userId') userId?: string,
        @Query('courseId') courseId?: number,
    ) {
        return this.leaderboardReportsService.getLeaderboardAnalytics(userId, courseId);
    }

    @Get('leaderboard/global-stats')
    @ApiOperation({
        summary: 'Get global leaderboard statistics',
        description:
            'Retrieve system-wide leaderboard statistics including top performers and course activity.',
    })
    async getGlobalLeaderboardStats() {
        return this.leaderboardReportsService.getGlobalLeaderboardStats();
    }

    @Get('leaderboard/top-performers')
    @ApiOperation({
        summary: 'Get top performers',
        description:
            'Retrieve top performers globally or for a specific course.',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by specific course',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Number of top performers to return (default: 10)',
    })
    async getTopPerformers(
        @Query('courseId') courseId?: number,
        @Query('limit') limit?: number,
    ) {
        return this.leaderboardReportsService.getTopPerformers(courseId, limit);
    }

    // Training Progress Reports Endpoints
    @Get('training-progress/:userId/analytics')
    @ApiOperation({
        summary: 'Get training progress analytics',
        description:
            'Retrieve comprehensive training progress analytics for a specific user including learning paths, skill development, and milestones.',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique identifier of the user',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by specific course',
    })
    async getTrainingProgressAnalytics(
        @Param('userId', ParseUUIDPipe) userId: string,
        @Query('courseId') courseId?: number,
    ) {
        return this.trainingProgressReportsService.getTrainingProgressAnalytics(userId, courseId);
    }

    @Get('training-progress/global-stats')
    @ApiOperation({
        summary: 'Get global training progress statistics',
        description:
            'Retrieve system-wide training progress statistics including completion rates and popular learning paths.',
    })
    async getGlobalTrainingProgressStats() {
        return this.trainingProgressReportsService.getGlobalTrainingProgressStats();
    }

    @Get('training-progress/:userId/skill-development')
    @ApiOperation({
        summary: 'Get skill development report',
        description:
            'Retrieve skill development analytics for a specific user.',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique identifier of the user',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by specific course',
    })
    async getSkillDevelopment(
        @Param('userId', ParseUUIDPipe) userId: string,
        @Query('courseId') courseId?: number,
    ) {
        return this.trainingProgressReportsService.getSkillDevelopment(userId, courseId);
    }
}
