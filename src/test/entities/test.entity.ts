import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
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
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Test last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    course: Course;

    // Note: These relations will be added as we implement other entities
    // @OneToMany(() => Question, question => question.test)
    // questions: Question[];

    // @OneToMany(() => TestAttempt, attempt => attempt.test)
    // testAttempts: TestAttempt[];

    // @OneToMany(() => Result, result => result.test)
    // results: Result[];

    // @OneToMany(() => TrainingProgress, progress => progress.test)
    // trainingProgress: TrainingProgress[];

    constructor(partial: Partial<Test>) {
        Object.assign(this, partial);
    }
}
