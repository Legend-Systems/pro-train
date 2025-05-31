import {
    Controller,
    Get,
    Post,
    Put,
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
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionFilterDto } from './dto/question-filter.dto';
import { QuestionResponseDto } from './dto/question-response.dto';
import { QuestionListResponseDto } from './dto/question-list-response.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';
import { StandardOperationResponse } from '../user/dto/common-response.dto';

@ApiTags('❓ Questions Management')
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
        summary: '❓ Create New Question',
        description: `
      **Creates a new question for a test with comprehensive validation**
      
      This endpoint allows test creators to add questions including:
      - Question text and content
      - Question type specification (multiple choice, true/false, etc.)
      - Point value assignment
      - Order positioning within test
      
      **Authorization Requirements:**
      - Must be the owner of the test
      - Valid JWT authentication required
      
      **Business Rules:**
      - Test must exist and be accessible to the user
      - Question type determines available answer options
      - Points must be positive (minimum 1)
      - Order index is auto-assigned if not provided
      - Question text is required and cannot be empty
      
      **Use Cases:**
      - Building test question banks
      - Creating exam content
      - Setting up quiz questions
      - Preparing training assessments
    `,
        operationId: 'createQuestion',
    })
    @ApiBody({
        type: CreateQuestionDto,
        description: 'Question creation data with test assignment',
        examples: {
            'multiple-choice': {
                summary: '🔢 Multiple Choice Question',
                description:
                    'Create a multiple choice question with several options',
                value: {
                    testId: 1,
                    questionText:
                        'What is the time complexity of binary search algorithm?',
                    questionType: 'multiple_choice',
                    points: 5,
                    orderIndex: 1,
                },
            },
            'true-false': {
                summary: '✅ True/False Question',
                description: 'Create a simple true or false question',
                value: {
                    testId: 1,
                    questionText: 'Arrays in JavaScript are zero-indexed.',
                    questionType: 'true_false',
                    points: 2,
                    orderIndex: 2,
                },
            },
            essay: {
                summary: '📝 Essay Question',
                description: 'Create an open-ended essay question',
                value: {
                    testId: 1,
                    questionText:
                        'Explain the differences between procedural and object-oriented programming paradigms. Provide examples.',
                    questionType: 'essay',
                    points: 15,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Question created successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    example: [
                        'Question text cannot be empty',
                        'Points must be at least 1',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to the specified test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '🔄 Question with this order index already exists',
    })
    async create(
        @Body() createQuestionDto: CreateQuestionDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating question for test ${createQuestionDto.testId} by user: ${scope.userId}`,
            );

            const result = await this.questionsService.create(
                createQuestionDto,
                scope,
            );

            this.logger.log(
                `Question created successfully for test ${createQuestionDto.testId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error creating question for user ${scope.userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Post('bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '📋 Create Multiple Questions in Bulk',
        description: `
      **Creates multiple questions for tests in a single operation**
      
      This endpoint enables efficient bulk creation of questions:
      - Single transaction for all questions
      - Automatic order index assignment
      - Comprehensive validation for all questions
      - Rollback on any validation failure
      
      **Performance Features:**
      - Batch processing for improved performance
      - Transaction-based integrity
      - Bulk validation processing
      - Optimized database operations
      
      **Business Rules:**
      - All questions must pass validation
      - User must have access to all referenced tests
      - Order indices are automatically assigned per test
      - Points must be positive for all questions
      
      **Use Cases:**
      - Importing questions from external sources
      - Creating complete test question sets
      - Migrating question banks
      - Rapid test development
    `,
        operationId: 'createQuestionsInBulk',
    })
    @ApiBody({
        type: BulkCreateQuestionsDto,
        description: 'Bulk question creation data',
        examples: {
            'mixed-types': {
                summary: '🎯 Mixed Question Types',
                description: 'Create various types of questions in bulk',
                value: {
                    questions: [
                        {
                            testId: 1,
                            questionText: 'What is the capital of France?',
                            questionType: 'multiple_choice',
                            points: 2,
                        },
                        {
                            testId: 1,
                            questionText: 'JavaScript is a compiled language.',
                            questionType: 'true_false',
                            points: 1,
                        },
                        {
                            testId: 1,
                            questionText:
                                'Explain the concept of closures in JavaScript.',
                            questionType: 'short_answer',
                            points: 5,
                        },
                    ],
                },
            },
            'exam-questions': {
                summary: '🎓 Complete Exam Questions',
                description: 'Create a full set of exam questions',
                value: {
                    questions: [
                        {
                            testId: 2,
                            questionText:
                                'Which sorting algorithm has O(n log n) average time complexity?',
                            questionType: 'multiple_choice',
                            points: 3,
                        },
                        {
                            testId: 2,
                            questionText:
                                'Describe the advantages and disadvantages of using recursive algorithms.',
                            questionType: 'essay',
                            points: 10,
                        },
                    ],
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Questions created successfully in bulk',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description:
            '❌ Invalid input data or validation errors for one or more questions',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to one or more specified tests',
    })
    async createBulk(
        @Body() bulkCreateDto: BulkCreateQuestionsDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating ${bulkCreateDto.questions.length} questions in bulk for user: ${scope.userId}`,
            );

            const result = await this.questionsService.createBulk(
                bulkCreateDto,
                scope,
            );

            this.logger.log(
                `${bulkCreateDto.questions.length} questions created successfully in bulk`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error creating questions in bulk for user ${scope.userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Get('test/:testId')
    @ApiOperation({
        summary: '📝 Get Questions for Specific Test',
        description: `
      **Retrieves all questions for a specific test with filtering and pagination**
      
      This endpoint provides comprehensive question listings:
      - All questions within the specified test
      - Advanced filtering capabilities
      - Pagination for large question sets
      - Ordered by question index
      
      **Filtering Options:**
      - Question type filtering
      - Point value range filtering
      - Creation date range filtering
      - Pagination controls
      
      **Authorization:**
      - Test access validation
      - Ownership verification for full details
      
      **Response Includes:**
      - Complete question information
      - Option counts and statistics
      - Answer submission counts
      - Test context information
      
      **Use Cases:**
      - Test preview and review
      - Question management interfaces
      - Student test display
      - Academic content analysis
    `,
        operationId: 'getQuestionsByTest',
    })
    @ApiParam({
        name: 'testId',
        type: Number,
        description: 'Test identifier to retrieve questions for',
        example: 1,
    })
    @ApiQuery({
        name: 'questionType',
        required: false,
        enum: [
            'multiple_choice',
            'true_false',
            'short_answer',
            'essay',
            'fill_in_blank',
        ],
        description: 'Filter by question type',
        example: 'multiple_choice',
    })
    @ApiQuery({
        name: 'minPoints',
        required: false,
        type: Number,
        description: 'Filter by minimum point value',
        example: 1,
    })
    @ApiQuery({
        name: 'maxPoints',
        required: false,
        type: Number,
        description: 'Filter by maximum point value',
        example: 10,
    })
    @ApiQuery({
        name: 'page',
        required: false,
        type: Number,
        description: 'Page number for pagination',
        example: 1,
    })
    @ApiQuery({
        name: 'pageSize',
        required: false,
        type: Number,
        description: 'Number of questions per page',
        example: 10,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Test questions retrieved successfully',
        type: QuestionListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to the specified test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test not found',
    })
    async findByTest(
        @Param('testId', ParseIntPipe) testId: number,
        @Query() filters: QuestionFilterDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<QuestionListResponseDto> {
        try {
            this.logger.log(
                `Getting questions for test ${testId} with filters: ${JSON.stringify(filters)}`,
            );

            const result = await this.questionsService.findByTest(
                testId,
                scope.userId,
                filters,
            );

            this.logger.log(
                `Retrieved ${result.questions.length} questions out of ${result.total} total for test ${testId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error getting questions for test ${testId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Question Details',
        description: `
      **Retrieves detailed information about a specific question**
      
      This endpoint provides comprehensive question data including:
      - Complete question information
      - Associated answer options
      - Question statistics and analytics
      - Test context information
      
      **Detailed Information:**
      - Question text and type
      - Point value and order position
      - Creation and modification timestamps
      - Associated test information
      - Answer option counts
      - Submission statistics
      
      **Security:**
      - Question access validation
      - Test ownership verification
      - Proper permission checks
      
      **Use Cases:**
      - Question editing interfaces
      - Detailed question preview
      - Question analytics dashboard
      - Content review and approval
    `,
        operationId: 'getQuestionDetails',
    })
    @ApiParam({
        name: 'id',
        description: 'Question unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question details retrieved successfully',
        type: QuestionResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to this question',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question not found',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<QuestionResponseDto> {
        try {
            this.logger.log(`Getting question details for ID: ${id}`);

            const question = await this.questionsService.findOne(
                id,
                scope.userId,
            );

            this.logger.log(`Question details retrieved for ID: ${id}`);

            return question;
        } catch (error) {
            this.logger.error(
                `Error getting question ${id}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Question',
        description: `
      **Updates question information with comprehensive validation**
      
      This endpoint allows question owners to update questions including:
      - Question text modifications
      - Point value adjustments
      - Order index changes
      - Question type updates (with caution)
      
      **Updatable Fields:**
      - Question text content
      - Point value (must remain positive)
      - Order index within test
      - Question type (use with caution)
      
      **Security Features:**
      - Only test owners can update questions
      - Ownership validation required
      - Input validation and sanitization
      - Change audit logging
      
      **Business Rules:**
      - Cannot change question's test assignment
      - Point value must remain positive
      - Order index must be unique within test
      - Question type changes may affect existing options
      
      **Use Cases:**
      - Question content improvements
      - Point value adjustments
      - Question reordering
      - Content maintenance workflows
    `,
        operationId: 'updateQuestion',
    })
    @ApiParam({
        name: 'id',
        description: 'Question unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiBody({
        type: UpdateQuestionDto,
        description: 'Question update data',
        examples: {
            'text-update': {
                summary: '📝 Update Question Text',
                description: 'Update just the question text content',
                value: {
                    questionText:
                        'What is the average time complexity of binary search algorithm?',
                },
            },
            'points-update': {
                summary: '🎯 Update Point Value',
                description: 'Adjust the point value for the question',
                value: {
                    points: 7,
                },
            },
            'full-update': {
                summary: '🔄 Complete Update',
                description: 'Update multiple question properties',
                value: {
                    questionText:
                        'Explain the time and space complexity of the binary search algorithm.',
                    points: 8,
                    orderIndex: 3,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question updated successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or validation errors',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to update this question',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question not found',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '🔄 Question with this order index already exists',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateQuestionDto: UpdateQuestionDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Updating question ${id} for user: ${scope.userId}`,
            );

            const result = await this.questionsService.update(
                id,
                updateQuestionDto,
                scope.userId,
            );

            this.logger.log(`Question ${id} updated successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error updating question ${id} for user ${scope.userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Patch('reorder')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '🔄 Reorder Questions in Test',
        description: `
      **Reorders questions within a test by updating their order indices**
      
      This endpoint allows test creators to reorganize questions:
      - Batch update of question order indices
      - Maintains question integrity
      - Validates new order positions
      - Ensures no duplicate indices
      
      **Reordering Process:**
      - Validates user access to test
      - Checks all question IDs belong to the test
      - Updates order indices in transaction
      - Maintains referential integrity
      
      **Business Rules:**
      - User must own the test
      - All questions must belong to the specified test
      - New order indices must be unique
      - Order indices must be positive
      
      **Use Cases:**
      - Question flow optimization
      - Difficulty progression adjustment
      - Content organization improvement
      - Test structure refinement
    `,
        operationId: 'reorderQuestions',
    })
    @ApiBody({
        description: 'Question reordering data',
        schema: {
            type: 'object',
            properties: {
                testId: {
                    type: 'number',
                    example: 1,
                    description: 'Test ID containing the questions to reorder',
                },
                questions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            questionId: {
                                type: 'number',
                                example: 5,
                                description: 'Question ID to reorder',
                            },
                            newOrderIndex: {
                                type: 'number',
                                example: 2,
                                description:
                                    'New order position for the question',
                            },
                        },
                    },
                    example: [
                        { questionId: 5, newOrderIndex: 1 },
                        { questionId: 3, newOrderIndex: 2 },
                        { questionId: 7, newOrderIndex: 3 },
                    ],
                    description: 'Array of question reordering instructions',
                },
            },
        },
        examples: {
            'simple-reorder': {
                summary: '🔄 Simple Reordering',
                description: 'Reorder a few questions in a test',
                value: {
                    testId: 1,
                    questions: [
                        { questionId: 5, newOrderIndex: 1 },
                        { questionId: 3, newOrderIndex: 2 },
                        { questionId: 7, newOrderIndex: 3 },
                    ],
                },
            },
            'complete-reorganization': {
                summary: '🎯 Complete Reorganization',
                description: 'Completely reorganize all questions in a test',
                value: {
                    testId: 2,
                    questions: [
                        { questionId: 12, newOrderIndex: 1 },
                        { questionId: 15, newOrderIndex: 2 },
                        { questionId: 13, newOrderIndex: 3 },
                        { questionId: 14, newOrderIndex: 4 },
                        { questionId: 11, newOrderIndex: 5 },
                    ],
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Questions reordered successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid reorder data or duplicate indices',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to modify this test',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Test or one or more questions not found',
    })
    async reorder(
        @Body()
        reorderData: {
            testId: number;
            questions: { questionId: number; newOrderIndex: number }[];
        },
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Reordering ${reorderData.questions.length} questions in test ${reorderData.testId}`,
            );

            const result = await this.questionsService.reorder(
                reorderData.testId,
                reorderData.questions,
                scope.userId,
            );

            this.logger.log(
                `Questions reordered successfully in test ${reorderData.testId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error reordering questions in test ${reorderData.testId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: '🗑️ Delete Question',
        description: `
      **Permanently deletes a question with comprehensive validation**
      
      This endpoint allows question owners to delete questions with:
      - Ownership verification
      - Cascade relationship handling
      - Data integrity protection
      - Audit trail logging
      
      **Deletion Process:**
      - Validates user ownership of test
      - Checks for existing answers
      - Prevents deletion if answers exist
      - Performs cascading deletions as needed
      - Logs deletion for audit purposes
      
      **Safety Features:**
      - Only test owners can delete questions
      - Prevents deletion of questions with submitted answers
      - Confirms deletion before execution
      - Maintains referential integrity
      
      **Important Notes:**
      - **This action is irreversible**
      - All question data will be permanently deleted
      - Associated options and answers may be removed
      - Consider archiving instead of deletion
      
      **Use Cases:**
      - Question cleanup and maintenance
      - Removing outdated content
      - Test content management
      - Question lifecycle management
    `,
        operationId: 'deleteQuestion',
    })
    @ApiParam({
        name: 'id',
        description: 'Question unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question deleted successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot delete question that has submitted answers',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to delete this question',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question not found',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Deleting question ${id} for user: ${scope.userId}`,
            );

            const result = await this.questionsService.remove(id, scope.userId);

            this.logger.log(`Question ${id} deleted successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error deleting question ${id} for user ${scope.userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }
}
