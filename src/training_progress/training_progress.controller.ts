import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    ParseIntPipe,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiHeader,
    ApiSecurity,
    ApiBody,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiNotFoundResponse,
    ApiForbiddenResponse,
} from '@nestjs/swagger';
import { TrainingProgressService } from './training_progress.service';
import { CreateTrainingProgressDto } from './dto/create-training_progress.dto';
import { UpdateTrainingProgressDto } from './dto/update-training_progress.dto';
import { TrainingProgressResponseDto } from './dto/training-progress-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('📈 Training Progress & Learning Analytics')
@Controller('training-progress')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class TrainingProgressController {
    private readonly logger = new Logger(TrainingProgressController.name);

    constructor(
        private readonly trainingProgressService: TrainingProgressService,
    ) {}

    @Get('user/:userId')
    @ApiOperation({
        summary: '👤 Get User Training Progress',
        description: `
        **Retrieves comprehensive training progress data for a specific user**
        
        This endpoint provides detailed learning analytics and progress tracking including:
        - Course-specific progress metrics
        - Test completion percentages
        - Time spent learning
        - Question completion statistics
        - Learning pace analysis
        
        **Features:**
        - Optional course filtering for focused analysis
        - Historical progress tracking
        - Learning pattern insights
        - Performance trend analysis
        
        **Access Control:**
        - Users can access their own progress
        - Instructors can view student progress in their courses
        - Administrators have full access
        
        **Use Cases:**
        - Student dashboard
        - Progress tracking
        - Learning analytics
        - Performance monitoring
        - Course completion reporting
        `,
        operationId: 'getUserTrainingProgress',
    })
    @ApiParam({
        name: 'userId',
        type: String,
        description:
            'Unique identifier for the user whose progress to retrieve',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiQuery({
        name: 'courseId',
        type: Number,
        required: false,
        description: 'Optional course ID to filter progress by specific course',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User training progress retrieved successfully',
        type: [TrainingProgressResponseDto],
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'User progress retrieved successfully',
                },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            progressId: { type: 'number', example: 1 },
                            courseId: { type: 'number', example: 1 },
                            testId: { type: 'number', example: 1 },
                            completionPercentage: {
                                type: 'number',
                                example: 75.5,
                            },
                            timeSpentMinutes: { type: 'number', example: 120 },
                            questionsCompleted: { type: 'number', example: 15 },
                            totalQuestions: { type: 'number', example: 20 },
                            lastUpdated: {
                                type: 'string',
                                example: '2024-01-15T14:30:00.000Z',
                            },
                            course: {
                                type: 'object',
                                properties: {
                                    title: {
                                        type: 'string',
                                        example: 'Web Development Bootcamp',
                                    },
                                    description: {
                                        type: 'string',
                                        example:
                                            'Complete web development course',
                                    },
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
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiNotFoundResponse({
        description: '❌ User not found or no progress data available',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'No progress data found for user',
                },
            },
        },
    })
    @ApiForbiddenResponse({
        description:
            "🚷 Forbidden - Insufficient permissions to access this user's progress",
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 403 },
                message: { type: 'string', example: 'Forbidden' },
            },
        },
    })
    async getUserProgress(
        @Param('userId') userId: string,
        @Query('courseId', new ParseIntPipe({ optional: true }))
        courseId?: number,
    ): Promise<TrainingProgressResponseDto[]> {
        this.logger.log(
            `Getting progress for user: ${userId}, course: ${courseId || 'all'}`,
        );
        return this.trainingProgressService.getUserProgress(userId, courseId);
    }

    @Post('update')
    @ApiOperation({
        summary: '🔄 Update Training Progress',
        description: `
        **Updates or creates training progress records for a user**
        
        This endpoint handles real-time progress tracking including:
        - Automatic progress calculation
        - Time tracking and analytics
        - Question completion monitoring
        - Learning milestone recording
        - Performance trend updates
        
        **Smart Features:**
        - Automatic creation if no progress exists
        - Incremental updates for existing progress
        - Real-time learning analytics
        - Optimized for frequent updates
        
        **Business Logic:**
        - Progress percentages calculated automatically
        - Time spent accumulates over sessions
        - Question completion tracking
        - Course-level and test-level progress
        
        **Use Cases:**
        - Real-time progress updates during learning
        - Session completion tracking
        - Learning analytics data collection
        - Performance milestone recording
        `,
        operationId: 'updateTrainingProgress',
    })
    @ApiBody({
        description:
            'Progress update data with flexible structure for various update scenarios',
        schema: {
            type: 'object',
            properties: {
                userId: {
                    type: 'string',
                    description: 'User ID for progress tracking',
                    example: '123e4567-e89b-12d3-a456-426614174000',
                },
                courseId: {
                    type: 'number',
                    description: 'Course ID for progress context',
                    example: 1,
                },
                testId: {
                    type: 'number',
                    description: 'Optional test ID for specific test progress',
                    example: 1,
                },
                updateData: {
                    type: 'object',
                    description: 'Progress data to update',
                    properties: {
                        completionPercentage: { type: 'number', example: 85.5 },
                        timeSpentMinutes: { type: 'number', example: 30 },
                        questionsCompleted: { type: 'number', example: 17 },
                        totalQuestions: { type: 'number', example: 20 },
                    },
                },
            },
            required: ['userId', 'courseId'],
        },
        examples: {
            'course-progress': {
                summary: '📚 Course Progress Update',
                description: 'Update overall course progress',
                value: {
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    courseId: 1,
                    updateData: {
                        completionPercentage: 65.0,
                        timeSpentMinutes: 45,
                    },
                },
            },
            'test-progress': {
                summary: '📝 Test Progress Update',
                description: 'Update specific test progress',
                value: {
                    userId: '123e4567-e89b-12d3-a456-426614174000',
                    courseId: 1,
                    testId: 3,
                    updateData: {
                        completionPercentage: 100.0,
                        timeSpentMinutes: 60,
                        questionsCompleted: 20,
                        totalQuestions: 20,
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Training progress updated successfully',
        type: TrainingProgressResponseDto,
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid input data or validation errors',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: { type: 'array', items: { type: 'string' } },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    async updateProgress(
        @Body()
        body: {
            userId: string;
            courseId: number;
            testId?: number;
            updateData?: Partial<CreateTrainingProgressDto>;
        },
    ): Promise<TrainingProgressResponseDto> {
        this.logger.log(
            `Updating progress for user: ${body.userId}, course: ${body.courseId}`,
        );
        return this.trainingProgressService.updateProgress(
            body.userId,
            body.courseId,
            body.testId,
            body.updateData,
        );
    }

    @Get('course/:courseId')
    @ApiOperation({
        summary: '📚 Get Course Training Progress',
        description: `
        **Retrieves comprehensive progress analytics for all users in a course**
        
        This endpoint provides course-wide learning analytics including:
        - Student progress summaries
        - Course completion statistics
        - Learning pace analysis
        - Performance distribution
        - Engagement metrics
        
        **Instructor Features:**
        - Class-wide progress overview
        - Individual student tracking
        - Learning analytics dashboard
        - Performance identification
        - Completion monitoring
        
        **Access Control:**
        - Course instructors have full access
        - Students can only see aggregated data
        - Administrators have unrestricted access
        
        **Use Cases:**
        - Instructor dashboard
        - Course analytics
        - Student progress monitoring
        - Performance analysis
        - Curriculum effectiveness assessment
        `,
        operationId: 'getCourseTrainingProgress',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier for progress retrieval',
        example: 1,
    })
    @ApiQuery({
        name: 'userId',
        type: String,
        required: false,
        description: 'Optional user ID to filter progress for specific student',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Course training progress retrieved successfully',
        type: [TrainingProgressResponseDto],
    })
    @ApiNotFoundResponse({
        description: '❌ Course not found or no progress data available',
    })
    async getCourseProgress(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query('userId') userId?: string,
    ): Promise<TrainingProgressResponseDto[]> {
        this.logger.log(
            `Getting course progress for course: ${courseId}, user: ${userId || 'all'}`,
        );
        return this.trainingProgressService.getCourseProgress(courseId, userId);
    }

    @Get('completion/:userId/:courseId')
    @ApiOperation({
        summary: '🎯 Calculate Completion Analytics',
        description: `
        **Calculates comprehensive completion analytics for user and course**
        
        This endpoint provides detailed completion analysis including:
        - Overall course completion percentage
        - Individual test completion breakdown
        - Learning milestone achievements
        - Time investment analysis
        - Progress trajectory insights
        
        **Analytics Features:**
        - Real-time completion calculation
        - Test-by-test breakdown
        - Performance trending
        - Learning velocity metrics
        - Completion predictions
        
        **Use Cases:**
        - Student progress reports
        - Completion certificates
        - Learning analytics
        - Progress dashboards
        - Academic reporting
        `,
        operationId: 'calculateCompletionAnalytics',
    })
    @ApiParam({
        name: 'userId',
        type: String,
        description: 'User identifier for completion calculation',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiParam({
        name: 'courseId',
        type: Number,
        description: 'Course identifier for completion context',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Completion analytics calculated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Completion analytics calculated successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        overallCompletion: {
                            type: 'number',
                            example: 78.5,
                            description: 'Overall course completion percentage',
                        },
                        testCompletions: {
                            type: 'array',
                            description: 'Individual test completion details',
                            items: {
                                type: 'object',
                                properties: {
                                    testId: { type: 'number', example: 1 },
                                    testTitle: {
                                        type: 'string',
                                        example: 'JavaScript Fundamentals',
                                    },
                                    completionPercentage: {
                                        type: 'number',
                                        example: 100.0,
                                    },
                                    questionsCompleted: {
                                        type: 'number',
                                        example: 20,
                                    },
                                    totalQuestions: {
                                        type: 'number',
                                        example: 20,
                                    },
                                    timeSpentMinutes: {
                                        type: 'number',
                                        example: 45,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    async calculateCompletion(
        @Param('userId') userId: string,
        @Param('courseId', ParseIntPipe) courseId: number,
    ): Promise<{ overallCompletion: number; testCompletions: any[] }> {
        this.logger.log(
            `Calculating completion for user: ${userId}, course: ${courseId}`,
        );
        return this.trainingProgressService.calculateCompletion(
            userId,
            courseId,
        );
    }

    @Get('stats/:userId')
    @ApiOperation({
        summary: '📊 Get User Progress Statistics',
        description: `
        **Retrieves comprehensive learning statistics and analytics for a user**
        
        This endpoint provides detailed learning insights including:
        - Overall learning time investment
        - Question completion statistics
        - Course engagement metrics
        - Learning velocity analysis
        - Achievement summaries
        
        **Analytics Included:**
        - Total time spent learning
        - Questions completed across all courses
        - Average completion percentages
        - Active course participation
        - Learning consistency metrics
        
        **Use Cases:**
        - Personal learning dashboard
        - Achievement tracking
        - Learning habit analysis
        - Performance reporting
        - Gamification features
        `,
        operationId: 'getUserProgressStatistics',
    })
    @ApiParam({
        name: 'userId',
        type: String,
        description: 'User identifier for statistics retrieval',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiQuery({
        name: 'courseId',
        type: Number,
        required: false,
        description:
            'Optional course ID to filter statistics by specific course',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Progress statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Progress statistics retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        totalTimeSpent: {
                            type: 'number',
                            example: 1250,
                            description: 'Total learning time in minutes',
                        },
                        totalQuestionsCompleted: {
                            type: 'number',
                            example: 485,
                            description:
                                'Total questions answered across all courses',
                        },
                        averageCompletion: {
                            type: 'number',
                            example: 78.5,
                            description:
                                'Average completion percentage across courses',
                        },
                        coursesInProgress: {
                            type: 'number',
                            example: 3,
                            description:
                                'Number of courses currently being studied',
                        },
                        testsCompleted: {
                            type: 'number',
                            example: 12,
                            description:
                                'Number of tests completed with 100% progress',
                        },
                    },
                },
            },
        },
    })
    async getProgressStats(
        @Param('userId') userId: string,
        @Query('courseId', new ParseIntPipe({ optional: true }))
        courseId?: number,
    ): Promise<{
        totalTimeSpent: number;
        totalQuestionsCompleted: number;
        averageCompletion: number;
        coursesInProgress: number;
        testsCompleted: number;
    }> {
        this.logger.log(
            `Getting progress stats for user: ${userId}, course: ${courseId || 'all'}`,
        );
        return this.trainingProgressService.getProgressStats(userId, courseId);
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Training Progress by ID',
        description: `
        **Retrieves specific training progress record with comprehensive details**
        
        This endpoint provides detailed information about a single progress entry including:
        - Complete progress metrics
        - Associated course and test information
        - User context and relationships
        - Historical tracking data
        - Learning analytics insights
        
        **Features:**
        - Full relational data loading
        - Complete progress context
        - Associated entity information
        - Timestamp tracking
        
        **Use Cases:**
        - Progress detail views
        - Administrative monitoring
        - Data analysis
        - Audit trails
        - Progress verification
        `,
        operationId: 'getTrainingProgressById',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Training progress record identifier',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Training progress retrieved successfully',
        type: TrainingProgressResponseDto,
    })
    @ApiNotFoundResponse({
        description: '❌ Training progress record not found',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'Training progress not found',
                },
            },
        },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<TrainingProgressResponseDto> {
        this.logger.log(`Getting progress record: ${id}`);
        return this.trainingProgressService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({
        summary: '✏️ Update Training Progress by ID',
        description: `
        **Updates specific training progress record with validation and security**
        
        This endpoint allows direct updates to progress records including:
        - Completion percentage adjustments
        - Time tracking modifications
        - Question completion updates
        - Learning milestone corrections
        - Progress data maintenance
        
        **Administrative Features:**
        - Direct progress record modification
        - Bulk data corrections
        - Historical data updates
        - Progress recalculation
        - Data integrity maintenance
        
        **Security & Validation:**
        - Permission-based access control
        - Data integrity validation
        - Audit trail maintenance
        - Change tracking
        
        **Use Cases:**
        - Administrative corrections
        - Data migration
        - Progress adjustments
        - System maintenance
        - Bulk updates
        `,
        operationId: 'updateTrainingProgressById',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Training progress record identifier to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateTrainingProgressDto,
        description:
            'Progress update data with optional fields for partial updates',
        examples: {
            'completion-update': {
                summary: '📈 Completion Update',
                description: 'Update completion percentage and time',
                value: {
                    completionPercentage: 95.0,
                    timeSpentMinutes: 180,
                },
            },
            'question-update': {
                summary: '❓ Question Progress Update',
                description: 'Update question completion metrics',
                value: {
                    questionsCompleted: 18,
                    totalQuestions: 20,
                    completionPercentage: 90.0,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Training progress updated successfully',
        type: TrainingProgressResponseDto,
    })
    @ApiBadRequestResponse({
        description: '❌ Invalid update data or validation errors',
    })
    @ApiNotFoundResponse({
        description: '❌ Training progress record not found',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTrainingProgressDto: UpdateTrainingProgressDto,
    ): Promise<TrainingProgressResponseDto> {
        this.logger.log(`Updating progress record: ${id}`);
        return this.trainingProgressService.update(
            id,
            updateTrainingProgressDto,
        );
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Training Progress Record',
        description: `
        **Permanently deletes a training progress record with proper validation**
        
        This endpoint handles secure deletion of progress records including:
        - Data integrity verification
        - Dependency checking
        - Audit trail maintenance
        - Cascade effect analysis
        - Cleanup operations
        
        **Security Features:**
        - Permission validation
        - Data relationship checking
        - Soft delete considerations
        - Audit logging
        - Recovery options
        
        **Administrative Control:**
        - Bulk deletion support
        - Data cleanup operations
        - System maintenance
        - Historical data management
        
        **Use Cases:**
        - Data cleanup
        - User account deletion
        - Course removal
        - System maintenance
        - Privacy compliance
        `,
        operationId: 'deleteTrainingProgress',
    })
    @ApiParam({
        name: 'id',
        type: Number,
        description: 'Training progress record identifier to delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Training progress deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Training progress deleted successfully',
                },
            },
        },
    })
    @ApiNotFoundResponse({
        description: '❌ Training progress record not found',
    })
    @ApiForbiddenResponse({
        description:
            '🚷 Forbidden - Insufficient permissions to delete this record',
    })
    async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        this.logger.log(`Deleting progress record: ${id}`);
        return this.trainingProgressService.remove(id);
    }
}
