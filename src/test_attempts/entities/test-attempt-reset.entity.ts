import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsUUID,
    IsNumber,
    IsDateString,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { Test } from '../../test/entities/test.entity';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

/** Upper bound for the free-text justification captured with a reset. */
export const RESET_REASON_MAX_LENGTH = 500;

/**
 * Append-only audit record of an administrator resetting one learner's attempts
 * for one test.
 *
 * Each row is a watermark: every `test_attempts` and `results` row whose
 * `voidedByResetId` points at this record was live before the reset and is
 * permanently hidden from the learner afterwards. Nothing is deleted, so the
 * organisation keeps the full history while the learner gets a clean retake.
 */
@Entity('test_attempt_resets')
@Index('IDX_TEST_ATTEMPT_RESET_TEST', ['testId'])
@Index('IDX_TEST_ATTEMPT_RESET_USER', ['userId'])
@Index('IDX_TEST_ATTEMPT_RESET_TEST_USER', ['testId', 'userId'])
@Index('IDX_TEST_ATTEMPT_RESET_RESET_AT', ['resetAt'])
export class TestAttemptReset {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Reset record unique identifier',
        example: 1,
    })
    resetId: number;

    @Column()
    @ApiProperty({
        description: 'Test whose attempts were reset',
        example: 1,
    })
    @IsNumber()
    testId: number;

    @Column('uuid')
    @ApiProperty({
        description: 'Learner whose attempts were reset',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @Column('uuid')
    @ApiProperty({
        description: 'Administrator who performed the reset',
        example: '223e4567-e89b-12d3-a456-426614174111',
    })
    @IsUUID()
    resetByUserId: string;

    @Column({ type: 'varchar', length: RESET_REASON_MAX_LENGTH, nullable: true })
    @ApiProperty({
        description: 'Free-text justification supplied by the administrator',
        example: 'Learner lost connection during their final attempt',
        required: false,
        maxLength: RESET_REASON_MAX_LENGTH,
    })
    @IsOptional()
    @IsString()
    @MaxLength(RESET_REASON_MAX_LENGTH)
    reason?: string | null;

    @Column({ type: 'int', default: 0 })
    @ApiProperty({
        description: 'Number of test attempts voided by this reset',
        example: 3,
    })
    @IsNumber()
    attemptsVoided: number;

    @Column({ type: 'int', default: 0 })
    @ApiProperty({
        description: 'Number of results voided by this reset',
        example: 3,
    })
    @IsNumber()
    resultsVoided: number;

    @Column({ type: 'timestamp' })
    @ApiProperty({
        description: 'Watermark — the moment the reset took effect',
        example: '2025-01-15T10:30:00.000Z',
    })
    @IsDateString()
    resetAt: Date;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Reset record creation timestamp',
        example: '2025-01-15T10:30:00.000Z',
    })
    createdAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @JoinColumn({ name: 'orgId' })
    @ApiProperty({
        description: 'Organization this reset belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branchId' })
    @ApiProperty({
        description: 'Branch this reset belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch | null;

    // Relations
    @ManyToOne(() => Test, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'testId' })
    test: Test;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'resetByUserId' })
    resetByUser: User;

    constructor(partial: Partial<TestAttemptReset>) {
        Object.assign(this, partial);
    }
}
