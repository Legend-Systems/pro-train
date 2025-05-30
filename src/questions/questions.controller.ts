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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { QuestionFilterDto } from './dto/question-filter.dto';
import { QuestionResponseDto } from './dto/question-response.dto';
import { QuestionListResponseDto } from './dto/question-list-response.dto';
import { BulkCreateQuestionsDto } from './dto/bulk-create-questions.dto';

@ApiTags('Questions')
@Controller('questions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuestionsController {
    constructor(private readonly questionsService: QuestionsService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a new question',
        description:
            'Create a new question for a test. User must have access to the test.',
    })
    @ApiResponse({
        status: 201,
        description: 'Question created successfully',
        type: QuestionResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data or validation errors',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to access this test',
    })
    @ApiResponse({
        status: 404,
        description: 'Test not found',
    })
    @ApiResponse({
        status: 409,
        description: 'Question with this order index already exists',
    })
    async create(
        @Body() createQuestionDto: CreateQuestionDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionResponseDto> {
        return this.questionsService.create(createQuestionDto, userId);
    }

    @Post('bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create multiple questions in bulk',
        description:
            'Create multiple questions for tests in a single operation. User must have access to all tests.',
    })
    @ApiResponse({
        status: 201,
        description: 'Questions created successfully',
        type: [QuestionResponseDto],
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data or validation errors',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to access one or more tests',
    })
    async createBulk(
        @Body() bulkCreateDto: BulkCreateQuestionsDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionResponseDto[]> {
        return this.questionsService.createBulk(bulkCreateDto, userId);
    }

    @Get('test/:testId')
    @ApiOperation({
        summary: 'Get questions for a specific test',
        description:
            'Retrieve all questions for a test with optional filtering and pagination.',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Questions retrieved successfully',
        type: QuestionListResponseDto,
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to access this test',
    })
    @ApiResponse({
        status: 404,
        description: 'Test not found',
    })
    async findByTest(
        @Param('testId', ParseIntPipe) testId: number,
        @Query() filters: QuestionFilterDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionListResponseDto> {
        return this.questionsService.findByTest(testId, userId, filters);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get a specific question',
        description: 'Retrieve details of a specific question by ID.',
    })
    @ApiParam({
        name: 'id',
        description: 'Question ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Question retrieved successfully',
        type: QuestionResponseDto,
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to access this question',
    })
    @ApiResponse({
        status: 404,
        description: 'Question not found',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('id') userId: string,
    ): Promise<QuestionResponseDto> {
        return this.questionsService.findOne(id, userId);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Update a question',
        description:
            'Update details of an existing question. User must have access to the test.',
    })
    @ApiParam({
        name: 'id',
        description: 'Question ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Question updated successfully',
        type: QuestionResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data or validation errors',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to update this question',
    })
    @ApiResponse({
        status: 404,
        description: 'Question not found',
    })
    @ApiResponse({
        status: 409,
        description: 'Question with this order index already exists',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateQuestionDto: UpdateQuestionDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionResponseDto> {
        return this.questionsService.update(id, updateQuestionDto, userId);
    }

    @Patch('reorder')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Reorder questions in a test',
        description:
            'Reorder questions within a test by updating their order indices.',
    })
    @ApiResponse({
        status: 204,
        description: 'Questions reordered successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid reorder data',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to modify this test',
    })
    async reorder(
        @Body()
        reorderData: {
            testId: number;
            questions: { questionId: number; newOrderIndex: number }[];
        },
        @GetUser('id') userId: string,
    ): Promise<void> {
        return this.questionsService.reorder(
            reorderData.testId,
            reorderData.questions,
            userId,
        );
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete a question',
        description:
            'Delete a question from a test. Question cannot be deleted if it has answers.',
    })
    @ApiParam({
        name: 'id',
        description: 'Question ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 204,
        description: 'Question deleted successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Cannot delete question that has answers',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to delete this question',
    })
    @ApiResponse({
        status: 404,
        description: 'Question not found',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('id') userId: string,
    ): Promise<void> {
        return this.questionsService.remove(id, userId);
    }
}
