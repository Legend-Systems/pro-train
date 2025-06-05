import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min } from 'class-validator';

/**
 * Data Transfer Object for creating a new test attempt
 * Used when a student starts taking a test
 */
export class CreateTestAttemptDto {
    @ApiProperty({
        description:
            'Test ID to start an attempt for - must be an active test that the user has access to',
        example: 1,
        type: Number,
        title: 'Test ID',
        minimum: 1,
        examples: {
            'quiz-attempt': {
                summary: 'Start Quiz Attempt',
                description: 'Start an attempt for a quiz',
                value: 5,
            },
            'exam-attempt': {
                summary: 'Start Exam Attempt',
                description: 'Start an attempt for a formal exam',
                value: 10,
            },
            'training-attempt': {
                summary: 'Start Training Attempt',
                description: 'Start an attempt for a training module',
                value: 15,
            },
        },
    })
    @IsNumber({}, { message: 'Test ID must be a valid number' })
    @IsNotEmpty({ message: 'Test ID is required' })
    @Min(1, { message: 'Test ID must be at least 1' })
    testId: number;
}
