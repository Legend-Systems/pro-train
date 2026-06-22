import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    Index,
    JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsNumber,
    IsBoolean,
    Min,
} from 'class-validator';
import { Course } from '../../course/entities/course.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { TestAttempt } from 'src/test_attempts/entities/test_attempt.entity';
import { Result } from 'src/results/entities/result.entity';
import { TrainingProgress } from 'src/training_progress/entities/training_progress.entity';
import { Question } from 'src/questions/entities/question.entity';

export enum TestType {
    EXAM = 'exam',
    QUIZ = 'quiz',
    TRAINING = 'training',
}

@Entity('tests')
@Index('IDX_TEST_COURSE_ACTIVE', ['courseId', 'isActive'])
export class Test {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Test unique identifier',
        example: 1,
    })
    testId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Course ID that this test belongs to',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    courseId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test title',
        example: 'Midterm Exam - Computer Science Fundamentals',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Test description and instructions',
        example:
            'This exam covers chapters 1-5 of the course material. You have 2 hours to complete.',
        required: false,
    })
    @IsString()
    @IsOptional()
    description?: string;

    /** Optional GCS public URL for test card thumbnail image. */
    @Column({ name: 'test_thumbnail', type: 'varchar', length: 2048, nullable: true })
    @ApiProperty({
        description: 'Public URL of the test thumbnail image in cloud storage',
        required: false,
        example: 'https://storage.googleapis.com/bucket/media/test-thumb.jpg',
    })
    @IsString()
    @IsOptional()
    testThumbnail?: string;

    @Column({
        type: 'enum',
        enum: TestType,
    })
    @ApiProperty({
        description: 'Type of test',
        example: TestType.EXAM,
        enum: TestType,
    })
    @IsEnum(TestType)
    @IsNotEmpty()
    testType: TestType;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Test duration in minutes (null for untimed tests)',
        example: 120,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    @Min(1)
    durationMinutes?: number;

    @Column({ default: 1 })
    @ApiProperty({
        description: 'Maximum number of attempts allowed per user',
        example: 3,
        default: 1,
        minimum: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    @Min(1)
    maxAttempts: number;

    @Column({ type: 'datetime', precision: 6, nullable: true })
    @ApiProperty({
        description:
            'Calendar date/time when the exam should be taken (optional)',
        example: '2026-05-18T10:30:00.000Z',
        required: false,
        nullable: true,
        type: Date,
    })
    examDate?: Date | null;

    @Column({ default: true })
    @Index()
    @ApiProperty({
        description:
            'Whether the test is currently active and available for attempts',
        example: true,
        default: true,
    })
    @IsBoolean()
    isActive: boolean;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Test creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Test last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this test belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this test belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'courseId', referencedColumnName: 'courseId' })
    course: Course;

    @OneToMany(() => Question, 'test')
    questions: any[];

    // Note: These relations will be added as we implement other entities
    @OneToMany(() => TestAttempt, attempt => attempt.test)
    testAttempts: TestAttempt[];

    @OneToMany(() => Result, result => result.test)
    results: Result[];

    @OneToMany(() => TrainingProgress, progress => progress.test)
    trainingProgress: TrainingProgress[];

    constructor(partial: Partial<Test>) {
        Object.assign(this, partial);
    }
}
