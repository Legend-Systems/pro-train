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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { TrainingProgressService } from './training_progress.service';
import { CreateTrainingProgressDto } from './dto/create-training_progress.dto';
import { UpdateTrainingProgressDto } from './dto/update-training_progress.dto';
import { TrainingProgressResponseDto } from './dto/training-progress-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Training Progress')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('training-progress')
export class TrainingProgressController {
    constructor(
        private readonly trainingProgressService: TrainingProgressService,
    ) {}

    @Get('user/:userId')
    @ApiOperation({ summary: 'Get user training progress' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by course ID',
    })
    @ApiResponse({
        status: 200,
        description: 'User training progress retrieved successfully',
        type: [TrainingProgressResponseDto],
    })
    async getUserProgress(
        @Param('userId') userId: string,
        @Query('courseId', new ParseIntPipe({ optional: true }))
        courseId?: number,
    ): Promise<TrainingProgressResponseDto[]> {
        return this.trainingProgressService.getUserProgress(userId, courseId);
    }

    @Post('update')
    @ApiOperation({ summary: 'Update training progress' })
    @ApiResponse({
        status: 201,
        description: 'Training progress updated successfully',
        type: TrainingProgressResponseDto,
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
        return this.trainingProgressService.updateProgress(
            body.userId,
            body.courseId,
            body.testId,
            body.updateData,
        );
    }

    @Get('course/:courseId')
    @ApiOperation({ summary: 'Get course training progress' })
    @ApiParam({ name: 'courseId', description: 'Course ID' })
    @ApiQuery({
        name: 'userId',
        required: false,
        description: 'Filter by user ID',
    })
    @ApiResponse({
        status: 200,
        description: 'Course training progress retrieved successfully',
        type: [TrainingProgressResponseDto],
    })
    async getCourseProgress(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query('userId') userId?: string,
    ): Promise<TrainingProgressResponseDto[]> {
        return this.trainingProgressService.getCourseProgress(courseId, userId);
    }

    @Get('completion/:userId/:courseId')
    @ApiOperation({ summary: 'Calculate completion for user and course' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiParam({ name: 'courseId', description: 'Course ID' })
    @ApiResponse({
        status: 200,
        description: 'Completion calculated successfully',
        schema: {
            type: 'object',
            properties: {
                overallCompletion: { type: 'number' },
                testCompletions: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            testId: { type: 'number' },
                            testTitle: { type: 'string' },
                            completionPercentage: { type: 'number' },
                            questionsCompleted: { type: 'number' },
                            totalQuestions: { type: 'number' },
                            timeSpentMinutes: { type: 'number' },
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
        return this.trainingProgressService.calculateCompletion(
            userId,
            courseId,
        );
    }

    @Get('stats/:userId')
    @ApiOperation({ summary: 'Get user progress statistics' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiQuery({
        name: 'courseId',
        required: false,
        description: 'Filter by course ID',
    })
    @ApiResponse({
        status: 200,
        description: 'Progress statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                totalTimeSpent: { type: 'number' },
                totalQuestionsCompleted: { type: 'number' },
                averageCompletion: { type: 'number' },
                coursesInProgress: { type: 'number' },
                testsCompleted: { type: 'number' },
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
        return this.trainingProgressService.getProgressStats(userId, courseId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get training progress by ID' })
    @ApiParam({ name: 'id', description: 'Training progress ID' })
    @ApiResponse({
        status: 200,
        description: 'Training progress retrieved successfully',
        type: TrainingProgressResponseDto,
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<TrainingProgressResponseDto> {
        return this.trainingProgressService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update training progress by ID' })
    @ApiParam({ name: 'id', description: 'Training progress ID' })
    @ApiResponse({
        status: 200,
        description: 'Training progress updated successfully',
        type: TrainingProgressResponseDto,
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateTrainingProgressDto: UpdateTrainingProgressDto,
    ): Promise<TrainingProgressResponseDto> {
        return this.trainingProgressService.update(
            id,
            updateTrainingProgressDto,
        );
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete training progress by ID' })
    @ApiParam({ name: 'id', description: 'Training progress ID' })
    @ApiResponse({
        status: 200,
        description: 'Training progress deleted successfully',
    })
    async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.trainingProgressService.remove(id);
    }
}
