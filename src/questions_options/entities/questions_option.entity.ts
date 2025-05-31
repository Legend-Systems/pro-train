import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
    JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsBoolean, IsNumber } from 'class-validator';
import { Question } from '../../questions/entities/question.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('question_options')
@Index('IDX_QUESTION_OPTION_QUESTION', ['questionId'])
@Index('IDX_QUESTION_OPTION_CORRECT', ['questionId', 'isCorrect'])
export class QuestionOption {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Question option unique identifier',
        example: 1,
    })
    optionId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Question ID that this option belongs to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    questionId: number;

    @Column('text')
    @ApiProperty({
        description: 'The option text/content',
        example: 'O(log n)',
    })
    @IsString()
    @IsNotEmpty()
    optionText: string;

    @Column({ default: false })
    @Index()
    @ApiProperty({
        description: 'Whether this option is the correct answer',
        example: true,
        default: false,
    })
    @IsBoolean()
    isCorrect: boolean;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Option creation timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Option last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this question option belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this question option belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => Question, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'questionId' })
    question: Question;

    constructor(partial: Partial<QuestionOption>) {
        Object.assign(this, partial);
    }
}
