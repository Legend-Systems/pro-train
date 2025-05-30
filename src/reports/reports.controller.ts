import {
    Controller,
    Get,
    Param,
    ParseIntPipe,
    UseGuards,
    HttpStatus,
    ParseUUIDPipe,
    Query,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiBearerAuth,
    ApiOkResponse,
    ApiQuery,
    ApiHeader,
    ApiSecurity,
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
import {
    ResultsAnalyticsReportDto,
    GlobalResultsStatsReportDto,
    PerformanceTrendReportDto,
} from './dto/results-analytics.dto';
import {
    LeaderboardAnalyticsReportDto,
    GlobalLeaderboardStatsReportDto,
    TopPerformerReportDto,
} from './dto/leaderboard-analytics.dto';
import {
    TrainingProgressAnalyticsReportDto,
    GlobalTrainingProgressStatsReportDto,
    SkillDevelopmentReportDto,
} from './dto/training-progress-analytics.dto';
import { StandardApiResponse } from '../user/dto/common-response.dto';

// Course-specific DTOs for enrollment and popularity
export class CourseEnrollmentTrendDto {
    date: string;
    newEnrollments: number;
    cumulativeEnrollments: number;
    growthRate: number;
}

export class CoursePopularityRankingDto {
    rank: number;
    courseId: number;
    title: string;
    enrollments: number;
    totalAttempts: number;
    popularityScore: number;
    trendDirection: string;
}

export class UserRegistrationTrendDto {
    date: string;
    newRegistrations: number;
}

export class TestAttemptTrendDto {
    date: string;
    attempts: number;
    completed: number;
}

@ApiTags('📊 Analytics & Reporting System')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class ReportsController {
    private readonly logger = new Logger(ReportsController.name);

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
        summary: '📈 Comprehensive Course Analytics',
        description: `
      **Retrieves detailed analytics for a specific course with caching optimization**
      
      This endpoint provides comprehensive course analytics including:
      - Student enrollment statistics and trends
      - Course completion rates and performance metrics
      - Time-based analytics and engagement patterns
      - Quality insights and improvement recommendations
      
      **Analytics Features:**
      - Real-time data aggregation from multiple sources
      - Intelligent caching for performance optimization
      - Historical trend analysis and projections
      - Cross-course comparison metrics
      
      **Data Sources:**
      - Course enrollment records
      - Test attempt statistics
      - Student progress tracking
      - Performance evaluation results
      
      **Use Cases:**
      - Course performance monitoring
      - Educational content optimization
      - Student engagement analysis
      - Instructor dashboard displays
    `,
        operationId: 'getCourseAnalytics',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Unique identifier of the target course for analytics',
        type: 'integer',
        example: 1,
        required: true,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success indicator',
                },
                message: {
                    type: 'string',
                    example: 'Course analytics retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    $ref: '#/components/schemas/CourseAnalyticsResponseDto',
                    description: 'Comprehensive course analytics data',
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2024-01-15T10:30:00Z',
                            description: 'Response generation timestamp',
                        },
                        cached: {
                            type: 'boolean',
                            example: false,
                            description:
                                'Indicates if data was served from cache',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found or inaccessible',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Course not found' },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description:
            '🔒 Forbidden - Insufficient permissions for course analytics',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: {
                    type: 'string',
                    example: 'Insufficient permissions',
                },
            },
        },
    })
    async getCourseAnalytics(
        @Param('courseId', ParseIntPipe) courseId: number,
    ): Promise<StandardApiResponse<CourseAnalyticsResponseDto>> {
        try {
            this.logger.log(
                `Retrieving course analytics for course: ${courseId}`,
            );

            const analytics =
                await this.courseReportsService.getCourseAnalytics(courseId);

            this.logger.log(
                `Course analytics retrieved successfully for course: ${courseId}`,
            );

            return {
                success: true,
                message: 'Course analytics retrieved successfully',
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving course analytics for course ${courseId}:`,
                error,
            );
            throw error;
        }
    }

    // Course enrollment trends endpoint
    @Get('courses/:courseId/enrollment')
    @ApiOperation({
        summary: '📊 Course Enrollment Trends Analysis',
        description: `
      **Analyzes enrollment trends and patterns for a specific course**
      
      This endpoint provides detailed enrollment analytics including:
      - Time-series enrollment data with trend analysis
      - Peak enrollment periods and seasonal patterns
      - Student acquisition metrics and conversion rates
      - Comparative enrollment performance
      
      **Trend Analysis Features:**
      - Daily, weekly, and monthly enrollment breakdowns
      - Growth rate calculations and projections
      - Enrollment source tracking and attribution
      - Demographic enrollment patterns
      
      **Business Intelligence:**
      - Marketing campaign effectiveness measurement
      - Optimal course launch timing recommendations
      - Capacity planning and resource allocation
      - Competitive analysis against similar courses
      
      **Use Cases:**
      - Marketing performance evaluation
      - Course scheduling optimization
      - Resource planning and allocation
      - Student acquisition strategy development
    `,
        operationId: 'getCourseEnrollmentTrends',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Unique identifier of the course for enrollment analysis',
        type: 'integer',
        example: 1,
        required: true,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course enrollment trends retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Course enrollment trends retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'array',
                    description: 'Time-series enrollment data',
                    items: {
                        type: 'object',
                        properties: {
                            date: {
                                type: 'string',
                                format: 'date',
                                example: '2024-01-15',
                                description: 'Date of enrollment record',
                            },
                            newEnrollments: {
                                type: 'number',
                                example: 12,
                                description:
                                    'Number of new enrollments on this date',
                            },
                            cumulativeEnrollments: {
                                type: 'number',
                                example: 150,
                                description:
                                    'Total enrollments up to this date',
                            },
                            growthRate: {
                                type: 'number',
                                example: 8.7,
                                description:
                                    'Percentage growth rate from previous period',
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Course not found or no enrollment data available',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Course not found' },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getCourseEnrollment(
        @Param('courseId', ParseIntPipe) courseId: number,
    ): Promise<StandardApiResponse<CourseEnrollmentTrendDto[]>> {
        try {
            this.logger.log(
                `Retrieving enrollment trends for course: ${courseId}`,
            );

            const enrollmentData =
                await this.courseReportsService.getCourseEnrollmentStats(
                    courseId,
                );

            this.logger.log(
                `Enrollment trends retrieved successfully for course: ${courseId}`,
            );

            return {
                success: true,
                message: 'Course enrollment trends retrieved successfully',
                data: enrollmentData,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving enrollment trends for course ${courseId}:`,
                error,
            );
            throw error;
        }
    }

    // Global course popularity rankings
    @Get('courses/popularity-ranking')
    @ApiOperation({
        summary: '🏆 Global Course Popularity Rankings',
        description: `
      **Generates comprehensive global course popularity rankings**
      
      This endpoint provides system-wide course popularity analysis including:
      - Top-performing courses ranked by multiple metrics
      - Engagement and enrollment-based scoring
      - Cross-category popularity comparisons
      - Trending courses and emerging favorites
      
      **Ranking Methodology:**
      - Multi-factor scoring algorithm combining enrollment, engagement, and completion
      - Time-weighted analysis favoring recent activity
      - Quality metrics including student satisfaction and outcomes
      - Category normalization for fair cross-domain comparison
      
      **Metrics Included:**
      - Total enrollments and active students
      - Course completion rates and time investment
      - Student feedback scores and recommendations
      - Test performance and learning outcomes
      
      **Use Cases:**
      - Homepage featured course selection
      - Marketing priority determination
      - Curriculum development insights
      - Competitive analysis and benchmarking
    `,
        operationId: 'getGlobalCoursePopularityRanking',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description:
            '✅ Global course popularity rankings retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success status',
                },
                message: {
                    type: 'string',
                    example:
                        'Course popularity rankings retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'array',
                    description: 'Ranked list of popular courses',
                    items: {
                        type: 'object',
                        properties: {
                            rank: {
                                type: 'number',
                                example: 1,
                                description: 'Current popularity rank',
                            },
                            courseId: {
                                type: 'number',
                                example: 1,
                                description: 'Unique course identifier',
                            },
                            title: {
                                type: 'string',
                                example: 'Introduction to Computer Science',
                                description: 'Course title',
                            },
                            enrollments: {
                                type: 'number',
                                example: 150,
                                description: 'Total enrollments count',
                            },
                            totalAttempts: {
                                type: 'number',
                                example: 450,
                                description:
                                    'Total test attempts across course',
                            },
                            popularityScore: {
                                type: 'number',
                                example: 92.5,
                                description:
                                    'Calculated popularity score (0-100)',
                            },
                            trendDirection: {
                                type: 'string',
                                example: 'up',
                                description:
                                    'Trend direction: up, down, stable',
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getCoursesPopularityRanking(): Promise<
        StandardApiResponse<CoursePopularityRankingDto[]>
    > {
        try {
            this.logger.log('Retrieving global course popularity rankings');

            const rankings =
                await this.courseReportsService.getAllCoursesPopularityRanking();

            this.logger.log(
                'Course popularity rankings retrieved successfully',
            );

            return {
                success: true,
                message: 'Course popularity rankings retrieved successfully',
                data: rankings,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving course popularity rankings:',
                error,
            );
            throw error;
        }
    }

    // User analytics endpoints
    @Get('users/:userId/analytics')
    @ApiOperation({
        summary: '👤 Comprehensive User Analytics Dashboard',
        description: `
      **Provides detailed analytics for individual user performance and engagement**
      
      This endpoint delivers comprehensive user analytics including:
      - Learning progress tracking and milestone achievements
      - Test performance analysis and improvement trends
      - Engagement patterns and learning behavior insights
      - Personalized recommendations and learning paths
      
      **Analytics Dimensions:**
      - Academic performance metrics and scoring trends
      - Time investment patterns and learning efficiency
      - Course enrollment history and completion tracking
      - Social learning indicators and collaboration metrics
      
      **Intelligence Features:**
      - Predictive learning outcome modeling
      - Personalized difficulty adjustment recommendations
      - Learning style identification and adaptation
      - Achievement recognition and motivation tracking
      
      **Use Cases:**
      - Student performance monitoring and support
      - Personalized learning experience optimization
      - Academic intervention and success planning
      - Progress reporting to instructors and administrators
    `,
        operationId: 'getUserAnalytics',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique identifier of the user for analytics generation',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: true,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User analytics retrieved successfully',
        type: UserAnalyticsResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User not found or analytics unavailable',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'User not found' },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getUserAnalytics(
        @Param('userId', ParseUUIDPipe) userId: string,
    ): Promise<StandardApiResponse<UserAnalyticsResponseDto>> {
        try {
            this.logger.log(`Retrieving user analytics for user: ${userId}`);

            const analytics =
                await this.userReportsService.getUserAnalytics(userId);

            this.logger.log(
                `User analytics retrieved successfully for user: ${userId}`,
            );

            return {
                success: true,
                message: 'User analytics retrieved successfully',
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving user analytics for user ${userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('users/global-stats')
    @ApiOperation({
        summary: '🌐 Global User Statistics Overview',
        description: `
      **Provides system-wide user engagement and activity statistics**
      
      This endpoint delivers comprehensive global user analytics including:
      - Platform-wide user activity metrics and trends
      - Registration and retention analysis
      - Engagement pattern identification across user segments
      - Performance benchmarks and comparative analytics
      
      **Global Metrics:**
      - Total active users and registration trends
      - User engagement distribution and activity patterns
      - Learning outcome statistics and success rates
      - Platform utilization metrics and peak usage analysis
      
      **Segmentation Analysis:**
      - User cohort performance comparisons
      - Geographic and demographic trend analysis
      - Course preference patterns and learning pathways
      - Retention and churn analysis with predictive insights
      
      **Use Cases:**
      - Executive dashboard reporting
      - Platform performance monitoring
      - User experience optimization
      - Strategic planning and growth analysis
    `,
        operationId: 'getGlobalUserStatistics',
    })
    @ApiOkResponse({
        description: '✅ Global user statistics retrieved successfully',
        type: GlobalUserStatsDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getGlobalUserStats(): Promise<
        StandardApiResponse<GlobalUserStatsDto>
    > {
        try {
            this.logger.log('Retrieving global user statistics');

            const stats = await this.userReportsService.getGlobalUserStats();

            this.logger.log('Global user statistics retrieved successfully');

            return {
                success: true,
                message: 'Global user statistics retrieved successfully',
                data: stats,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving global user statistics:',
                error,
            );
            throw error;
        }
    }

    @Get('users/registration-trends')
    @ApiOperation({
        summary: '📈 User Registration Trends Analysis',
        description: `
      **Analyzes user registration patterns and growth trends over time**
      
      This endpoint provides detailed registration analytics including:
      - Time-series registration data with growth analysis
      - Seasonal patterns and peak registration periods
      - User acquisition source tracking and attribution
      - Conversion funnel analysis and optimization insights
      
      **Trend Analysis Features:**
      - Daily, weekly, and monthly registration breakdowns
      - Growth rate calculations and future projections
      - Cohort analysis and user lifecycle tracking
      - Marketing campaign effectiveness measurement
      
      **Business Intelligence:**
      - User acquisition cost analysis and optimization
      - Retention correlation with registration timing
      - Platform growth trajectory modeling
      - Competitive benchmarking and market analysis
      
      **Use Cases:**
      - Marketing strategy optimization
      - Growth planning and resource allocation
      - User acquisition funnel improvement
      - Platform scalability planning
    `,
        operationId: 'getUserRegistrationTrends',
    })
    @ApiOkResponse({
        description: '✅ User registration trends retrieved successfully',
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
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getUserRegistrationTrends(): Promise<
        StandardApiResponse<UserRegistrationTrendDto[]>
    > {
        try {
            this.logger.log('Retrieving user registration trends');

            const trends =
                await this.userReportsService.getUserRegistrationTrends();

            this.logger.log('User registration trends retrieved successfully');

            return {
                success: true,
                message: 'User registration trends retrieved successfully',
                data: trends,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving user registration trends:',
                error,
            );
            throw error;
        }
    }

    // Test analytics endpoints
    @Get('tests/:testId/analytics')
    @ApiOperation({
        summary: '🎯 Comprehensive Test Analytics Dashboard',
        description: `
      **Provides detailed analytics for individual test performance and quality metrics**
      
      This endpoint delivers comprehensive test analytics including:
      - Test performance statistics and scoring distributions
      - Question-level analysis and difficulty assessment
      - Completion patterns and timing analytics
      - Quality metrics and improvement recommendations
      
      **Analytics Dimensions:**
      - Student performance metrics and pass/fail rates
      - Question effectiveness and discrimination analysis
      - Time allocation patterns and efficiency metrics
      - Comparative performance across user segments
      
      **Quality Assessment:**
      - Statistical reliability and validity measures
      - Item difficulty and discrimination indices
      - Test fairness and bias detection
      - Content effectiveness recommendations
      
      **Use Cases:**
      - Test quality assurance and improvement
      - Educational content optimization
      - Student performance evaluation
      - Instructor feedback and course enhancement
    `,
        operationId: 'getTestAnalytics',
    })
    @ApiParam({
        name: 'testId',
        description: 'Unique identifier of the test for analytics generation',
        type: 'integer',
        example: 1,
        required: true,
    })
    @ApiOkResponse({
        description: '✅ Test analytics retrieved successfully',
        type: TestAnalyticsResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found or analytics unavailable',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Test not found' },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getTestAnalytics(
        @Param('testId', ParseIntPipe) testId: number,
    ): Promise<StandardApiResponse<TestAnalyticsResponseDto>> {
        try {
            this.logger.log(`Retrieving test analytics for test: ${testId}`);

            const analytics =
                await this.testReportsService.getTestAnalytics(testId);

            this.logger.log(
                `Test analytics retrieved successfully for test: ${testId}`,
            );

            return {
                success: true,
                message: 'Test analytics retrieved successfully',
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving test analytics for test ${testId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('tests/global-stats')
    @ApiOperation({
        summary: '🌍 Global Test Statistics Overview',
        description:
            'Retrieve system-wide test statistics including completion rates, popular test types, and peak testing hours.',
        operationId: 'getGlobalTestStatistics',
    })
    @ApiOkResponse({
        description: '✅ Global test statistics retrieved successfully',
        type: GlobalTestStatsDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getGlobalTestStats(): Promise<
        StandardApiResponse<GlobalTestStatsDto>
    > {
        try {
            this.logger.log('Retrieving global test statistics');

            const stats = await this.testReportsService.getGlobalTestStats();

            this.logger.log('Global test statistics retrieved successfully');

            return {
                success: true,
                message: 'Global test statistics retrieved successfully',
                data: stats,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving global test statistics:',
                error,
            );
            throw error;
        }
    }

    @Get('tests/:testId/attempt-trends')
    @ApiOperation({
        summary: '📊 Test Attempt Trends Analysis',
        description:
            'Retrieve test attempt trends over the last 30 days for a specific test.',
        operationId: 'getTestAttemptTrends',
    })
    @ApiParam({
        name: 'testId',
        description: 'Unique identifier of the test',
        type: 'integer',
        example: 1,
    })
    @ApiOkResponse({
        description: '✅ Test attempt trends retrieved successfully',
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
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getTestAttemptTrends(
        @Param('testId', ParseIntPipe) testId: number,
    ): Promise<StandardApiResponse<TestAttemptTrendDto[]>> {
        try {
            this.logger.log(`Retrieving attempt trends for test: ${testId}`);

            const trends =
                await this.testReportsService.getTestAttemptTrends(testId);

            this.logger.log(
                `Test attempt trends retrieved successfully for test: ${testId}`,
            );

            return {
                success: true,
                message: 'Test attempt trends retrieved successfully',
                data: trends,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving test attempt trends for test ${testId}:`,
                error,
            );
            throw error;
        }
    }

    // Results Reports Endpoints
    @Get('results/:userId/analytics')
    @ApiOperation({
        summary: '📊 Comprehensive Results Analytics for User',
        description: `
      **Provides detailed results analytics for a specific user with comprehensive insights**
      
      This endpoint delivers in-depth user performance analytics including:
      - Individual test results analysis and performance trends
      - Score distribution patterns and percentile rankings
      - Learning progress tracking and achievement milestones
      - Comparative performance analysis across courses and timeframes
      
      **Analytics Dimensions:**
      - Academic performance metrics and scoring patterns
      - Test completion statistics and timing analysis
      - Subject-wise performance breakdown and skill assessment
      - Historical performance trends and improvement tracking
      
      **Quality Assessment Features:**
      - Performance consistency analysis and variance metrics
      - Learning velocity calculations and progress predictions
      - Strengths and weaknesses identification
      - Personalized improvement recommendations
      
      **Business Intelligence:**
      - Student engagement measurement and activity patterns
      - Risk assessment for academic intervention needs
      - Achievement recognition and milestone tracking
      - Comparative benchmarking against peer groups
      
      **Use Cases:**
      - Student performance dashboard and progress tracking
      - Academic counseling and intervention planning
      - Personalized learning path optimization
      - Parent/guardian progress reporting
      - Instructor student assessment and support
    `,
        operationId: 'getUserResultsAnalytics',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique UUID identifier of the user for comprehensive results analysis',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: true,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User results analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success indicator',
                },
                message: {
                    type: 'string',
                    example: 'User results analytics retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Comprehensive user results analytics',
                    properties: {
                        userId: {
                            type: 'string',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                            description: 'User unique identifier',
                        },
                        totalAttempts: {
                            type: 'number',
                            example: 45,
                            description: 'Total number of test attempts by user',
                        },
                        averageScore: {
                            type: 'number',
                            example: 87.5,
                            description: 'Overall average score across all attempts',
                        },
                        bestScore: {
                            type: 'number',
                            example: 98.5,
                            description: 'Highest score achieved by user',
                        },
                        recentPerformance: {
                            type: 'object',
                            properties: {
                                last30Days: {
                                    type: 'number',
                                    example: 89.2,
                                    description: 'Average score in last 30 days',
                                },
                                improvementTrend: {
                                    type: 'string',
                                    example: 'improving',
                                    description: 'Performance trend: improving, declining, stable',
                                },
                            },
                        },
                        subjectBreakdown: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    subject: {
                                        type: 'string',
                                        example: 'Mathematics',
                                    },
                                    averageScore: {
                                        type: 'number',
                                        example: 92.3,
                                    },
                                    attempts: {
                                        type: 'number',
                                        example: 12,
                                    },
                                },
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2024-01-15T10:30:00Z',
                            description: 'Analytics generation timestamp',
                        },
                        dataFreshness: {
                            type: 'string',
                            example: 'real-time',
                            description: 'Data freshness indicator',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User not found or no results data available',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'User not found or no test results available',
                },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '🔒 Forbidden - Insufficient permissions to access user results',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: {
                    type: 'string',
                    example: 'Insufficient permissions to access user results',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getUserResultsAnalytics(
        @Param('userId', ParseUUIDPipe) userId: string,
    ): Promise<StandardApiResponse<ResultsAnalyticsReportDto>> {
        try {
            this.logger.log(`Retrieving results analytics for user: ${userId}`);

            const analytics =
                await this.resultsReportsService.getResultsAnalytics(userId);

            this.logger.log(
                `Results analytics retrieved successfully for user: ${userId}`,
            );

            return {
                success: true,
                message: 'User results analytics retrieved successfully',
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving results analytics for user ${userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('results/global-stats')
    @ApiOperation({
        summary: '🌍 Global Results Statistics Overview',
        description: `
      **Provides comprehensive system-wide results statistics and analytics**
      
      This endpoint delivers platform-wide performance analytics including:
      - Global test performance metrics and distribution analysis
      - System-wide pass rates and achievement statistics
      - Cross-course performance comparisons and benchmarks
      - Platform usage patterns and engagement insights
      
      **Global Performance Metrics:**
      - Total test attempts across all courses and users
      - Average scores and performance distribution curves
      - Pass/fail rates with statistical significance analysis
      - Top performing courses and difficulty assessments
      
      **Comparative Analytics:**
      - Course performance rankings and popularity metrics
      - Subject-wise performance analysis and trends
      - User engagement patterns and activity heatmaps
      - Geographic and demographic performance insights
      
      **Quality Intelligence:**
      - Test difficulty calibration and fairness analysis
      - Question effectiveness and discrimination metrics
      - Platform reliability and user satisfaction indicators
      - Content optimization recommendations
      
      **Business Intelligence Applications:**
      - Executive dashboard reporting and KPI tracking
      - Educational content effectiveness measurement
      - Platform scaling and capacity planning insights
      - Marketing and user acquisition strategy support
      
      **Use Cases:**
      - Administrative oversight and performance monitoring
      - Educational research and effectiveness studies
      - Platform optimization and improvement planning
      - Stakeholder reporting and transparency initiatives
      - Competitive analysis and market positioning
    `,
        operationId: 'getGlobalResultsStatistics',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Global results statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success indicator',
                },
                message: {
                    type: 'string',
                    example: 'Global results statistics retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Comprehensive global results statistics',
                    properties: {
                        totalAttempts: {
                            type: 'number',
                            example: 15420,
                            description: 'Total test attempts across platform',
                        },
                        averageScore: {
                            type: 'number',
                            example: 78.4,
                            description: 'Platform-wide average score',
                        },
                        passRate: {
                            type: 'number',
                            example: 72.8,
                            description: 'Global pass rate percentage',
                        },
                        topPerformingCourses: {
                            type: 'array',
                            description: 'Highest performing courses',
                            items: {
                                type: 'object',
                                properties: {
                                    courseId: { type: 'number', example: 1 },
                                    title: {
                                        type: 'string',
                                        example: 'Advanced Mathematics',
                                    },
                                    averageScore: { type: 'number', example: 89.2 },
                                    totalAttempts: { type: 'number', example: 234 },
                                },
                            },
                        },
                        performanceDistribution: {
                            type: 'object',
                            properties: {
                                excellent: {
                                    type: 'number',
                                    example: 25.3,
                                    description: 'Percentage scoring 90+',
                                },
                                good: {
                                    type: 'number',
                                    example: 31.7,
                                    description: 'Percentage scoring 80-89',
                                },
                                average: {
                                    type: 'number',
                                    example: 28.2,
                                    description: 'Percentage scoring 70-79',
                                },
                                needsImprovement: {
                                    type: 'number',
                                    example: 14.8,
                                    description: 'Percentage scoring below 70',
                                },
                            },
                        },
                        trendsAnalysis: {
                            type: 'object',
                            properties: {
                                monthlyGrowth: {
                                    type: 'number',
                                    example: 12.5,
                                    description: 'Monthly growth in test attempts (%)',
                                },
                                performanceImprovement: {
                                    type: 'number',
                                    example: 3.2,
                                    description: 'Average score improvement over last quarter',
                                },
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2024-01-15T10:30:00Z',
                            description: 'Statistics generation timestamp',
                        },
                        dataRange: {
                            type: 'string',
                            example: 'all-time',
                            description: 'Data range for statistics',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '🔥 Internal Server Error - System data processing failed',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 500 },
                message: { 
                    type: 'string', 
                    example: 'Unable to process global statistics due to system error' 
                },
                error: { type: 'string', example: 'Internal Server Error' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00Z' },
                path: { type: 'string', example: '/api/reports/results/global-stats' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized access. Please provide a valid JWT token.' },
                error: { type: 'string', example: 'Unauthorized' },
                timestamp: { type: 'string', example: '2024-01-15T10:30:00Z' },
                path: { type: 'string', example: '/api/reports/results/global-stats' },
            },
        },
    })
    async getGlobalResultsStats(): Promise<StandardApiResponse<GlobalResultsStatsReportDto>> {
        try {
            this.logger.log('Retrieving global results statistics');

            const stats =
                await this.resultsReportsService.getGlobalResultsStats();

            this.logger.log('Global results statistics retrieved successfully');

            return {
                success: true,
                message: 'Global results statistics retrieved successfully',
                data: stats,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving global results statistics:',
                error,
            );
            throw error;
        }
    }

    @Get('results/performance-trends')
    @ApiOperation({
        summary: '📈 Performance Trends Analysis Dashboard',
        description: `
      **Analyzes performance trends over time with advanced filtering capabilities**
      
      This endpoint provides comprehensive performance trend analysis including:
      - Time-series performance data with trend identification
      - User and course-specific performance tracking
      - Comparative analysis across different time periods
      - Predictive performance modeling and forecasting
      
      **Trend Analysis Features:**
      - Daily, weekly, and monthly performance aggregations
      - Moving averages and trend line calculations
      - Seasonal pattern identification and analysis
      - Performance variance and consistency metrics
      
      **Filtering Capabilities:**
      - **User-specific**: Individual user performance tracking
      - **Course-specific**: Course performance evolution
      - **Date ranges**: Custom time period analysis
      - **Performance segments**: High/medium/low performer trends
      
      **Advanced Analytics:**
      - Statistical significance testing for trend changes
      - Correlation analysis between different performance metrics
      - Outlier detection and anomaly identification
      - Performance prediction and forecasting models
      
      **Business Applications:**
      - Learning effectiveness measurement over time
      - Course content optimization based on performance trends
      - Student intervention timing and strategy development
      - Platform improvement impact assessment
      
      **Use Cases:**
      - Educational research and trend analysis
      - Student progress monitoring and early warning systems
      - Course effectiveness evaluation and improvement
      - Platform performance optimization
      - Academic intervention planning and timing
    `,
        operationId: 'getPerformanceTrends',
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        description: 'Filter trends by specific user UUID for personalized analysis',
        example: '123e4567-e89b-12d3-a456-426614174000',
        type: 'string',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter trends by specific course ID for course-level analysis',
        example: 1,
        type: 'number',
    })
    @ApiQuery({
        name: 'startDate',
        required: false,
        description: 'Start date for trend analysis (ISO 8601 format)',
        example: '2024-01-01',
        type: 'string',
    })
    @ApiQuery({
        name: 'endDate',
        required: false,
        description: 'End date for trend analysis (ISO 8601 format)',
        example: '2024-12-31',
        type: 'string',
    })
    @ApiQuery({
        name: 'granularity',
        required: false,
        description: 'Data aggregation granularity',
        enum: ['daily', 'weekly', 'monthly'],
        example: 'weekly',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Performance trends retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success indicator',
                },
                message: {
                    type: 'string',
                    example: 'Performance trends retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Performance trends analysis data',
                    properties: {
                        trends: {
                            type: 'array',
                            description: 'Time-series performance data points',
                            items: {
                                type: 'object',
                                properties: {
                                    date: {
                                        type: 'string',
                                        format: 'date',
                                        example: '2024-01-15',
                                        description: 'Data point date',
                                    },
                                    averageScore: {
                                        type: 'number',
                                        example: 84.7,
                                        description: 'Average score for this period',
                                    },
                                    attempts: {
                                        type: 'number',
                                        example: 23,
                                        description: 'Number of attempts in period',
                                    },
                                    passRate: {
                                        type: 'number',
                                        example: 78.3,
                                        description: 'Pass rate percentage for period',
                                    },
                                    trendDirection: {
                                        type: 'string',
                                        example: 'improving',
                                        description: 'Trend direction: improving, declining, stable',
                                    },
                                },
                            },
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                overallTrend: {
                                    type: 'string',
                                    example: 'improving',
                                    description: 'Overall trend across entire period',
                                },
                                averageImprovement: {
                                    type: 'number',
                                    example: 5.2,
                                    description: 'Average improvement percentage',
                                },
                                bestPeriod: {
                                    type: 'string',
                                    example: '2024-01-22',
                                    description: 'Date of best performance',
                                },
                                consistency: {
                                    type: 'number',
                                    example: 0.85,
                                    description: 'Performance consistency score (0-1)',
                                },
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2024-01-15T10:30:00Z',
                            description: 'Analysis generation timestamp',
                        },
                        dataPoints: {
                            type: 'number',
                            example: 52,
                            description: 'Number of data points in analysis',
                        },
                        filters: {
                            type: 'object',
                            description: 'Applied filters for this analysis',
                        },
                    },
                },
            },
        },
    })
    async getPerformanceTrends(
        @Query('userId') userId?: string,
        @Query('courseId') courseId?: number,
    ): Promise<StandardApiResponse<PerformanceTrendReportDto[]>> {
        try {
            this.logger.log(
                `Retrieving performance trends for userId: ${userId}, courseId: ${courseId}`,
            );

            const trends =
                await this.resultsReportsService.getPerformanceTrends(
                    userId,
                    courseId,
                );

            this.logger.log('Performance trends retrieved successfully');

            return {
                success: true,
                message: 'Performance trends retrieved successfully',
                data: trends,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error('Error retrieving performance trends:', error);
            throw error;
        }
    }

    // Leaderboard Reports Endpoints
    @Get('leaderboard/analytics')
    @ApiOperation({
        summary: '🏆 Comprehensive Leaderboard Analytics Dashboard',
        description: `
      **Provides advanced leaderboard analytics with competitive intelligence features**
      
      This endpoint delivers sophisticated competitive analysis including:
      - Multi-dimensional ranking systems and scoring algorithms
      - Competitive performance tracking and achievement recognition
      - Social learning indicators and peer comparison metrics
      - Gamification effectiveness measurement and engagement insights
      
      **Competitive Analytics Features:**
      - Real-time ranking calculations with multiple scoring criteria
      - Historical position tracking and movement analysis
      - Achievement milestone recognition and reward systems
      - Peer group analysis and competitive benchmarking
      
      **Ranking Methodologies:**
      - Score-based rankings with weighted performance metrics
      - Time-based achievements and streak tracking
      - Participation-based scoring and engagement rewards
      - Skill-based competency rankings and proficiency levels
      
      **Social Learning Intelligence:**
      - Collaborative learning pattern identification
      - Peer influence analysis and knowledge sharing metrics
      - Group performance dynamics and team effectiveness
      - Mentorship opportunity identification and matching
      
      **Gamification Insights:**
      - Achievement system effectiveness and engagement correlation
      - Reward mechanism optimization and motivation analysis
      - Competition-driven learning outcome improvements
      - User retention and engagement through competitive elements
      
      **Business Applications:**
      - Student motivation and engagement enhancement
      - Course completion rate improvement through competition
      - Community building and social learning facilitation
      - Platform stickiness and user retention optimization
      
      **Use Cases:**
      - Competitive learning environment creation
      - Student motivation and engagement programs
      - Course completion incentivization strategies
      - Social learning community development
      - Achievement recognition and reward systems
    `,
        operationId: 'getLeaderboardAnalytics',
    })
    @ApiQuery({
        name: 'userId',
        required: false,
        description: 'Filter analytics by specific user UUID for personalized leaderboard insights',
        example: '123e4567-e89b-12d3-a456-426614174000',
        type: 'string',
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter analytics by specific course ID for course-level competitive analysis',
        example: 1,
        type: 'number',
    })
    @ApiQuery({
        name: 'timeframe',
        required: false,
        description: 'Time period for leaderboard analysis',
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'all-time'],
        example: 'monthly',
    })
    @ApiQuery({
        name: 'category',
        required: false,
        description: 'Leaderboard category for specialized rankings',
        enum: ['overall', 'recent-performance', 'improvement', 'consistency'],
        example: 'overall',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Leaderboard analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success indicator',
                },
                message: {
                    type: 'string',
                    example: 'Leaderboard analytics retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Comprehensive leaderboard analytics',
                    properties: {
                        leaderboard: {
                            type: 'array',
                            description: 'Ranked list of leaderboard entries',
                            items: {
                                type: 'object',
                                properties: {
                                    userId: {
                                        type: 'string',
                                        example: '123e4567-e89b-12d3-a456-426614174000',
                                        description: 'User unique identifier',
                                    },
                                    rank: {
                                        type: 'number',
                                        example: 1,
                                        description: 'Current leaderboard rank',
                                    },
                                    score: {
                                        type: 'number',
                                        example: 95.2,
                                        description: 'User score on the leaderboard',
                                    },
                                    progress: {
                                        type: 'number',
                                        example: 85.3,
                                        description: 'User progress percentage',
                                    },
                                    streak: {
                                        type: 'number',
                                        example: 12,
                                        description: 'Current streak of consecutive days',
                                    },
                                },
                            },
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                topPerformer: {
                                    type: 'object',
                                    properties: {
                                        userId: {
                                            type: 'string',
                                            example: '123e4567-e89b-12d3-a456-426614174000',
                                            description: 'User unique identifier',
                                        },
                                        rank: {
                                            type: 'number',
                                            example: 1,
                                            description: 'Current leaderboard rank',
                                        },
                                        score: {
                                            type: 'number',
                                            example: 98.5,
                                            description: 'Top performer score',
                                        },
                                    },
                                },
                                averageScore: {
                                    type: 'number',
                                    example: 87.5,
                                    description: 'Average score across all leaderboard entries',
                                },
                                passRate: {
                                    type: 'number',
                                    example: 75.3,
                                    description: 'Average pass rate across leaderboard entries',
                                },
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2024-01-15T10:30:00Z',
                            description: 'Analytics generation timestamp',
                        },
                        dataRange: {
                            type: 'string',
                            example: 'all-time',
                            description: 'Data range for leaderboard analytics',
                        },
                    },
                },
            },
        },
    })
    async getLeaderboardAnalytics(
        @Query('userId') userId?: string,
        @Query('courseId') courseId?: number,
    ): Promise<StandardApiResponse<LeaderboardAnalyticsReportDto>> {
        try {
            this.logger.log(
                `Retrieving leaderboard analytics for userId: ${userId}, courseId: ${courseId}`,
            );

            const analytics =
                await this.leaderboardReportsService.getLeaderboardAnalytics(
                    userId,
                    courseId,
                );

            this.logger.log('Leaderboard analytics retrieved successfully');

            return {
                success: true,
                message: 'Leaderboard analytics retrieved successfully',
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error('Error retrieving leaderboard analytics:', error);
            throw error;
        }
    }

    @Get('leaderboard/global-stats')
    @ApiOperation({
        summary: '🌍 Global Leaderboard Statistics',
        description:
            'Retrieve system-wide leaderboard statistics including top performers and course activity.',
        operationId: 'getGlobalLeaderboardStatistics',
    })
    @ApiOkResponse({
        description: '✅ Global leaderboard statistics retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getGlobalLeaderboardStats(): Promise<StandardApiResponse<GlobalLeaderboardStatsReportDto>> {
        try {
            this.logger.log('Retrieving global leaderboard statistics');

            const stats =
                await this.leaderboardReportsService.getGlobalLeaderboardStats();

            this.logger.log(
                'Global leaderboard statistics retrieved successfully',
            );

            return {
                success: true,
                message: 'Global leaderboard statistics retrieved successfully',
                data: stats,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving global leaderboard statistics:',
                error,
            );
            throw error;
        }
    }

    @Get('leaderboard/top-performers')
    @ApiOperation({
        summary: '🥇 Top Performers Rankings',
        description:
            'Retrieve top performers globally or for a specific course.',
        operationId: 'getTopPerformers',
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
    @ApiOkResponse({
        description: '✅ Top performers retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getTopPerformers(
        @Query('courseId') courseId?: number,
        @Query('limit') limit?: number,
    ): Promise<StandardApiResponse<TopPerformerReportDto[]>> {
        try {
            this.logger.log(
                `Retrieving top performers for courseId: ${courseId}, limit: ${limit}`,
            );

            const performers =
                await this.leaderboardReportsService.getTopPerformers(
                    courseId,
                    limit,
                );

            this.logger.log('Top performers retrieved successfully');

            return {
                success: true,
                message: 'Top performers retrieved successfully',
                data: performers,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error('Error retrieving top performers:', error);
            throw error;
        }
    }

    // Training Progress Reports Endpoints
    @Get('training-progress/:userId/analytics')
    @ApiOperation({
        summary: '📚 Comprehensive Training Progress Analytics Dashboard',
        description: `
      **Provides detailed training progress analytics with personalized learning insights**
      
      This endpoint delivers comprehensive learning journey analytics including:
      - Personalized learning path tracking and milestone recognition
      - Skill development progression with competency mapping
      - Learning velocity analysis and time investment optimization
      - Knowledge retention assessment and spaced repetition recommendations
      
      **Learning Journey Analytics:**
      - Course progression tracking with completion percentage
      - Learning milestone identification and achievement recognition
      - Skill acquisition timeline and proficiency development
      - Knowledge gap analysis and targeted improvement recommendations
      
      **Performance Intelligence:**
      - Learning velocity calculations and efficiency metrics
      - Retention rate analysis and forgetting curve modeling
      - Difficulty progression tracking and adaptive learning suggestions
      - Personalized study schedule optimization
      
      **Competency Mapping:**
      - Skill-based progress tracking with proficiency levels
      - Learning objective completion and mastery assessment
      - Cross-course skill correlation and knowledge transfer
      - Career pathway alignment and professional development tracking
      
      **Adaptive Learning Features:**
      - Personalized difficulty adjustment recommendations
      - Optimal learning session timing and duration suggestions
      - Content recommendation based on learning patterns
      - Intervention timing for maximum learning effectiveness
      
      **Predictive Analytics:**
      - Learning outcome prediction and success probability
      - Time-to-completion estimation with accuracy modeling
      - Risk assessment for learning abandonment
      - Optimal learning path recommendation algorithm
      
      **Use Cases:**
      - Personalized learning dashboard and progress tracking
      - Academic counseling and learning strategy optimization
      - Corporate training effectiveness measurement
      - Professional development planning and career guidance
      - Educational intervention timing and strategy development
    `,
        operationId: 'getTrainingProgressAnalytics',
    })
    @ApiParam({
        name: 'userId',
        description: 'Unique UUID identifier of the user for comprehensive training progress analysis',
        type: 'string',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: true,
    })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter progress analytics by specific course ID for focused course analysis',
        example: 1,
        type: 'number',
    })
    @ApiQuery({
        name: 'includeDetails',
        required: false,
        description: 'Include detailed breakdown of each learning module and skill area',
        example: true,
        type: 'boolean',
    })
    @ApiQuery({
        name: 'timeframe',
        required: false,
        description: 'Time period for progress analysis',
        enum: ['last-week', 'last-month', 'last-quarter', 'all-time'],
        example: 'last-month',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Training progress analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success indicator',
                },
                message: {
                    type: 'string',
                    example: 'Training progress analytics retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Comprehensive training progress analytics',
                    properties: {
                        userId: {
                            type: 'string',
                            example: '123e4567-e89b-12d3-a456-426614174000',
                            description: 'User unique identifier',
                        },
                        courseId: {
                            type: 'number',
                            example: 1,
                            description: 'Course unique identifier',
                        },
                        progress: {
                            type: 'number',
                            example: 85.3,
                            description: 'Current progress percentage',
                        },
                        milestones: {
                            type: 'array',
                            description: 'List of completed milestones',
                            items: {
                                type: 'string',
                                example: 'Introduction to Computer Science',
                                description: 'Milestone title',
                            },
                        },
                        skillAreas: {
                            type: 'array',
                            description: 'List of mastered skill areas',
                            items: {
                                type: 'string',
                                example: 'Mathematics',
                                description: 'Skill area title',
                            },
                        },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2024-01-15T10:30:00Z',
                            description: 'Analytics generation timestamp',
                        },
                        dataPoints: {
                            type: 'number',
                            example: 52,
                            description: 'Number of data points in analysis',
                        },
                        filters: {
                            type: 'object',
                            description: 'Applied filters for this analysis',
                        },
                    },
                },
            },
        },
    })
    async getTrainingProgressAnalytics(
        @Param('userId', ParseUUIDPipe) userId: string,
        @Query('courseId') courseId?: number,
    ): Promise<StandardApiResponse<TrainingProgressAnalyticsReportDto>> {
        try {
            this.logger.log(
                `Retrieving training progress analytics for user: ${userId}, courseId: ${courseId}`,
            );

            const analytics =
                await this.trainingProgressReportsService.getTrainingProgressAnalytics(
                    userId,
                    courseId,
                );

            this.logger.log(
                `Training progress analytics retrieved successfully for user: ${userId}`,
            );

            return {
                success: true,
                message: 'Training progress analytics retrieved successfully',
                data: analytics,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving training progress analytics for user ${userId}:`,
                error,
            );
            throw error;
        }
    }

    @Get('training-progress/global-stats')
    @ApiOperation({
        summary: '🌍 Global Training Progress Statistics',
        description:
            'Retrieve system-wide training progress statistics including completion rates and popular learning paths.',
        operationId: 'getGlobalTrainingProgressStatistics',
    })
    @ApiOkResponse({
        description:
            '✅ Global training progress statistics retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getGlobalTrainingProgressStats(): Promise<StandardApiResponse<GlobalTrainingProgressStatsReportDto>> {
        try {
            this.logger.log('Retrieving global training progress statistics');

            const stats =
                await this.trainingProgressReportsService.getGlobalTrainingProgressStats();

            this.logger.log(
                'Global training progress statistics retrieved successfully',
            );

            return {
                success: true,
                message:
                    'Global training progress statistics retrieved successfully',
                data: stats,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                'Error retrieving global training progress statistics:',
                error,
            );
            throw error;
        }
    }

    @Get('training-progress/:userId/skill-development')
    @ApiOperation({
        summary: '🎯 Skill Development Report',
        description:
            'Retrieve skill development analytics for a specific user.',
        operationId: 'getSkillDevelopmentReport',
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
    @ApiOkResponse({
        description: '✅ Skill development report retrieved successfully',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async getSkillDevelopment(
        @Param('userId', ParseUUIDPipe) userId: string,
        @Query('courseId') courseId?: number,
    ): Promise<StandardApiResponse<SkillDevelopmentReportDto[]>> {
        try {
            this.logger.log(
                `Retrieving skill development for user: ${userId}, courseId: ${courseId}`,
            );

            const skillDevelopment =
                await this.trainingProgressReportsService.getSkillDevelopment(
                    userId,
                    courseId,
                );

            this.logger.log(
                `Skill development retrieved successfully for user: ${userId}`,
            );

            return {
                success: true,
                message: 'Skill development report retrieved successfully',
                data: skillDevelopment,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error retrieving skill development for user ${userId}:`,
                error,
            );
            throw error;
        }
    }
}
