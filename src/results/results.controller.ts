import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    UseGuards,
    ParseIntPipe,
    BadRequestException,
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
} from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { ResultResponseDto } from './dto/result-response.dto';
import { ResultFilterDto } from './dto/result-filter.dto';
import { ResultAnalyticsDto } from './dto/result-analytics.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../user/entities/user.entity';

@ApiTags('results')
@Controller('results')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ResultsController {
    constructor(private readonly resultsService: ResultsService) {}

    @Post('create-from-attempt/:attemptId')
    @ApiOperation({
        summary: 'Create result from completed test attempt',
        description:
            'Automatically creates a result by calculating scores from a completed test attempt',
    })
    @ApiParam({
        name: 'attemptId',
        description: 'Test attempt ID to create result from',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 201,
        description: 'Result created successfully',
        type: ResultResponseDto,
    })
    @ApiNotFoundResponse({
        description: 'Test attempt not found',
    })
    @ApiBadRequestResponse({
        description: 'Attempt not completed or result already exists',
    })
    async createFromAttempt(
        @Param('attemptId', ParseIntPipe) attemptId: number,
        @GetUser() user: User,
    ): Promise<ResultResponseDto> {
        if (!attemptId || attemptId <= 0) {
            throw new BadRequestException('Invalid attempt ID');
        }

        return this.resultsService.createFromAttempt(attemptId);
    }

    @Get('my-results')
    @ApiOperation({
        summary: 'Get current user results',
        description:
            'Retrieve all test results for the authenticated user with pagination and filtering',
    })
    @ApiResponse({
        status: 200,
        description: 'User results retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                results: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ResultResponseDto' },
                },
                total: { type: 'number', example: 50 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
            },
        },
    })
    async getMyResults(
        @GetUser() user: User,
        @Query() filterDto: ResultFilterDto,
    ) {
        return this.resultsService.findUserResults(user.id, filterDto);
    }

    @Get('test/:testId')
    @ApiOperation({
        summary: 'Get results for a specific test',
        description:
            'Retrieve all results for a specific test (instructor access)',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to get results for',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Test results retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                results: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ResultResponseDto' },
                },
                total: { type: 'number', example: 25 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
            },
        },
    })
    @ApiForbiddenResponse({
        description: 'Access denied - not test instructor',
    })
    async getTestResults(
        @Param('testId', ParseIntPipe) testId: number,
        @GetUser() user: User,
        @Query() filterDto: ResultFilterDto,
    ) {
        if (!testId || testId <= 0) {
            throw new BadRequestException('Invalid test ID');
        }

        return this.resultsService.findTestResults(testId, user.id, filterDto);
    }

    @Get('course/:courseId')
    @ApiOperation({
        summary: 'Get results for a specific course',
        description:
            'Retrieve all results for a specific course (instructor access)',
    })
    @ApiParam({
        name: 'courseId',
        description: 'Course ID to get results for',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Course results retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                results: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ResultResponseDto' },
                },
                total: { type: 'number', example: 100 },
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
            },
        },
    })
    @ApiForbiddenResponse({
        description: 'Access denied - not course instructor',
    })
    async getCourseResults(
        @Param('courseId', ParseIntPipe) courseId: number,
        @GetUser() user: User,
        @Query() filterDto: ResultFilterDto,
    ) {
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
        summary: 'Get test analytics',
        description:
            'Get comprehensive analytics and statistics for a specific test',
    })
    @ApiParam({
        name: 'testId',
        description: 'Test ID to get analytics for',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Test analytics retrieved successfully',
        type: ResultAnalyticsDto,
    })
    @ApiNotFoundResponse({
        description: 'Test not found',
    })
    @ApiForbiddenResponse({
        description: 'Access denied - not test instructor',
    })
    async getTestAnalytics(
        @Param('testId', ParseIntPipe) testId: number,
        @GetUser() user: User,
    ): Promise<ResultAnalyticsDto> {
        if (!testId || testId <= 0) {
            throw new BadRequestException('Invalid test ID');
        }

        return this.resultsService.getTestAnalytics(testId, user.id);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Get result by ID',
        description: 'Retrieve a specific result by its ID',
    })
    @ApiParam({
        name: 'id',
        description: 'Result ID',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Result retrieved successfully',
        type: ResultResponseDto,
    })
    @ApiNotFoundResponse({
        description: 'Result not found',
    })
    @ApiForbiddenResponse({
        description: 'Access denied to this result',
    })
    async getResult(
        @Param('id', ParseIntPipe) id: number,
        @GetUser() user: User,
    ): Promise<ResultResponseDto> {
        if (!id || id <= 0) {
            throw new BadRequestException('Invalid result ID');
        }

        return this.resultsService.findOne(id, user.id);
    }

    @Post(':id/recalculate')
    @ApiOperation({
        summary: 'Recalculate result',
        description:
            'Recalculate the score and percentage for a specific result',
    })
    @ApiParam({
        name: 'id',
        description: 'Result ID to recalculate',
        type: 'number',
        example: 1,
    })
    @ApiResponse({
        status: 200,
        description: 'Result recalculated successfully',
        type: ResultResponseDto,
    })
    @ApiNotFoundResponse({
        description: 'Result not found',
    })
    @ApiForbiddenResponse({
        description: 'Access denied - not authorized to recalculate',
    })
    async recalculateResult(
        @Param('id', ParseIntPipe) id: number,
        @GetUser() user: User,
    ): Promise<ResultResponseDto> {
        if (!id || id <= 0) {
            throw new BadRequestException('Invalid result ID');
        }

        return this.resultsService.recalculateResult(id, user.id);
    }
}
