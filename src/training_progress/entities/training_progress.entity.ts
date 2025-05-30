import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
    Unique,
    Check,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsOptional } from 'class-validator';
import { User } from '../../user/entities/user.entity';
import { Course } from '../../course/entities/course.entity';
import { Test } from '../../test/entities/test.entity';

@Entity('training_progress')
@Index('IDX_PROGRESS_USER', ['userId'])
@Index('IDX_PROGRESS_COURSE', ['courseId'])
@Index('IDX_PROGRESS_TEST', ['testId'])
@Unique('UQ_PROGRESS_USER_COURSE_TEST', ['userId', 'courseId', 'testId'])
@Check(
    'CHK_PROGRESS_PERCENTAGE',
    'completion_percentage >= 0 AND completion_percentage <= 100',
)
export class TrainingProgress {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Training progress unique identifier',
        example: 1,
    })
    progressId: number;

    @Column('uuid')
    @Index()
    @ApiProperty({
        description: 'User ID tracking progress',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Course ID for progress tracking',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @Column({ nullable: true })
    @Index()
    @ApiProperty({
        description: 'Specific test ID (optional for overall course progress)',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    testId?: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    @ApiProperty({
        description: 'Completion percentage (0-100)',
        example: 75.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    completionPercentage: number;

    @Column({ default: 0 })
    @ApiProperty({
        description: 'Total time spent in minutes',
        example: 120,
        minimum: 0,
    })
    @IsNumber()
    timeSpentMinutes: number;

    @Column({ default: 0 })
    @ApiProperty({
        description: 'Number of questions completed',
        example: 25,
        minimum: 0,
    })
    @IsNumber()
    questionsCompleted: number;

    @Column({ default: 0 })
    @ApiProperty({
        description: 'Total number of questions in the test/course',
        example: 30,
        minimum: 0,
    })
    @IsNumber()
    totalQuestions: number;

    @Column({ type: 'timestamp', default: () => 'NOW()' })
    @ApiProperty({
        description: 'When progress was last updated',
        example: '2024-01-01T10:30:00.000Z',
    })
    lastUpdated: Date;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Progress tracking start timestamp',
        example: '2024-01-01T09:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Progress last update timestamp',
        example: '2024-01-01T10:30:00.000Z',
    })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    course: Course;

    @ManyToOne(() => Test, { nullable: true, onDelete: 'CASCADE' })
    test: Test;

    constructor(partial: Partial<TrainingProgress>) {
        Object.assign(this, partial);
    }
}
