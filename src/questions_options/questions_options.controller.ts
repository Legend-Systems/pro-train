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
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { QuestionsOptionsService } from './questions_options.service';
import { CreateQuestionOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionOptionDto } from './dto/update-questions_option.dto';
import { QuestionOptionResponseDto } from './dto/question-option-response.dto';
import { QuestionOptionListResponseDto } from './dto/question-option-list-response.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';
import { StandardOperationResponse } from '../user/dto/common-response.dto';

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
        @OrgBranchScope() scope: OrgBranchScope,
        @GetUser('id') userId: string,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating option for question ${createQuestionOptionDto.questionId} by user: ${userId}`,
            );

            const result = await this.questionsOptionsService.create(
                createQuestionOptionDto,
                scope,
                userId,
            );

            this.logger.log(`Question option created successfully`);

            return result;
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
      - Each option must have valid text content
      - At least one correct option required
      - Maximum option limit per question enforced
      
      **Authorization Requirements:**
      - Must be the owner of the test containing the question
      - Valid JWT authentication required
      
      **Use Cases:**
      - Quick setup of multiple choice questions
      - Import question options from templates
      - Batch creation for quiz preparation
      - Efficient test construction workflows
    `,
        operationId: 'createBulkQuestionOptions',
    })
    @ApiBody({
        type: BulkCreateOptionsDto,
        description: 'Bulk option creation data',
        examples: {
            'multiple-choice': {
                summary: '🎯 Multiple Choice Options Set',
                description:
                    'Create complete set of options for a multiple choice question',
                value: {
                    questionId: 1,
                    options: [
                        {
                            optionText: 'Variable declaration',
                            isCorrect: false,
                        },
                        {
                            optionText: 'Function definition',
                            isCorrect: true,
                        },
                        {
                            optionText: 'Class instantiation',
                            isCorrect: false,
                        },
                        {
                            optionText: 'Module import',
                            isCorrect: false,
                        },
                    ],
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Question options created successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid bulk creation data',
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
    async createBulk(
        @Body() bulkCreateDto: BulkCreateOptionsDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @GetUser('id') userId: string,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Creating ${bulkCreateDto.options.length} options for question ${bulkCreateDto.questionId} by user: ${userId}`,
            );

            const result = await this.questionsOptionsService.createBulk(
                bulkCreateDto,
                scope,
                userId,
            );

            this.logger.log(`Question options created successfully in bulk`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error creating bulk question options for user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Get('question/:questionId')
    @ApiOperation({
        summary: '📝 Get Options for Question',
        description: `
      **Retrieve all answer options for a specific question**
      
      This endpoint returns all options configured for a question including:
      - Option text and content
      - Correct answer indicators (filtered for students)
      - Option ordering and metadata
      - Complete option details for creators
      
      **Data Filtering:**
      - Correct answer status hidden from students during active tests
      - Full details available to test creators
      - Proper ordering maintained
      - Active options only returned
      
      **Authorization Requirements:**
      - Must have access to the question (student or creator)
      - Valid JWT authentication required
      
      **Use Cases:**
      - Displaying question options to test takers
      - Reviewing question setup for creators
      - Option management interfaces
      - Test preview functionality
    `,
        operationId: 'getQuestionOptions',
    })
    @ApiParam({
        name: 'questionId',
        description: 'ID of the question to get options for',
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
        @OrgBranchScope() scope: OrgBranchScope,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionListResponseDto> {
        try {
            this.logger.log(
                `Fetching options for question ${questionId} by user: ${userId}`,
            );

            const result = await this.questionsOptionsService.findByQuestion(
                questionId,
                scope,
                userId,
            );

            this.logger.log(
                `Retrieved ${result.options.length} options for question ${questionId}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error fetching options for question ${questionId} by user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Get(':id')
    @ApiOperation({
        summary: '🔍 Get Question Option Details',
        description: `
      **Retrieve detailed information about a specific question option**
      
      This endpoint returns comprehensive details for a single option including:
      - Option text and content
      - Correct answer status (filtered appropriately)
      - Creation and modification metadata
      - Related question information
      
      **Data Access Rules:**
      - Test creators see all option details
      - Students see filtered information based on test status
      - Correct answer status controlled by context
      - Metadata available for authorized users
      
      **Authorization Requirements:**
      - Must have access to the question containing the option
      - Valid JWT authentication required
      
      **Use Cases:**
      - Option editing interfaces for creators
      - Detailed option review and validation
      - Option-specific metadata access
      - Debugging and administration
    `,
        operationId: 'getQuestionOption',
    })
    @ApiParam({
        name: 'id',
        description: 'ID of the question option to retrieve',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question option retrieved successfully',
        type: QuestionOptionResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to this option',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question option not found',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        try {
            this.logger.log(
                `Fetching question option ${id} by user: ${userId}`,
            );

            const option = await this.questionsOptionsService.findOne(
                id,
                scope,
                userId,
            );

            this.logger.log(`Question option ${id} retrieved successfully`);

            return option;
        } catch (error) {
            this.logger.error(
                `Error fetching question option ${id} by user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Question Option',
        description: `
      **Update an existing question option with new information**
      
      This endpoint allows test creators to modify question options including:
      - Option text and content updates
      - Correct answer status changes
      - Option metadata modifications
      - Validation and consistency checks
      
      **Update Capabilities:**
      - Modify option text content
      - Change correct answer designation
      - Update option ordering
      - Preserve option relationships
      
      **Business Rules:**
      - Only test creators can update options
      - At least one correct option must remain per question
      - Option text cannot be empty
      - Changes validated for consistency
      
      **Authorization Requirements:**
      - Must be the owner of the test containing the question
      - Valid JWT authentication required
      
      **Use Cases:**
      - Correcting option text errors
      - Adjusting correct answer designations
      - Improving option clarity and accuracy
      - Maintaining question quality
    `,
        operationId: 'updateQuestionOption',
    })
    @ApiParam({
        name: 'id',
        description: 'ID of the question option to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateQuestionOptionDto,
        description: 'Question option update data',
        examples: {
            'text-update': {
                summary: '📝 Update Option Text',
                description: 'Modify the text content of an option',
                value: {
                    optionText: 'Updated option text with better clarity',
                },
            },
            'correctness-change': {
                summary: '✅ Change Correct Answer',
                description: 'Update the correct answer designation',
                value: {
                    isCorrect: true,
                },
            },
            'complete-update': {
                summary: '🔄 Complete Option Update',
                description: 'Update both text and correctness',
                value: {
                    optionText: 'Completely revised option text',
                    isCorrect: false,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Question option updated successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid update data or validation errors',
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '⛔ Forbidden - No access to update this option',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question option not found',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateQuestionOptionDto: UpdateQuestionOptionDto,
        @OrgBranchScope() scope: OrgBranchScope,
        @GetUser('id') userId: string,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Updating question option ${id} by user: ${userId}`,
            );

            const result = await this.questionsOptionsService.update(
                id,
                updateQuestionOptionDto,
                scope,
                userId,
            );

            this.logger.log(`Question option ${id} updated successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error updating question option ${id} by user ${userId}:`,
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
      **Permanently delete a question option**
      
      This endpoint allows test creators to remove question options including:
      - Complete option removal from the question
      - Validation for minimum option requirements
      - Cascade handling for related data
      - Immediate effect on question structure
      
      **Deletion Rules:**
      - Only test creators can delete options
      - Must maintain minimum number of options per question
      - At least one correct option must remain
      - Cannot delete if option is referenced in active attempts
      
      **Safety Measures:**
      - Validation before deletion
      - Transaction-based removal
      - Related data cleanup
      - Audit trail maintenance
      
      **Authorization Requirements:**
      - Must be the owner of the test containing the question
      - Valid JWT authentication required
      
      **Use Cases:**
      - Removing incorrect or redundant options
      - Simplifying question structure
      - Quality improvement of questions
      - Test maintenance and cleanup
    `,
        operationId: 'deleteQuestionOption',
    })
    @ApiParam({
        name: 'id',
        description: 'ID of the question option to delete',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '✅ Question option deleted successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot delete option - validation failed',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'string',
                    example: 'Cannot delete last correct option for question',
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
        description: '⛔ Forbidden - No access to delete this option',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ Question option not found',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @OrgBranchScope() scope: OrgBranchScope,
        @GetUser('id') userId: string,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(
                `Deleting question option ${id} by user: ${userId}`,
            );

            const result = await this.questionsOptionsService.remove(
                id,
                scope,
                userId,
            );

            this.logger.log(`Question option ${id} deleted successfully`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error deleting question option ${id} by user ${userId}:`,
                error instanceof Error ? error.message : String(error),
            );
            throw error;
        }
    }
}
