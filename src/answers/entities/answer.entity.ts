import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
    Check,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsUUID,
    IsNumber,
    IsString,
    IsBoolean,
    IsOptional,
    IsDateString,
} from 'class-validator';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';
import { Question } from '../../questions/entities/question.entity';
import { QuestionOption } from '../../questions_options/entities/questions_option.entity';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('answers')
@Index('IDX_ANSWER_ATTEMPT', ['attemptId'])
@Index('IDX_ANSWER_QUESTION', ['questionId'])
@Index('IDX_ANSWER_MARKED', ['isMarked'])
@Check('CHK_ANSWER_POINTS', 'points_awarded >= 0')
export class Answer {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Answer unique identifier',
        example: 1,
    })
    answerId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test attempt ID this answer belongs to',
        example: 1,
    })
    @IsNumber()
    attemptId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Question ID this answer responds to',
        example: 1,
    })
    @IsNumber()
    questionId: number;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Selected option ID for multiple choice questions',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    selectedOptionId?: number;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Text answer for open-ended questions',
        example: 'The time complexity of binary search is O(log n)',
        required: false,
    })
    @IsOptional()
    @IsString()
    textAnswer?: string;

    @Column({ type: 'int', nullable: true })
    @ApiProperty({
        description: 'Time spent on this question in seconds',
        example: 45,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    timeSpent?: number;

    @Column('uuid')
    @ApiProperty({
        description: 'User ID who submitted this answer',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    @ApiProperty({
        description: 'Points awarded for this answer',
        example: 4.5,
        minimum: 0,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    pointsAwarded?: number;

    @Column({ default: false })
    @ApiProperty({
        description: 'Whether this answer has been marked/graded',
        example: true,
    })
    @IsBoolean()
    isMarked: boolean;

    @Column({ default: false })
    @ApiProperty({
        description:
            'Whether this answer is correct (for auto-graded questions)',
        example: true,
    })
    @IsBoolean()
    isCorrect: boolean;

    @Column('uuid', { nullable: true })
    @ApiProperty({
        description: 'User ID who marked this answer (for manual grading)',
        example: '123e4567-e89b-12d3-a456-426614174000',
        required: false,
    })
    @IsOptional()
    @IsUUID()
    markedByUserId?: string;

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'When this answer was marked/graded',
        example: '2025-01-01T11:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    markedAt?: Date;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Feedback from the marker for manual grading',
        example: 'Good understanding but could provide more detail',
        required: false,
    })
    @IsOptional()
    @IsString()
    feedback?: string;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Answer submission timestamp',
        example: '2025-01-01T09:30:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Answer last update timestamp',
        example: '2025-01-01T11:00:00.000Z',
    })
    updatedAt: Date;

    @Column()
    @ApiProperty({
        description: 'Organization ID this answer belongs to',
        example: 1,
    })
    @IsNumber()
    orgId: number;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Branch ID this answer belongs to',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    branchId?: number;

    @ManyToOne(() => Organization, { nullable: false })
    @JoinColumn({ name: 'orgId' })
    @ApiProperty({
        description: 'Organization this answer belongs to',
        type: () => Organization,
    })
    organization: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branchId' })
    @ApiProperty({
        description: 'Branch this answer belongs to',
        type: () => Branch,
        required: false,
    })
    branch?: Branch;

    @ManyToOne(() => TestAttempt, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'attemptId' })
    attempt: TestAttempt;

    @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'questionId' })
    question: Question;

    @ManyToOne(() => QuestionOption, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'selectedOptionId' })
    selectedOption?: QuestionOption;

    @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
    markedByUser: User;

    constructor(partial: Partial<Answer>) {
        Object.assign(this, partial);
    }
}
