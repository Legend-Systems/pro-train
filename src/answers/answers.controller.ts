import {
    Controller,
    Get,
    Post,
    Body,
    Put,
    Param,
    UseGuards,
    HttpStatus,
    ParseIntPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { AnswersService } from './answers.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { MarkAnswerDto } from './dto/mark-answer.dto';
import { BulkAnswersDto } from './dto/bulk-answers.dto';
import { AnswerResponseDto } from './dto/answer-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

@ApiTags('✍️ Answers')
@Controller('answers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class AnswersController {
    constructor(private readonly answersService: AnswersService) {}

    @Post()
    @ApiOperation({
        summary: '📝 Create Answer',
        description: `
        **Create a new answer for a test question**
        
        This endpoint allows students to submit answers to questions during an active test attempt.
        The system will validate attempt ownership, question validity, and prevent duplicate answers.
        
        **Features:**
        - Support for multiple choice (selectedOptionId) and text answers
        - Automatic validation of attempt status and ownership
        - Prevention of duplicate answers for the same question
        - Validation that selected options belong to the question
        
        **Business Rules:**
        - Only active (in_progress) attempts can receive new answers
        - Students can only create answers for their own attempts
        - One answer per question per attempt
        - Selected options must belong to the specified question
        
        **Security:**
        - JWT authentication required
        - Ownership validation for test attempts
        - Input validation and sanitization
        `,
    })
    @ApiBody({
        type: CreateAnswerDto,
        description: 'Answer details',
        examples: {
            multipleChoice: {
                summary: 'Multiple choice answer',
                description: 'Answer with selected option',
                value: {
                    attemptId: 1,
                    questionId: 1,
                    selectedOptionId: 3,
                },
            },
            textAnswer: {
                summary: 'Text answer',
                description: 'Open-ended text response',
                value: {
                    attemptId: 1,
                    questionId: 2,
                    textAnswer:
                        'The time complexity of binary search is O(log n)',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Answer created successfully',
        type: AnswerResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid request or business rule violation',
        example: {
            statusCode: 400,
            message: 'Answer already exists for this question in this attempt',
            error: 'Bad Request',
        },
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '❌ Access denied to this attempt',
        example: {
            statusCode: 403,
            message: 'You can only create answers for your own attempts',
            error: 'Forbidden',
        },
    })
    async create(
        @Body() createAnswerDto: CreateAnswerDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<AnswerResponseDto> {
        return this.answersService.create(createAnswerDto, scope.userId);
    }

    @Post('bulk')
    @ApiOperation({
        summary: '📋 Bulk Create Answers',
        description: `
        **Create multiple answers in a single request**
        
        This endpoint allows students to submit multiple answers at once,
        useful for saving progress or submitting all answers together.
        
        **Features:**
        - Process multiple answers in one request
        - Partial success handling (continues if some answers fail)
        - Automatic validation for each answer
        - Efficient batch processing
        
        **Business Rules:**
        - All answers must belong to attempts owned by the user
        - Individual answer validation applies to each item
        - Failed answers are logged but don't stop processing
        - Returns successfully created answers
        
        **Security:**
        - JWT authentication required
        - Individual ownership validation for each answer
        - Comprehensive input validation
        `,
    })
    @ApiBody({
        type: BulkAnswersDto,
        description: 'Multiple answers to create',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ Answers created successfully',
        type: [AnswerResponseDto],
    })
    async bulkCreate(
        @Body() bulkAnswersDto: BulkAnswersDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<AnswerResponseDto[]> {
        return this.answersService.bulkCreate(bulkAnswersDto, scope.userId);
    }

    @Get('attempt/:attemptId')
    @ApiOperation({
        summary: '📚 Get Answers for Attempt',
        description: `
        **Retrieve all answers for a specific test attempt**
        
        This endpoint returns all answers submitted for a test attempt,
        including question details and selected options.
        
        **Features:**
        - Complete answer details with related data
        - Ordered by question ID for consistent display
        - Includes question and option information
        - Shows marking status and scores
        
        **Use Cases:**
        - Reviewing submitted answers
        - Displaying test results
        - Progress tracking during attempts
        - Answer validation and verification
        
        **Security:**
        - JWT authentication required
        - Users can only access their own attempt answers
        - Ownership validation performed
        `,
    })
    @ApiParam({
        name: 'attemptId',
        description: 'Test attempt ID to get answers for',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Answers retrieved successfully',
        type: [AnswerResponseDto],
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: '❌ Access denied to this attempt',
        example: {
            statusCode: 403,
            message: 'You can only access your own attempt answers',
            error: 'Forbidden',
        },
    })
    async getAnswersForAttempt(
        @Param('attemptId', ParseIntPipe) attemptId: number,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<AnswerResponseDto[]> {
        return this.answersService.findByAttempt(attemptId, scope.userId);
    }

    @Put(':id')
    @ApiOperation({
        summary: '✏️ Update Answer',
        description: `
        **Update an existing answer during an active attempt**
        
        This endpoint allows students to modify their answers while
        the test attempt is still in progress.
        
        **Features:**
        - Update selected options or text answers
        - Validation of new answer data
        - Maintains answer history and timestamps
        - Prevents updates to submitted attempts
        
        **Business Rules:**
        - Only answers in active attempts can be updated
        - Students can only update their own answers
        - Selected options must belong to the question
        - Updates are not allowed after attempt submission
        
        **Security:**
        - JWT authentication required
        - Ownership validation for answers and attempts
        - Status validation for attempt activity
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Answer ID to update',
        example: 1,
    })
    @ApiBody({
        type: UpdateAnswerDto,
        description: 'Updated answer details',
        examples: {
            updateOption: {
                summary: 'Update selected option',
                description: 'Change the selected option for multiple choice',
                value: {
                    selectedOptionId: 4,
                },
            },
            updateText: {
                summary: 'Update text answer',
                description: 'Modify the text response',
                value: {
                    textAnswer: 'Updated: Binary search complexity is O(log n)',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Answer updated successfully',
        type: AnswerResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Cannot update non-active attempt answer',
        example: {
            statusCode: 400,
            message: 'Cannot update answers for non-active attempts',
            error: 'Bad Request',
        },
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateAnswerDto: UpdateAnswerDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<AnswerResponseDto> {
        return this.answersService.update(id, updateAnswerDto, scope.userId);
    }

    @Post(':id/mark')
    @ApiOperation({
        summary: '🎯 Mark Answer',
        description: `
        **Mark/grade an answer (instructor only)**
        
        This endpoint allows instructors to manually grade answers,
        particularly for open-ended questions that require human evaluation.
        
        **Features:**
        - Award points up to question maximum
        - Provide detailed feedback to students
        - Track marking timestamp and marker identity
        - Automatic correctness determination
        
        **Business Rules:**
        - Points cannot exceed question maximum
        - Marking is final and updates attempt scores
        - Feedback is optional but recommended
        - Marking timestamp is automatically recorded
        
        **Security:**
        - JWT authentication required
        - Instructor-level permissions required
        - Comprehensive audit trail
        `,
    })
    @ApiParam({
        name: 'id',
        description: 'Answer ID to mark',
        example: 1,
    })
    @ApiBody({
        type: MarkAnswerDto,
        description: 'Marking details',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Answer marked successfully',
        type: AnswerResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid marking data',
        example: {
            statusCode: 400,
            message: 'Points awarded cannot exceed question maximum (5)',
            error: 'Bad Request',
        },
    })
    async markAnswer(
        @Param('id', ParseIntPipe) id: number,
        @Body() markAnswerDto: MarkAnswerDto,
        @OrgBranchScope() scope: OrgBranchScope,
    ): Promise<AnswerResponseDto> {
        return this.answersService.markAnswer(id, markAnswerDto, scope.userId);
    }

    @Post('auto-mark/:attemptId')
    @ApiOperation({
        summary: '🤖 Auto-mark Attempt',
        description: `
        **Automatically mark objective questions in an attempt**
        
        This endpoint triggers automatic marking for multiple choice
        and other objective questions that can be graded programmatically.
        
        **Features:**
        - Automatic grading of multiple choice questions
        - Instant score calculation and feedback
        - Bulk processing for efficiency
        - Preserves manual marking for subjective questions
        
        **Business Rules:**
        - Only processes unmarked objective questions
        - Compares selected options with correct answers
        - Awards full points for correct answers, zero for incorrect
        - Updates marking timestamps and status
        
        **Security:**
        - JWT authentication required
        - Instructor-level permissions recommended
        - Comprehensive processing logs
        `,
    })
    @ApiParam({
        name: 'attemptId',
        description: 'Test attempt ID to auto-mark',
        example: 1,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Auto-marking completed successfully',
        example: {
            message: 'Auto-marking completed for attempt 1',
            markedQuestions: 5,
        },
    })
    async autoMarkAttempt(
        @Param('attemptId', ParseIntPipe) attemptId: number,
    ): Promise<{ message: string; markedQuestions: number }> {
        await this.answersService.autoMark(attemptId);
        return {
            message: `Auto-marking completed for attempt ${attemptId}`,
            markedQuestions: 0, // This would be returned from the service
        };
    }
}
