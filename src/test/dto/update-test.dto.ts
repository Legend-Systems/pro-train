import { PartialType, OmitType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { CreateTestDto } from './create-test.dto';
import { TestType } from '../entities/test.entity';

/**
 * Data Transfer Object for updating an existing test
 * Extends CreateTestDto but excludes courseId (tests cannot be moved between courses)
 */
export class UpdateTestDto extends PartialType(
    OmitType(CreateTestDto, ['courseId'] as const),
) {
    @ApiProperty({
        description: 'Updated test title for identification and display',
        example: 'Final Exam - Computer Science Fundamentals (Updated)',
        required: false,
        type: String,
        title: 'Test Title',
        maxLength: 255,
        minLength: 3,
    })
    title?: string;

    @ApiProperty({
        description:
            'Updated test description and instructions for students taking the test',
        example:
            'This final exam covers all course material. You have 3 hours to complete all questions.',
        required: false,
        type: String,
        title: 'Test Description',
    })
    description?: string;

    @ApiProperty({
        description:
            'Updated test type determining behavior and purpose (use with caution)',
        example: TestType.EXAM,
        required: false,
        enum: TestType,
        title: 'Test Type',
    })
    testType?: TestType;

    @ApiProperty({
        description:
            'Updated test duration in minutes (set to null for untimed tests)',
        example: 180,
        required: false,
        type: Number,
        title: 'Duration (Minutes)',
        minimum: 1,
    })
    durationMinutes?: number;

    @ApiProperty({
        description: 'Updated maximum number of attempts allowed per user',
        example: 2,
        required: false,
        type: Number,
        title: 'Maximum Attempts',
        minimum: 1,
    })
    maxAttempts?: number;
}
