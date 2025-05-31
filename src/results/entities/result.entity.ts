import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
    Check,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsBoolean, IsDateString } from 'class-validator';
import { TestAttempt } from '../../test_attempts/entities/test_attempt.entity';
import { Test } from '../../test/entities/test.entity';
import { User } from '../../user/entities/user.entity';
import { Course } from '../../course/entities/course.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('results')
@Index('IDX_RESULT_ATTEMPT', ['attemptId'])
@Index('IDX_RESULT_USER', ['userId'])
@Index('IDX_RESULT_TEST', ['testId'])
@Index('IDX_RESULT_COURSE', ['courseId'])
@Index('IDX_RESULT_PASSED', ['passed'])
@Check('CHK_RESULT_SCORE', 'score >= 0')
@Check('CHK_RESULT_PERCENTAGE', 'percentage >= 0 AND percentage <= 100')
export class Result {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Result unique identifier',
        example: 1,
    })
    resultId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test attempt ID this result belongs to',
        example: 1,
    })
    @IsNumber()
    attemptId: number;

    @Column('uuid')
    @Index()
    @ApiProperty({
        description: 'User ID who took the test',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test ID for this result',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Course ID for this result',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @Column({ type: 'decimal', precision: 8, scale: 2 })
    @ApiProperty({
        description: 'Total score achieved',
        example: 85.5,
        minimum: 0,
    })
    @IsNumber()
    score: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    @ApiProperty({
        description: 'Percentage score (0-100)',
        example: 85.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    percentage: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Whether the student passed the test',
        example: true,
    })
    @IsBoolean()
    passed: boolean;

    @Column({ type: 'decimal', precision: 8, scale: 2 })
    @ApiProperty({
        description: 'Maximum possible score for the test',
        example: 100,
        minimum: 0,
    })
    @IsNumber()
    maxScore: number;

    @Column({ type: 'timestamp' })
    @ApiProperty({
        description: 'When the result was calculated',
        example: '2024-01-01T11:00:00.000Z',
    })
    @IsDateString()
    calculatedAt: Date;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Result creation timestamp',
        example: '2024-01-01T11:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Result last update timestamp',
        example: '2024-01-01T11:00:00.000Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this result belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this result belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => TestAttempt, { onDelete: 'CASCADE' })
    attempt: TestAttempt;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    user: User;

    @ManyToOne(() => Test, { onDelete: 'RESTRICT' })
    test: Test;

    @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
    course: Course;

    constructor(partial: Partial<Result>) {
        Object.assign(this, partial);
    }
}
