import {
    Controller,
    Get,
    Post,
    Delete,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    HttpStatus,
    HttpCode,
    Logger,
    Request,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
    ApiBody,
    ApiHeader,
    ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionFilterDto } from './dto/question-filter.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import {
    StandardApiResponse,
    QuestionApiResponse,
    QuestionListApiResponse,
    QuestionCreatedResponse,
    QuestionUpdatedResponse,
    QuestionDeletedResponse,
    QuestionsReorderedResponse,
    BulkQuestionsCreatedResponse,
} from './dto/question-response.dto';
import { StandardOperationResponse } from '../user/dto/common-response.dto';

@ApiTags('❓ Questions Management with Media Support')
@Controller('questions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class QuestionsController {
    private readonly logger = new Logger(QuestionsController.name);

    constructor(private readonly questionsService: QuestionsService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '➕ Create New Question',
        description: `
      **Creates a new question for a test with comprehensive validation and media support**
      
      This endpoint allows authorized users to create questions for tests within their organization scope:
      - Validates test access and permissions
      - Automatically assigns organization and branch context
      - Supports various question types (multiple choice, true/false, etc.)
      - **NEW: Media integration** - attach images, videos, or documents to questions
      - Auto-increments order index if not provided
      - Comprehensive caching invalidation
      
      **Media Integration:**
      - Link media files from @/media-manager using mediaFileId
      - Supports images (JPEG, PNG, WebP, GIF), videos (MP4, WebM), documents (PDF)
      - Add custom instructions for media content (e.g., "Watch the video and answer:")
      - Media files are validated for organization/branch access
      - Automatic hasMedia flag setting
      
      **Question Types with Media Examples:**
      - **Text Question**: Traditional text-only questions
      - **Image Question**: "Examine the diagram above and identify the design pattern"
      - **Video Question**: "Watch the debugging session and answer which technique was used"
      - **Document Question**: "Review the code snippet and find the error"
      
      **Security Features:**
      - Requires valid JWT authentication
      - Organization/branch scope validation
      - Test ownership verification
      - Media file access validation
      
      **Use Cases:**
      - Test content creation with rich media
      - Visual assessment development
      - Code review questions with screenshots
      - Tutorial-based learning assessments
    `,
        operationId: 'createQuestion',
    })
    @ApiBody({
        type: CreateQuestionDto,
        description: 'Question creation data with optional media attachment',
        examples: {
            'multiple-choice': {
                summary: '🔘 Multiple Choice Question',
                description:
                    'Creates a traditional text-only multiple choice question',
                value: {
                    testId: 1,
                    questionText:
                        'What is the time complexity of binary search?',
                    questionType: 'multiple_choice',
                    points: 5,
                    orderIndex: 1,
                },
            },
            'image-question': {
                summary: '🖼️ Image-Based Question',
                description:
                    'Creates a question with an attached image for visual analysis',
                value: {
                    testId: 1,
                    questionText: 'What design pattern is demonstrated?',
                    questionType: 'multiple_choice',
                    points: 8,
                    mediaFileId: 123,
                    mediaInstructions:
                        'Examine the UML diagram above and identify the pattern:',
                },
            },
            'video-question': {
                summary: '🎥 Video-Based Question',
                description:
                    'Creates a question with an attached video for demonstration-based assessment',
                value: {
                    testId: 1,
                    questionText:
                        'Which debugging technique was primarily used?',
                    questionType: 'multiple_choice',
                    points: 10,
                    mediaFileId: 456,
                    mediaInstructions:
                        'Watch the debugging session video and then answer:',
                },
            },
            'document-question': {
                summary: '📄 Document-Based Question',
                description:
                    'Creates a question with an attached document for code review or analysis',
                value: {
                    testId: 1,
                    questionText: 'What is the error in the provided code?',
                    questionType: 'short_answer',
                    points: 15,
                    mediaFileId: 789,
                    mediaInstructions:
                        'Review the code snippet in the document and identify the issue:',
                },
            },
            'true-false': {
                summary: '✅ True/False Question',
                description: 'Creates a true/false question',
                value: {
                    testId: 1,
                    questionText: 'Binary search works only on sorted arrays.',
                    questionType: 'true_false',
                    points: 3,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Question created successfully',
        type: QuestionCreatedResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Question text is required',
                        'Points must be a positive number',
                        'Invalid question type',
                        'Invalid media file ID: 123',
                        'Media file does not exist or access denied',
                    ],
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 400 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Test with ID 1 not found',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 404 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Order index conflict',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example:
                        'Question with order index 1 already exists in this test',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 409 },
            },
        },
    })
    async create(
        @Body() createQuestionDto: CreateQuestionDto,
        @OrgBranchScope() scope: any,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating question for test ${createQuestionDto.testId} by user: ${req.user.id}`,
            );

            return await this.questionsService.create(createQuestionDto, scope);
        } catch (error) {
            this.logger.error(
                `Error creating question for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Post('bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '📦 Create Multiple Questions in Bulk',
        description: `
      **Creates multiple questions simultaneously with transaction safety**
      
      This endpoint allows batch creation of questions for efficient content management:
      - All questions created in a single transaction
      - Rollback on any failure ensures data consistency
      - Validates all questions before creation
      - Comprehensive cache invalidation for all affected tests
      
      **Use Cases:**
      - Bulk content import
      - Test template creation
      - Educational content migration
      - Batch question uploads
    `,
        operationId: 'createBulkQuestions',
    })
    @ApiBody({
        type: BulkCreateQuestionsDto,
        description: 'Bulk questions creation data',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Questions created successfully in bulk',
        type: BulkQuestionsCreatedResponse,
    })
    async createBulk(
        @Body() bulkCreateDto: BulkCreateQuestionsDto,
        @OrgBranchScope() scope: any,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating ${bulkCreateDto.questions.length} questions in bulk by user: ${req.user.id}`,
            );

            return await this.questionsService.createBulk(bulkCreateDto, scope);
        } catch (error) {
            this.logger.error(
                `Error creating bulk questions for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get('test/:testId')
    @ApiOperation({
        summary: '📋 Get Questions by Test',
        description: `
      **Retrieves all questions for a specific test with filtering and pagination**
      
      This endpoint provides comprehensive question listing with:
      - Advanced filtering by question type, points range, creation date
      - Pagination support for large question sets
      - Total points calculation for the test
      - Comprehensive caching for performance
      
      **Filtering Options:**
      - Question type (multiple_choice, true_false, etc.)
      - Points range (minimum and maximum)
      - Creation date range
      - Pagination (page, pageSize)
    `,
        operationId: 'getQuestionsByTest',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to retrieve questions for',
        example: 1,
    })
    @ApiQuery({
        name: 'questionType',
        required: false,
        description: 'Filter by question type',
        example: 'multiple_choice',
    })
    @ApiQuery({
        name: 'minPoints',
        required: false,
        description: 'Minimum points filter',
        example: 1,
    })
    @ApiQuery({
        name: 'maxPoints',
        required: false,
        description: 'Maximum points filter',
        example: 10,
    })
    @ApiQuery({
        name: 'page',
        required: false,
        description: 'Page number for pagination',
        example: 1,
    })
    @ApiQuery({
        name: 'pageSize',
        required: false,
        description: 'Number of questions per page',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Questions retrieved successfully',
        type: QuestionListApiResponse,
    })
    async findByTest(
        @Param('testId', ParseIntPipe) testId: number,
        @Query() filters: QuestionFilterDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting questions for test ${testId} by user: ${req.user.id}`,
            );

            const result = await this.questionsService.findByTest(
                testId,
                req.user.id,
                filters,
            );

            return {
                success: true,
                message: 'Questions retrieved successfully',
                data: result,
                meta: {
                    timestamp: new Date().toISOString(),
                    pagination: {
                        page: result.page,
                        limit: result.pageSize,
                        total: result.total,
                        totalPages: result.totalPages,
                    },
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting questions for test ${testId} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Question by ID',
        description: `
      **Retrieves a single question with comprehensive details and media information**
      
      This endpoint provides detailed question information including:
      - Complete question data with test context
      - **Media integration**: Full media file information with URLs when attached
      - Media instructions and hasMedia flag
      - Related options count (when implemented)
      - Answer statistics (when implemented)
      - Comprehensive caching for performance
      
      **Media Information Included:**
      - Media file details (originalName, url, type, size)
      - Media metadata (dimensions for images, duration for videos)
      - Media variants (thumbnails, different sizes)
      - Access-controlled URLs from @/media-manager
      
      **Response Examples:**
      - **Text Question**: Standard question data without media fields
      - **Image Question**: Includes mediaFile object with image URL and dimensions
      - **Video Question**: Includes mediaFile object with video URL and metadata
      - **Document Question**: Includes mediaFile object with document URL and info
    `,
        operationId: 'getQuestionById',
    })
    @ApiParam({
        name: 'id',
        description: 'Question ID to retrieve',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question retrieved successfully',
        type: QuestionApiResponse,
        examples: {
            'text-question': {
                summary: '📝 Text Question Response',
                value: {
                    success: true,
                    message: 'Question retrieved successfully',
                    data: {
                        questionId: 1,
                        testId: 5,
                        questionText:
                            'What is the time complexity of binary search?',
                        questionType: 'multiple_choice',
                        points: 5,
                        orderIndex: 1,
                        mediaFileId: null,
                        hasMedia: false,
                        mediaInstructions: null,
                        mediaFile: null,
                        optionsCount: 4,
                        answersCount: 12,
                    },
                },
            },
            'image-question': {
                summary: '🖼️ Image Question Response',
                value: {
                    success: true,
                    message: 'Question retrieved successfully',
                    data: {
                        questionId: 2,
                        testId: 5,
                        questionText: 'What design pattern is demonstrated?',
                        questionType: 'multiple_choice',
                        points: 8,
                        orderIndex: 2,
                        mediaFileId: 123,
                        hasMedia: true,
                        mediaInstructions:
                            'Examine the UML diagram above and identify the pattern:',
                        mediaFile: {
                            id: 123,
                            originalName: 'design-pattern-diagram.png',
                            url: 'https://storage.googleapis.com/bucket/media/org-123/2025/01/15/uuid-design-pattern-diagram.png',
                            type: 'image',
                            width: 800,
                            height: 600,
                            size: 245760,
                        },
                        optionsCount: 4,
                        answersCount: 8,
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question not found',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'Question with ID 1 not found',
                },
                data: { type: 'null' },
            },
        },
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Getting question ${id} by user: ${req.user.id}`);

            const question = await this.questionsService.findOne(
                id,
                req.user.id,
            );

            return {
                success: true,
                message: 'Question retrieved successfully',
                data: question,
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting question ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Patch(':id')
    @ApiOperation({
        summary: '✏️ Update Question',
        description: `
      **Updates an existing question with validation and cache management**
      
      This endpoint allows updating question properties including:
      - Question text and type modifications
      - Points value adjustments
      - Order index changes (with conflict checking)
      - Comprehensive cache invalidation
    `,
        operationId: 'updateQuestion',
    })
    @ApiParam({
        name: 'id',
        description: 'Question ID to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateQuestionDto,
        description: 'Question update data',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question updated successfully',
        type: QuestionUpdatedResponse,
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateQuestionDto: UpdateQuestionDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Updating question ${id} by user: ${req.user.id}`);

            return await this.questionsService.update(
                id,
                updateQuestionDto,
                req.user.id,
            );
        } catch (error) {
            this.logger.error(
                `Error updating question ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Patch('reorder/:testId')
    @ApiOperation({
        summary: '🔄 Reorder Questions in Test',
        description: `
      **Reorders questions within a test with transaction safety**
      
      This endpoint allows bulk reordering of questions for better test organization:
      - Transaction-based updates ensure consistency
      - Comprehensive cache invalidation
      - Batch processing for efficiency
    `,
        operationId: 'reorderQuestions',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to reorder questions for',
        example: 1,
    })
    @ApiBody({
        description: 'Array of question reorder data',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    questionId: { type: 'number', example: 1 },
                    newOrderIndex: { type: 'number', example: 2 },
                },
                required: ['questionId', 'newOrderIndex'],
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Questions reordered successfully',
        type: QuestionsReorderedResponse,
    })
    async reorder(
        @Param('testId', ParseIntPipe) testId: number,
        @Body() reorderData: { questionId: number; newOrderIndex: number }[],
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Reordering questions in test ${testId} by user: ${req.user.id}`,
            );

            return await this.questionsService.reorder(
                testId,
                reorderData,
                req.user.id,
            );
        } catch (error) {
            this.logger.error(
                `Error reordering questions in test ${testId} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Delete(':id')
    @ApiOperation({
        summary: '🗑️ Delete Question',
        description: `
      **Deletes a question with validation and cache management**
      
      This endpoint safely removes questions with:
      - Answer dependency checking (when implemented)
      - Comprehensive cache invalidation
      - Audit trail preservation
      - Transaction safety
    `,
        operationId: 'deleteQuestion',
    })
    @ApiParam({
        name: 'id',
        description: 'Question ID to delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question deleted successfully',
        type: QuestionDeletedResponse,
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Deleting question ${id} by user: ${req.user.id}`);

            return await this.questionsService.remove(id, req.user.id);
        } catch (error) {
            this.logger.error(
                `Error deleting question ${id} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Get('test/:testId/count')
    @ApiOperation({
        summary: '🔢 Get Question Count for Test',
        description: `
      **Retrieves the total number of questions in a test with caching**
      
      This endpoint provides efficient question counting with:
      - Comprehensive caching for performance
      - Fast count retrieval without full data loading
      - Test validation and access control
    `,
        operationId: 'getQuestionCount',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to count questions for',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question count retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Question count retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        count: { type: 'number', example: 15 },
                        testId: { type: 'number', example: 1 },
                    },
                },
                meta: {
                    type: 'object',
                    properties: {
                        timestamp: {
                            type: 'string',
                            example: '2025-01-01T12:00:00.000Z',
                        },
                    },
                },
            },
        },
    })
    async getQuestionCount(
        @Param('testId', ParseIntPipe) testId: number,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(
                `Getting question count for test ${testId} by user: ${req.user.id}`,
            );

            const count = await this.questionsService.getQuestionCount(testId);

            return {
                success: true,
                message: 'Question count retrieved successfully',
                data: {
                    count,
                    testId,
                },
                meta: {
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error) {
            this.logger.error(
                `Error getting question count for test ${testId} by user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
