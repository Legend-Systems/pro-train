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
    ApiBearerAuth,
    ApiNotFoundResponse,
    ApiBadRequestResponse,
    ApiForbiddenResponse,
    ApiUnauthorizedResponse,
    ApiHeader,
    ApiSecurity,
    ApiQuery,
} from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { ResultResponseDto } from './dto/result-response.dto';
import { ResultFilterDto } from './dto/result-filter.dto';
import { ResultAnalyticsDto } from './dto/result-analytics.dto';
import { ResultListResponseDto } from './dto/result-list-response.dto';
import { ResultDetailDto } from './dto/result-detail.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('📊 Results & Performance Analytics')
@Controller('results')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class ResultsController {
    private readonly logger = new Logger(ResultsController.name);

    constructor(private readonly resultsService: ResultsService) {}

    @Post('create-from-attempt/:attemptId')
    @ApiOperation({
        summary: '🎯 Create Result from Test Attempt',
        description: `
        **Automatically generates comprehensive test results from a completed attempt**
        
        This endpoint handles intelligent result calculation including:
        - Automatic score computation from answers
        - Performance analytics generation
        - Grade determination and pass/fail status
        - Statistical analysis and benchmarking
        - Achievement tracking and milestones
        
        **Smart Calculation Features:**
        - Multi-format question scoring (MCQ, text, essays)
        - Weighted scoring based on question difficulty
        - Partial credit allocation where applicable
        - Performance percentile calculations
        - Time-based performance metrics
        
        **Business Logic:**
        - Only completed attempts can generate results
        - Duplicate result prevention mechanisms
        - Automatic grade book integration
        - Learning analytics data collection
        - Achievement milestone tracking
        
        **Use Cases:**
        - Automatic grading workflows
        - Real-time performance tracking
        - Academic record maintenance
        - Learning analytics processing
        - Achievement recognition systems
        `,
        operationId: 'createResultFromAttempt',
    })
    @ApiParam({
        name: 'attemptId',
        type: Number,
        description: 'Test attempt identifier to generate results from',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description:
            '✅ Result created successfully with comprehensive analytics',
        type: ResultResponseDto,
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Result created successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        resultId: { type: 'number', example: 1 },
                        attemptId: { type: 'number', example: 1 },
                        userId: { type: 'string', example: 'user-123' },
                        testId: { type: 'number', example: 1 },
                        courseId: { type: 'number', example: 1 },
                        score: { type: 'number', example: 85.5 },
                        maxScore: { type: 'number', example: 100 },
                        percentage: { type: 'number', example: 85.5 },
                        passed: { type: 'boolean', example: true },
                        calculatedAt: {
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
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiNotFoundResponse({
        description: '❌ Test attempt not found or inaccessible',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Test attempt not found' },
            },
        },
    })
    @ApiBadRequestResponse({
        description:
            '❌ Attempt not completed, result already exists, or invalid data',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Attempt not completed',
                        'Result already exists for this attempt',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    async createFromAttempt(
        @Param('attemptId', ParseIntPipe) attemptId: number,
        @GetUser() user: User,
    ): Promise<ResultResponseDto> {
        this.logger.log(
            `Creating result from attempt: ${attemptId} by user: ${user.id}`,
        );

        if (!attemptId || attemptId <= 0) {
            throw new BadRequestException('Invalid attempt ID');
        }

        return this.resultsService.createFromAttempt(attemptId);
    }

    @Get('my-results')
    @ApiOperation({
        summary: '📈 Get My Test Results',
        description: `
        **Retrieves comprehensive test results for the authenticated user**
        
        This endpoint provides personalized academic performance data including:
        - Complete test results with detailed breakdowns
        - Performance trends and progress tracking
        - Achievement history and milestones
        - Comparative analytics and benchmarking
        - Learning path recommendations
        
        **Advanced Features:**
        - Multi-level filtering and sorting capabilities
        - Performance trend analysis over time
        - Subject and course-specific breakdowns
        - Achievement and badge tracking
        - Personalized learning insights
        
        **Analytics Included:**
        - Score progression and improvement rates
        - Time-to-completion analysis
        - Difficulty level performance
        - Comparative peer analysis
        - Learning velocity metrics
        
        **Use Cases:**
        - Student dashboard and progress tracking
        - Academic portfolio development
        - Performance self-assessment
        - Learning goal setting and monitoring
        - Achievement showcase and recognition
        `,
        operationId: 'getMyResults',
    })
    @ApiQuery({
        name: 'page',
        type: Number,
        required: false,
        description: 'Page number for pagination',
        example: 1,
    })
    @ApiQuery({
        name: 'limit',
        type: Number,
        required: false,
        description: 'Number of results per page (max 100)',
        example: 20,
    })
    @ApiQuery({
        name: 'testId',
        type: Number,
        required: false,
        description: 'Filter by specific test ID',
        example: 1,
    })
    @ApiQuery({
        name: 'courseId',
        type: Number,
        required: false,
        description: 'Filter by specific course ID',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User results retrieved successfully',
        type: ResultListResponseDto,
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Results retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        results: {
                            type: 'array',
                            description:
                                'Array of test results with comprehensive details',
                            items: {
                                type: 'object',
                                properties: {
                                    resultId: { type: 'number', example: 1 },
                                    score: { type: 'number', example: 85.5 },
                                    percentage: {
                                        type: 'number',
                                        example: 85.5,
                                    },
                                    passed: { type: 'boolean', example: true },
                                    calculatedAt: {
                                        type: 'string',
                                        example: '2024-01-15T14:30:00.000Z',
                                    },
                                    test: {
                                        type: 'object',
                                        properties: {
                                            testId: {
                                                type: 'number',
                                                example: 1,
                                            },
                                            title: {
                                                type: 'string',
                                                example:
                                                    'JavaScript Fundamentals Quiz',
                                            },
                                            testType: {
                                                type: 'string',
                                                example: 'quiz',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                totalResults: { type: 'number', example: 25 },
                                averageScore: { type: 'number', example: 82.3 },
                                passedCount: { type: 'number', example: 20 },
                                passRate: { type: 'number', example: 80.0 },
                            },
                        },
                        total: { type: 'number', example: 25 },
                        page: { type: 'number', example: 1 },
                        limit: { type: 'number', example: 20 },
                    },
                },
            },
        },
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    async getMyResults(
        @GetUser() user: User,
        @Query() filterDto: ResultFilterDto,
    ) {
        this.logger.log(`Getting results for user: ${user.id}`);
        return this.resultsService.findUserResults(user.id, filterDto);
    }

    @Get('test/:testId')
    @ApiOperation({
        summary: '📝 Get Test Results (Instructor)',
        description: `
        **Retrieves comprehensive results analytics for a specific test**
        
        This endpoint provides instructor-level analytics including:
        - Complete student performance breakdowns
        - Statistical analysis and distribution curves
        - Question-level performance insights
        - Learning objective achievement rates
        - Class performance comparisons
        
        **Instructor Analytics:**
        - Score distribution and statistical analysis
        - Question difficulty and discrimination indices
        - Time-to-completion patterns
        - Learning objective mastery rates
        - Individual and class performance trends
        
        **Access Control:**
        - Restricted to test creators and course instructors
        - Administrative override capabilities
        - Privacy-compliant data aggregation
        - Secure performance reporting
        
        **Use Cases:**
        - Test effectiveness evaluation
        - Curriculum improvement insights
        - Student performance monitoring
        - Educational research and analysis
        - Quality assurance reporting
        `,
        operationId: 'getTestResults',
    })
    @ApiParam({
        name: 'testId',
        type: Number,
        description: 'Test identifier to retrieve results analytics',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test results retrieved successfully',
        type: ResultListResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiForbiddenResponse({
        description:
            '🚷 Forbidden - Not authorized to view test results (instructor access required)',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: {
                    type: 'string',
                    example: 'Access denied - not test instructor',
                },
                error: { type: 'string', example: 'Forbidden' },
            },
        },
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid test ID provided',
    })
    async getTestResults(
        @Param('testId', ParseIntPipe) testId: number,
        @GetUser() user: User,
        @Query() filterDto: ResultFilterDto,
    ) {
        this.logger.log(
            `Getting test results for test: ${testId} by user: ${user.id}`,
        );

        if (!testId || testId <= 0) {
            throw new BadRequestException('Invalid test ID');
        }

        return this.resultsService.findTestResults(testId, user.id, filterDto);
    }

    @Get('course/:courseId')
    @ApiOperation({
        summary: '🎓 Get Course Results (Instructor)',
        description: `
        **Retrieves comprehensive performance analytics for an entire course**
        
        This endpoint provides course-wide analytics including:
        - Aggregated student performance across all tests
        - Learning progression and trend analysis
        - Course effectiveness metrics
        - Student engagement and participation rates
        - Curriculum success indicators
        
        **Course-Level Analytics:**
        - Multi-test performance correlation
        - Learning path effectiveness analysis
        - Student retention and success rates
        - Curriculum gap identification
        - Comparative cohort analysis
        
        **Educational Insights:**
        - Learning objective achievement tracking
        - Content difficulty optimization
        - Student support need identification
        - Instructional design effectiveness
        - Long-term learning outcome prediction
        
        **Use Cases:**
        - Course effectiveness evaluation
        - Curriculum optimization planning
        - Student intervention identification
        - Educational outcome reporting
        - Institutional analytics and accreditation
        `,
        operationId: 'getCourseResults',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier to retrieve comprehensive results',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course results retrieved successfully',
        type: ResultListResponseDto,
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiForbiddenResponse({
        description:
            '🚷 Forbidden - Not authorized to view course results (instructor access required)',
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid course ID provided',
    })
    async getCourseResults(
        @Param('courseId', ParseIntPipe) courseId: number,
        @GetUser() user: User,
        @Query() filterDto: ResultFilterDto,
    ) {
        this.logger.log(
            `Getting course results for course: ${courseId} by user: ${user.id}`,
        );

        if (!courseId || courseId <= 0) {
            throw new BadRequestException('Invalid course ID');
        }

        return this.resultsService.findCourseResults(
            courseId,
            user.id,
            filterDto,
        );
    }

    @Get('analytics/:testId')
    @ApiOperation({
        summary: '📈 Get Test Analytics',
        description: `
        **Provides comprehensive test analytics and educational insights**
        
        This endpoint delivers advanced educational analytics including:
        - Score distribution analysis and statistical measures
        - Question performance and difficulty assessment
        - Learning objective achievement analytics
        - Time-based performance insights
        - Predictive learning analytics
        
        **Advanced Analytics Features:**
        - Statistical distribution analysis (mean, median, standard deviation)
        - Question discrimination and difficulty indices
        - Item response theory (IRT) metrics
        - Learning curve analysis and predictions
        - Comparative performance benchmarking
        
        **Educational Intelligence:**
        - Learning objective mastery assessment
        - Knowledge gap identification
        - Optimal learning path recommendations
        - Performance prediction algorithms
        - Adaptive assessment insights
        
        **Research Applications:**
        - Educational effectiveness research
        - Curriculum optimization studies
        - Learning analytics research
        - Assessment validity analysis
        - Pedagogical improvement insights
        `,
        operationId: 'getTestAnalytics',
    })
    @ApiParam({
        name: 'testId',
        type: Number,
        description: 'Test identifier for comprehensive analytics',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test analytics retrieved successfully',
        type: ResultAnalyticsDto,
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Analytics retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        testId: { type: 'number', example: 1 },
                        totalResults: { type: 'number', example: 45 },
                        averagePercentage: { type: 'number', example: 78.5 },
                        highestPercentage: { type: 'number', example: 98.5 },
                        lowestPercentage: { type: 'number', example: 45.2 },
                        passedCount: { type: 'number', example: 35 },
                        passRate: { type: 'number', example: 77.8 },
                        scoreDistribution: {
                            type: 'object',
                            example: {
                                '90-100': 12,
                                '80-89': 15,
                                '70-79': 8,
                                '60-69': 6,
                                '0-59': 4,
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
    @ApiForbiddenResponse({
        description: '🚷 Forbidden - Not authorized to view test analytics',
    })
    async getTestAnalytics(
        @Param('testId', ParseIntPipe) testId: number,
        @GetUser() user: User,
    ): Promise<ResultAnalyticsDto> {
        this.logger.log(
            `Getting analytics for test: ${testId} by user: ${user.id}`,
        );
        return this.resultsService.getTestAnalytics(testId, user.id);
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Detailed Result',
        description: `
        **Retrieves comprehensive details for a specific test result**
        
        This endpoint provides complete result information including:
        - Detailed performance metrics and analytics
        - Question-by-question breakdown
        - Comparative performance context
        - Learning insights and recommendations
        - Achievement recognition data
        
        **Comprehensive Details:**
        - Complete test attempt reconstruction
        - Answer-by-answer analysis
        - Time allocation and efficiency metrics
        - Performance compared to peers and benchmarks
        - Personalized improvement recommendations
        
        **Educational Value:**
        - Learning gap identification
        - Strength and weakness analysis
        - Study recommendation generation
        - Progress tracking context
        - Achievement milestone recognition
        
        **Use Cases:**
        - Detailed performance review
        - Learning analytics deep-dive
        - Academic counseling support
        - Performance improvement planning
        - Achievement portfolio building
        `,
        operationId: 'getDetailedResult',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Result identifier for detailed information',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Detailed result retrieved successfully',
        type: ResultDetailDto,
    })
    @ApiUnauthorizedResponse({
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiNotFoundResponse({
        description: '❌ Result not found or access denied',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Result not found' },
            },
        },
    })
    async getResult(
        @Param('id', ParseIntPipe) id: number,
        @GetUser() user: User,
    ): Promise<ResultResponseDto> {
        this.logger.log(`Getting result: ${id} for user: ${user.id}`);
        return this.resultsService.findOne(id, user.id);
    }

    @Post(':id/recalculate')
    @ApiOperation({
        summary: '🔄 Recalculate Result',
        description: `
        **Recalculates and updates result scores and analytics**
        
        This endpoint handles comprehensive result recalculation including:
        - Score recomputation with updated algorithms
        - Grade boundary adjustments
        - Performance metric refresh
        - Analytics data regeneration
        - Achievement status updates
        
        **Administrative Features:**
        - Manual grade corrections and adjustments
        - Algorithm updates and improvements
        - Data consistency maintenance
        - Historical correction processing
        - Audit trail maintenance
        
        **Quality Assurance:**
        - Score validation and verification
        - Grade boundary compliance
        - Performance metric accuracy
        - Analytics consistency checks
        - Student record integrity
        
        **Use Cases:**
        - Grade corrections and appeals
        - System updates and improvements
        - Data migration and cleanup
        - Quality assurance processes
        - Educational research adjustments
        `,
        operationId: 'recalculateResult',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Result identifier to recalculate',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Result recalculated successfully',
        type: ResultResponseDto,
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Result recalculated successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        resultId: { type: 'number', example: 1 },
                        oldScore: { type: 'number', example: 85.5 },
                        newScore: { type: 'number', example: 87.0 },
                        oldPercentage: { type: 'number', example: 85.5 },
                        newPercentage: { type: 'number', example: 87.0 },
                        recalculatedAt: {
                            type: 'string',
                            example: '2024-01-15T14:30:00.000Z',
                        },
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
            '🚷 Forbidden - Not authorized to recalculate results (instructor access required)',
    })
    @ApiNotFoundResponse({
        description: '❌ Result not found',
    })
    async recalculateResult(
        @Param('id', ParseIntPipe) id: number,
        @GetUser() user: User,
    ): Promise<ResultResponseDto> {
        this.logger.log(`Recalculating result: ${id} by user: ${user.id}`);
        return this.resultsService.recalculateResult(id, user.id);
    }
}
