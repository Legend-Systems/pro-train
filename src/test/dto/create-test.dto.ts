import {
    IsNumber,
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    Min,
    MinLength,
    IsArray,
    ValidateNested,
    IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TestType } from '../entities/test.entity';
import { QuestionType } from '../../questions/entities/question.entity';

/**
 * DTO for creating question options within a test creation request
 */
export class CreateTestQuestionOptionDto {
    @ApiProperty({
        description: 'The option text/content',
        example: 'O(log n) - Logarithmic time complexity',
    })
    @IsString({ message: 'Option text must be a string' })
    @IsNotEmpty({ message: 'Option text is required' })
    optionText: string;

    @ApiProperty({
        description: 'Whether this option is the correct answer',
        example: true,
        default: false,
    })
    @IsBoolean({ message: 'isCorrect must be a boolean' })
    @IsOptional()
    isCorrect?: boolean = false;

    @ApiProperty({
        description: 'Order index of the option within the question',
        example: 1,
        minimum: 1,
    })
    @IsNumber({}, { message: 'Order index must be a number' })
    @Min(1, { message: 'Order index must be at least 1' })
    orderIndex: number;
}

/**
 * DTO for creating questions within a test creation request
 */
export class CreateTestQuestionDto {
    @ApiProperty({
        description: 'The question text/content',
        example: 'What is the time complexity of binary search algorithm?',
    })
    @IsString({ message: 'Question text must be a string' })
    @IsNotEmpty({ message: 'Question text is required' })
    questionText: string;

    @ApiProperty({
        description: 'Type of question',
        example: QuestionType.MULTIPLE_CHOICE,
        enum: QuestionType,
    })
    @IsEnum(QuestionType, { message: 'Invalid question type' })
    @IsNotEmpty({ message: 'Question type is required' })
    questionType: QuestionType;

    @ApiProperty({
        description: 'Points awarded for correct answer',
        example: 5,
        minimum: 1,
    })
    @IsNumber({}, { message: 'Points must be a number' })
    @IsNotEmpty({ message: 'Points are required' })
    @Min(1, { message: 'Points must be at least 1' })
    points: number;

    @ApiProperty({
        description: 'Order index of the question in the test',
        example: 1,
        minimum: 1,
    })
    @IsNumber({}, { message: 'Order index must be a number' })
    @Min(1, { message: 'Order index must be at least 1' })
    orderIndex: number;

