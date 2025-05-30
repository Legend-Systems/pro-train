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
import { IsString, IsNotEmpty, IsEnum, IsNumber, Min } from 'class-validator';
import { Test } from '../../test/entities/test.entity';

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

    @CreateDateColumn()
    @ApiProperty({
        description: 'Question creation timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Question last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Test, { onDelete: 'CASCADE' })
    test: Test;

    @OneToMany('QuestionOption', 'question')
    options: any[];

    constructor(partial: Partial<Question>) {
        Object.assign(this, partial);
    }
}
