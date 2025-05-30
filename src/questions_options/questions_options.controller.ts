import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
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
    ApiBody,
    ApiHeader,
    ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { QuestionsOptionsService } from './questions_options.service';
import { CreateQuestionOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionOptionDto } from './dto/update-questions_option.dto';
import { QuestionOptionResponseDto } from './dto/question-option-response.dto';
import { QuestionOptionListResponseDto } from './dto/question-option-list-response.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';

@ApiTags('🔧 Question Options Management')
@Controller('question-options')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class QuestionsOptionsController {
    private readonly logger = new Logger(QuestionsOptionsController.name);

    constructor(
        private readonly questionsOptionsService: QuestionsOptionsService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '🔧 Create New Question Option',
        description: `
      **Creates a new answer option for a question with comprehensive validation**
      
      This endpoint allows test creators to add answer options including:
      - Option text and content
      - Correct answer designation
      - Multiple option support per question
      - Validation for question type compatibility
      
      **Authorization Requirements:**
      - Must be the owner of the test containing the question
      - Valid JWT authentication required
      
      **Business Rules:**
      - Question must exist and be accessible to the user
      - Option text is required and cannot be empty
      - At least one correct option should exist per question
      - Multiple correct options allowed for certain question types
      - Option order is automatically managed
      
      **Use Cases:**
      - Building multiple choice answer sets
      - Creating true/false options
      - Setting up selection-based questions
      - Preparing quiz answer choices
    `,
        operationId: 'createQuestionOption',
    })
    @ApiBody({
        type: CreateQuestionOptionDto,
        description: 'Question option creation data',
        examples: {
            'correct-option': {
                summary: '✅ Correct Answer Option',
                description: 'Create a correct answer option for a question',
                value: {
                    questionId: 1,
                    optionText: 'O(log n) - Logarithmic time complexity',
                    isCorrect: true,
                },
            },
            'incorrect-option': {
                summary: '❌ Incorrect Answer Option',
                description: 'Create an incorrect answer option for a question',
                value: {
                    questionId: 1,
                    optionText: 'O(n²) - Quadratic time complexity',
                    isCorrect: false,
                },
            },
            'true-false': {
                summary: '🔘 True/False Option',
                description: 'Create an option for true/false questions',
                value: {
                    questionId: 2,
                    optionText: 'True',
                    isCorrect: true,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Question option created successfully',
        type: QuestionOptionResponseDto,
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
                        'Option text cannot be empty',
                        'Question ID is required',
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
        description: '⛔ Forbidden - No access to the specified question',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question not found',
    })
    async create(
        @Body() createQuestionOptionDto: CreateQuestionOptionDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        try {
            this.logger.log(
                `Creating option for question ${createQuestionOptionDto.questionId} by user: ${userId}`,
            );

            const option = await this.questionsOptionsService.create(
                createQuestionOptionDto,
                userId,
            );

            this.logger.log(
                `Question option created successfully with ID: ${option.optionId}`,
            );

            return option;
        } catch (error) {
            this.logger.error(
                `Error creating question option for user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Post('bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: '📋 Create Multiple Question Options in Bulk',
        description: `
      **Creates multiple answer options for a question in a single operation**
      
      This endpoint enables efficient bulk creation of question options:
      - Single transaction for all options
      - Comprehensive validation for all options
      - Automatic option ordering
      - Rollback on any validation failure
      
      **Performance Features:**
      - Batch processing for improved performance
      - Transaction-based integrity
      - Bulk validation processing
      - Optimized database operations
      
      **Business Rules:**
      - All options must belong to the same question
      - User must have access to the question
      - At least one option should be marked as correct
      - Option texts must be unique within the question
      
      **Use Cases:**
      - Creating complete multiple choice option sets
      - Bulk importing answer choices
      - Setting up comprehensive question options
      - Rapid test development workflows
    `,
        operationId: 'createQuestionOptionsInBulk',
    })
    @ApiBody({
        type: BulkCreateOptionsDto,
        description: 'Bulk question options creation data',
        examples: {
            'multiple-choice-set': {
                summary: '🎯 Complete Multiple Choice Set',
                description: 'Create a full set of multiple choice options',
                value: {
                    questionId: 1,
                    options: [
                        {
                            optionText:
                                'O(log n) - Logarithmic time complexity',
                            isCorrect: true,
                        },
                        {
                            optionText: 'O(n) - Linear time complexity',
                            isCorrect: false,
                        },
                        {
                            optionText: 'O(n²) - Quadratic time complexity',
                            isCorrect: false,
                        },
                        {
                            optionText: 'O(1) - Constant time complexity',
                            isCorrect: false,
                        },
                    ],
                },
            },
            'true-false-set': {
                summary: '✅ True/False Options',
                description: 'Create true/false question options',
                value: {
                    questionId: 2,
                    options: [
                        {
                            optionText: 'True',
                            isCorrect: true,
                        },
                        {
                            optionText: 'False',
                            isCorrect: false,
                        },
                    ],
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Question options created successfully in bulk',
        type: [QuestionOptionResponseDto],
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description:
            '❌ Invalid input data or validation errors for one or more options',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to the specified question',
    })
    async createBulk(
        @Body() bulkCreateDto: BulkCreateOptionsDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto[]> {
        try {
            this.logger.log(
                `Creating ${bulkCreateDto.options.length} options in bulk for question ${bulkCreateDto.questionId}`,
            );

            const options = await this.questionsOptionsService.createBulk(
                bulkCreateDto,
                userId,
            );

            this.logger.log(
                `${options.length} question options created successfully in bulk`,
            );

            return options;
        } catch (error) {
            this.logger.error(
                `Error creating question options in bulk for user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Get('question/:questionId')
    @ApiOperation({
        summary: '📝 Get Options for Specific Question',
        description: `
      **Retrieves all answer options for a specific question**
      
      This endpoint provides comprehensive option listings:
      - All options within the specified question
      - Correct answer indicators
      - Option statistics and analytics
      - Ordered by creation sequence
      
      **Response Information:**
      - Complete option information
      - Correct answer designation
      - Selection statistics (when available)
      - Question context information
      
      **Authorization:**
      - Question access validation
      - Test ownership verification for full details
      
      **Use Cases:**
      - Question preview and review
      - Option management interfaces
      - Student answer choice display
      - Academic content analysis
      - Answer key generation
    `,
        operationId: 'getOptionsByQuestion',
    })
    @ApiParam({
        name: 'questionId',
        type: Number,
        description: 'Question identifier to retrieve options for',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question options retrieved successfully',
        type: QuestionOptionListResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to the specified question',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question not found',
    })
    async findByQuestion(
        @Param('questionId', ParseIntPipe) questionId: number,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionListResponseDto> {
        try {
            this.logger.log(`Getting options for question ${questionId}`);

            const result = await this.questionsOptionsService.findByQuestion(
                questionId,
                userId,
            );

            this.logger.log(
                `Retrieved ${result.options.length} options for question ${questionId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error getting options for question ${questionId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Question Option Details',
        description: `
      **Retrieves detailed information about a specific question option**
      
      This endpoint provides comprehensive option data including:
      - Complete option information
      - Correct answer status
      - Selection statistics and analytics
      - Question context information
      
      **Detailed Information:**
      - Option text and content
      - Correct answer designation
      - Creation and modification timestamps
      - Associated question information
      - Usage statistics (when available)
      
      **Security:**
      - Option access validation
      - Question ownership verification
      - Proper permission checks
      
      **Use Cases:**
      - Option editing interfaces
      - Detailed option preview
      - Option analytics dashboard
      - Content review and approval
    `,
        operationId: 'getQuestionOptionDetails',
    })
    @ApiParam({
        name: 'id',
        description: 'Question option unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question option details retrieved successfully',
        type: QuestionOptionResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to this question option',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question option not found',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        try {
            this.logger.log(`Getting question option details for ID: ${id}`);

            const option = await this.questionsOptionsService.findOne(
                id,
                userId,
            );

            this.logger.log(`Question option details retrieved for ID: ${id}`);

            return option;
        } catch (error) {
            this.logger.error(
                `Error getting question option ${id}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Question Option',
        description: `
      **Updates question option information with comprehensive validation**
      
      This endpoint allows option owners to update options including:
      - Option text modifications
      - Correct answer status changes
      - Content improvements and corrections
      
      **Updatable Fields:**
      - Option text content
      - Correct answer designation
      - Update timestamp (automatic)
      
      **Security Features:**
      - Only question owners can update options
      - Ownership validation required
      - Input validation and sanitization
      - Change audit logging
      
      **Business Rules:**
      - Cannot change option's question assignment
      - Must maintain at least one correct option per question
      - Option text must remain unique within question
      - Content updates require proper validation
      
      **Use Cases:**
      - Option content improvements
      - Correct answer adjustments
      - Text corrections and updates
      - Content maintenance workflows
    `,
        operationId: 'updateQuestionOption',
    })
    @ApiParam({
        name: 'id',
        description: 'Question option unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiBody({
        type: UpdateQuestionOptionDto,
        description: 'Question option update data',
        examples: {
            'text-update': {
                summary: '📝 Update Option Text',
                description: 'Update just the option text content',
                value: {
                    optionText:
                        'O(log n) - Logarithmic time complexity (average case)',
                },
            },
            'correctness-update': {
                summary: '✅ Update Correct Status',
                description: 'Change the correct answer designation',
                value: {
                    isCorrect: true,
                },
            },
            'full-update': {
                summary: '🔄 Complete Update',
                description: 'Update both text and correct status',
                value: {
                    optionText:
                        'O(log n) - Logarithmic time complexity (best and average case)',
                    isCorrect: true,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question option updated successfully',
        type: QuestionOptionResponseDto,
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
        description: '⛔ Forbidden - No permission to update this option',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question option not found',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateQuestionOptionDto: UpdateQuestionOptionDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        try {
            this.logger.log(
                `Updating question option ${id} for user: ${userId}`,
            );

            const option = await this.questionsOptionsService.update(
                id,
                updateQuestionOptionDto,
                userId,
            );

            this.logger.log(`Question option ${id} updated successfully`);

            return option;
        } catch (error) {
            this.logger.error(
                `Error updating question option ${id} for user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: '🗑️ Delete Question Option',
        description: `
      **Permanently deletes a question option with comprehensive validation**
      
      This endpoint allows option owners to delete options with:
      - Ownership verification
      - Answer dependency checks
      - Data integrity protection
      - Audit trail logging
      
      **Deletion Process:**
      - Validates user ownership of question
      - Checks for existing answer submissions
      - Prevents deletion if answers reference this option
      - Ensures at least one option remains per question
      - Logs deletion for audit purposes
      
      **Safety Features:**
      - Only question owners can delete options
      - Prevents deletion of options with submitted answers
      - Maintains minimum option requirements
      - Confirms deletion before execution
      - Maintains referential integrity
      
      **Important Notes:**
      - **This action is irreversible**
      - All option data will be permanently deleted
      - Associated answer references may be affected
      - Consider archiving instead of deletion
      
      **Use Cases:**
      - Option cleanup and maintenance
      - Removing incorrect or outdated options
      - Question content management
      - Option lifecycle management
    `,
        operationId: 'deleteQuestionOption',
    })
    @ApiParam({
        name: 'id',
        description: 'Question option unique identifier',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '✅ Question option deleted successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description:
            '❌ Cannot delete option that has submitted answers or is the last option',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No permission to delete this option',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question option not found',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('id') userId: string,
    ): Promise<void> {
        try {
            this.logger.log(
                `Deleting question option ${id} for user: ${userId}`,
            );

            await this.questionsOptionsService.remove(id, userId);

            this.logger.log(`Question option ${id} deleted successfully`);
        } catch (error) {
            this.logger.error(
                `Error deleting question option ${id} for user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }
}