    @ApiProperty({
        description: 'Optional explanation for the correct answer',
        example:
            'Binary search divides the search space in half with each comparison',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Explanation must be a string' })
    explanation?: string;

    @ApiProperty({
        description: 'Optional hint for the question',
        example: 'Think about how the algorithm reduces the problem size',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Hint must be a string' })
    hint?: string;

    @ApiProperty({
        description: 'Difficulty level of the question',
        example: 'medium',
        enum: ['easy', 'medium', 'hard', 'expert'],
        default: 'medium',
    })
    @IsOptional()
    @IsString({ message: 'Difficulty must be a string' })
    difficulty?: string = 'medium';

    @ApiProperty({
        description: 'Tags for categorizing the question',
        example: ['algorithms', 'complexity', 'search'],
        required: false,
        type: [String],
    })
    @IsOptional()
    @IsArray({ message: 'Tags must be an array' })
    @IsString({ each: true, message: 'Each tag must be a string' })
    tags?: string[];

    @ApiProperty({
        description:
            'Answer options for multiple choice and true/false questions',
        type: [CreateTestQuestionOptionDto],
        required: false,
    })
    @IsOptional()
    @IsArray({ message: 'Options must be an array' })
    @ValidateNested({ each: true })
    @Type(() => CreateTestQuestionOptionDto)
    options?: CreateTestQuestionOptionDto[];
}

/**
 * Data Transfer Object for creating a new test
 * Used for test creation with comprehensive validation and examples
 */
export class CreateTestDto {
    @ApiProperty({
        description: 'Course ID that this test belongs to',
        example: 1,
        type: Number,
        title: 'Course ID',
        minimum: 1,
    })
    @IsNumber({}, { message: 'Course ID must be a valid number' })
    @IsNotEmpty({ message: 'Course ID is required' })
    @Min(1, { message: 'Course ID must be at least 1' })
    courseId: number;

    @ApiProperty({
        description: 'Test title for identification and display',
        example: 'Midterm Exam - Computer Science Fundamentals',
        type: String,
        title: 'Test Title',
        maxLength: 255,
        minLength: 3,
    })
    @IsString({ message: 'Test title must be a string' })
    @IsNotEmpty({ message: 'Test title is required' })
    @MinLength(3, { message: 'Test title must be at least 3 characters long' })
    title: string;

    @ApiProperty({
        description:
            'Test description and instructions for students taking the test',
        example:
            'This exam covers chapters 1-5 of the course material. You have 2 hours to complete all questions.',
        required: false,
        type: String,
        title: 'Test Description',
    })
    @IsOptional()
    @IsString({ message: 'Test description must be a string' })
    description?: string;

    @ApiProperty({
        description: 'Type of test determining behavior and purpose',
        example: TestType.EXAM,
        enum: TestType,
        title: 'Test Type',
        examples: {
            exam: {
                summary: 'Formal Examination',
                description:
                    'Comprehensive formal exam with strict timing and limited attempts',
                value: TestType.EXAM,
            },
            quiz: {
                summary: 'Quick Quiz',
                description: 'Short assessment for knowledge checking',
                value: TestType.QUIZ,
            },
            training: {
                summary: 'Training Module',
                description: 'Practice assessment for skill development',
                value: TestType.TRAINING,
            },
        },
    })
    @IsEnum(TestType, {
        message: 'Test type must be one of: exam, quiz, training',
    })
    @IsNotEmpty({ message: 'Test type is required' })
    testType: TestType;

    @ApiProperty({
        description: 'Test duration in minutes (leave empty for untimed tests)',
        example: 120,
        required: false,
        type: Number,
        title: 'Duration (Minutes)',
        minimum: 1,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Duration must be a valid number' })
    @Min(1, { message: 'Duration must be at least 1 minute' })
    durationMinutes?: number;

    @ApiProperty({
        description: 'Maximum number of attempts allowed per user',
        example: 3,
        default: 1,
        type: Number,
        title: 'Maximum Attempts',
        minimum: 1,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Maximum attempts must be a valid number' })
    @Min(1, { message: 'Maximum attempts must be at least 1' })
    maxAttempts?: number;

    @ApiProperty({
        description: 'Questions to be created with the test',
        type: [CreateTestQuestionDto],
        required: false,
        example: [
            {
                questionText:
                    'What is the time complexity of binary search algorithm?',
                questionType: 'multiple_choice',
                points: 5,
                orderIndex: 1,
                explanation:
                    'Binary search divides the search space in half with each comparison, making it very efficient',
                hint: 'Think about how the algorithm reduces the problem size with each step',
                difficulty: 'medium',
                tags: ['algorithms', 'complexity', 'search'],
                options: [
                    {
                        optionText: 'O(log n)',
                        isCorrect: true,
                        orderIndex: 1,
                    },
                    {
                        optionText: 'O(n)',
                        isCorrect: false,
                        orderIndex: 2,
                    },
                    {
                        optionText: 'O(n²)',
                        isCorrect: false,
                        orderIndex: 3,
                    },
                    {
                        optionText: 'O(1)',
                        isCorrect: false,
                        orderIndex: 4,
                    },
                ],
            },
            {
                questionText:
                    'Explain the concept of recursion in programming and provide an example.',
                questionType: 'essay',
                points: 10,
                orderIndex: 2,
                explanation:
                    'Recursion is a programming technique where a function calls itself to solve smaller instances of the same problem',
                hint: 'Consider base cases and recursive cases in your explanation',
                difficulty: 'hard',
                tags: ['recursion', 'programming concepts', 'functions'],
            },
            {
                questionText: 'Is Python a compiled language?',
                questionType: 'true_false',
                points: 2,
                orderIndex: 3,
                explanation:
                    'Python is an interpreted language, not compiled. It converts source code to bytecode at runtime',
                hint: 'Think about how Python code is executed',
                difficulty: 'easy',
                tags: ['python', 'programming languages', 'compilation'],
                options: [
                    {
                        optionText: 'True',
                        isCorrect: false,
                        orderIndex: 1,
                    },
                    {
                        optionText: 'False',
                        isCorrect: true,
                        orderIndex: 2,
                    },
                ],
            },
        ],
    })
    @IsOptional()
    @IsArray({ message: 'Questions must be an array' })
    @ValidateNested({ each: true })
    @Type(() => CreateTestQuestionDto)
    questions?: CreateTestQuestionDto[];
}
