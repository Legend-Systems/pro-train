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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { QuestionsOptionsService } from './questions_options.service';
import { CreateQuestionOptionDto } from './dto/create-questions_option.dto';
import { UpdateQuestionOptionDto } from './dto/update-questions_option.dto';
import { QuestionOptionResponseDto } from './dto/question-option-response.dto';
import { QuestionOptionListResponseDto } from './dto/question-option-list-response.dto';
import { BulkCreateOptionsDto } from './dto/bulk-create-options.dto';

@ApiTags('Question Options')
@Controller('question-options')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuestionsOptionsController {
    constructor(
        private readonly questionsOptionsService: QuestionsOptionsService,
    ) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a new question option',
        description:
            'Create a new option for a question. User must have access to the question.',
    })
    @ApiResponse({
        status: 201,
        description: 'Question option created successfully',
        type: QuestionOptionResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data or validation errors',
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
    async create(
        @Body() createQuestionOptionDto: CreateQuestionOptionDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        return this.questionsOptionsService.create(
            createQuestionOptionDto,
            userId,
        );
    }

    @Post('bulk')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create multiple question options in bulk',
        description:
            'Create multiple options for a question in a single operation.',
    })
    @ApiResponse({
        status: 201,
        description: 'Question options created successfully',
        type: [QuestionOptionResponseDto],
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data or validation errors',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to access this question',
    })
    async createBulk(
        @Body() bulkCreateDto: BulkCreateOptionsDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto[]> {
        return this.questionsOptionsService.createBulk(bulkCreateDto, userId);
    }

    @Get('question/:questionId')
    @ApiOperation({
        summary: 'Get options for a specific question',
        description: 'Retrieve all options for a question.',
    })
    @ApiParam({
        name: 'questionId',
        description: 'Question ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Question options retrieved successfully',
        type: QuestionOptionListResponseDto,
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
    async findByQuestion(
        @Param('questionId', ParseIntPipe) questionId: number,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionListResponseDto> {
        return this.questionsOptionsService.findByQuestion(questionId, userId);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get a specific question option',
        description: 'Retrieve details of a specific question option by ID.',
    })
    @ApiParam({
        name: 'id',
        description: 'Question option ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Question option retrieved successfully',
        type: QuestionOptionResponseDto,
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to access this option',
    })
    @ApiResponse({
        status: 404,
        description: 'Question option not found',
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        return this.questionsOptionsService.findOne(id, userId);
    }

    @Put(':id')
    @ApiOperation({
        summary: 'Update a question option',
        description:
            'Update details of an existing question option. User must have access to the question.',
    })
    @ApiParam({
        name: 'id',
        description: 'Question option ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Question option updated successfully',
        type: QuestionOptionResponseDto,
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data or validation errors',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to update this option',
    })
    @ApiResponse({
        status: 404,
        description: 'Question option not found',
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateQuestionOptionDto: UpdateQuestionOptionDto,
        @GetUser('id') userId: string,
    ): Promise<QuestionOptionResponseDto> {
        return this.questionsOptionsService.update(
            id,
            updateQuestionOptionDto,
            userId,
        );
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: 'Delete a question option',
        description:
            'Delete a question option. Option cannot be deleted if it has answers.',
    })
    @ApiParam({
        name: 'id',
        description: 'Question option ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 204,
        description: 'Question option deleted successfully',
    })
    @ApiResponse({
        status: 400,
        description: 'Cannot delete option that has answers',
    })
    @ApiResponse({
        status: 403,
        description:
            'Access denied - user does not have permission to delete this option',
    })
    @ApiResponse({
        status: 404,
        description: 'Question option not found',
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @GetUser('id') userId: string,
    ): Promise<void> {
        return this.questionsOptionsService.remove(id, userId);
    }
}
