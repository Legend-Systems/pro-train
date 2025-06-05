import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
    Check,
    OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsNumber,
    Min,
    IsOptional,
    IsBoolean,
} from 'class-validator';
import { Test } from '../../test/entities/test.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { MediaFile } from '../../media-manager/entities/media-manager.entity';

export enum QuestionType {
    MULTIPLE_CHOICE = 'multiple_choice',
    TRUE_FALSE = 'true_false',
    SHORT_ANSWER = 'short_answer',
    ESSAY = 'essay',
    FILL_IN_BLANK = 'fill_in_blank',
}

@Entity('questions')
@Index('IDX_QUESTION_TEST', ['testId'])
@Index('IDX_QUESTION_ORDER', ['testId', 'orderIndex'])
@Index('IDX_QUESTION_MEDIA', ['mediaFileId'])
@Check('CHK_QUESTION_POINTS', 'points > 0')
export class Question {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Question unique identifier',
        example: 1,
    })
    questionId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test ID that this question belongs to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    testId: number;

    @Column('text')
    @ApiProperty({
        description: 'The question text/content',
        example: 'What is the time complexity of binary search algorithm?',
    })
    @IsString()
    @IsNotEmpty()
    questionText: string;

    @Column({
        type: 'enum',
        enum: QuestionType,
    })
    @ApiProperty({
        description: 'Type of question',
        example: QuestionType.MULTIPLE_CHOICE,
        enum: QuestionType,
    })
    @IsEnum(QuestionType)
    @IsNotEmpty()
    questionType: QuestionType;

    @Column()
    @ApiProperty({
        description: 'Points awarded for correct answer',
        example: 5,
        minimum: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    points: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Order index of the question in the test',
        example: 1,
        minimum: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    orderIndex: number;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Media file ID for questions with image/video content',
        example: 123,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    mediaFileId?: number;

    @Column({ default: false })
    @ApiProperty({
        description: 'Whether this question has associated media content',
        example: false,
        default: false,
    })
    @IsBoolean()
    hasMedia: boolean;

    @Column('text', { nullable: true })
    @ApiProperty({
        description:
            'Instructions for media content (e.g., "Watch the video and answer:", "Examine the diagram above:")',
        example: 'Watch the video demonstration and then answer:',
        required: false,
    })
    @IsOptional()
    @IsString()
    mediaInstructions?: string;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Explanation for the correct answer',
        example:
            'Binary search divides the search space in half with each comparison',
        required: false,
    })
    @IsOptional()
    @IsString()
    explanation?: string;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Hint for the question',
        example: 'Think about how the algorithm reduces the problem size',
        required: false,
    })
    @IsOptional()
    @IsString()
    hint?: string;

    @Column({ nullable: true, default: 'medium' })
    @ApiProperty({
        description: 'Difficulty level of the question',
        example: 'medium',
        enum: ['easy', 'medium', 'hard', 'expert'],
        default: 'medium',
        required: false,
    })
    @IsOptional()
    @IsString()
    difficulty?: string;

    @Column('simple-array', { nullable: true })
    @ApiProperty({
        description: 'Tags for categorizing the question',
        example: ['algorithms', 'complexity', 'search'],
        type: [String],
        required: false,
    })
    @IsOptional()
    tags?: string[];

    @CreateDateColumn()
    @ApiProperty({
        description: 'Question creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Question last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this question belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this question belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => Test, { onDelete: 'CASCADE' })
    test: Test;

    @OneToMany('QuestionOption', 'question')
    options: any[];

    @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'SET NULL' })
    @ApiProperty({
        description:
            'Associated media file (image, video, document) for this question',
        type: () => MediaFile,
        required: false,
    })
    mediaFile?: MediaFile;

    constructor(partial: Partial<Question>) {
        Object.assign(this, partial);
    }
}
