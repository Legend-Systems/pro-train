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
    IsUUID,
    IsNumber,
    IsEnum,
    IsDateString,
    IsOptional,
} from 'class-validator';
import { Test } from '../../test/entities/test.entity';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

export enum AttemptStatus {
    IN_PROGRESS = 'in_progress',
    SUBMITTED = 'submitted',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
}

@Entity('test_attempts')
@Index('IDX_TEST_ATTEMPT_TEST', ['testId'])
@Index('IDX_TEST_ATTEMPT_USER', ['userId'])
@Index('IDX_TEST_ATTEMPT_STATUS', ['status'])
@Index('IDX_TEST_ATTEMPT_START_TIME', ['startTime'])
@Check('CHK_ATTEMPT_NUMBER', 'attempt_number > 0')
export class TestAttempt {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Test attempt unique identifier',
        example: 1,
    })
    attemptId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test ID for this attempt',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @Column('uuid')
    @Index()
    @ApiProperty({
        description: 'User ID who is taking the test',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @Column()
    @ApiProperty({
        description: 'Attempt number for this user and test',
        example: 1,
        minimum: 1,
    })
    @IsNumber()
    attemptNumber: number;

    @Column({
        type: 'enum',
        enum: AttemptStatus,
        default: AttemptStatus.IN_PROGRESS,
    })
    @ApiProperty({
        description: 'Current status of the test attempt',
        example: AttemptStatus.IN_PROGRESS,
        enum: AttemptStatus,
    })
    @IsEnum(AttemptStatus)
    status: AttemptStatus;

    @Column({ type: 'timestamp' })
    @ApiProperty({
        description: 'When the test attempt started',
        example: '2024-01-01T09:00:00.000Z',
    })
    @IsDateString()
    startTime: Date;

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'When the test attempt was submitted',
        example: '2024-01-01T10:30:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    submitTime?: Date;

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'When the test attempt expires (based on duration)',
        example: '2024-01-01T11:00:00.000Z',
        required: false,
    })
    @IsOptional()
    @IsDateString()
    expiresAt?: Date;

    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    @ApiProperty({
        description: 'Current progress percentage (0-100)',
        example: 75.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    progressPercentage: number;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Test attempt creation timestamp',
        example: '2024-01-01T09:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Test attempt last update timestamp',
        example: '2024-01-01T10:15:30.123Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this test attempt belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this test attempt belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => Test, { onDelete: 'RESTRICT' })
    test: Test;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    user: User;

    @OneToMany('Answer', 'attempt')
    answers: any[];

    @OneToMany('Result', 'attempt')
    results: any[];

    constructor(partial: Partial<TestAttempt>) {
        Object.assign(this, partial);
    }
}
