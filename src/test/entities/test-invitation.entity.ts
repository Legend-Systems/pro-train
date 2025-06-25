import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
    Unique,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsDate,
    IsUUID,
} from 'class-validator';
import { Test } from './test.entity';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

export enum InvitationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    EXPIRED = 'expired',
    COMPLETED = 'completed',
}

@Entity('test_invitations')
@Unique(['testId', 'userId'])
@Index('IDX_TEST_INVITATION_STATUS', ['status'])
@Index('IDX_TEST_INVITATION_EXPIRES', ['expiresAt'])
export class TestInvitation {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'Test invitation unique identifier',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    invitationId: string;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Test ID that user is invited to',
        example: 1,
    })
    testId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'User ID who is invited',
        example: 'user-123',
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @Column()
    @Index()
    @ApiProperty({
        description: 'User ID who sent the invitation',
        example: 'admin-456',
    })
    @IsString()
    @IsNotEmpty()
    invitedBy: string;

    @Column({
        type: 'enum',
        enum: InvitationStatus,
        default: InvitationStatus.PENDING,
    })
    @Index()
    @ApiProperty({
        description: 'Current status of the invitation',
        example: InvitationStatus.PENDING,
        enum: InvitationStatus,
    })
    @IsEnum(InvitationStatus)
    status: InvitationStatus;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Custom message included with the invitation',
        example: 'Please complete this assessment by Friday.',
        required: false,
    })
    @IsString()
    @IsOptional()
    message?: string;

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'When the invitation expires (null for no expiration)',
        example: '2025-01-30T23:59:59.000Z',
        required: false,
    })
    @IsDate()
    @IsOptional()
    expiresAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'When the user responded to the invitation',
        example: '2025-01-20T14:30:00.000Z',
        required: false,
    })
    @IsDate()
    @IsOptional()
    respondedAt?: Date;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'User response notes or decline reason',
        example: 'Will complete after current project deadline',
        required: false,
    })
    @IsString()
    @IsOptional()
    responseNotes?: string;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Invitation creation timestamp',
        example: '2025-01-15T10:30:00.000Z',
    })
    invitedAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Invitation last update timestamp',
        example: '2025-01-20T14:30:45.123Z',
    })
    updatedAt: Date;

    // Organization and Branch for scoping
    @Column()
    @Index()
    @ApiProperty({
        description: 'Organization ID for scoping',
        example: 'org-123',
    })
    @IsString()
    @IsNotEmpty()
    orgId: string;

    @Column({ nullable: true })
    @Index()
    @ApiProperty({
        description: 'Branch ID for scoping',
        example: 'branch-456',
        required: false,
    })
    @IsString()
    @IsOptional()
    branchId?: string;

    // Relations
    @ManyToOne(() => Test, { onDelete: 'CASCADE' })
    test: Test;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    user: User;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    inviter: User;

    @ManyToOne(() => Organization, { nullable: false })
    organization: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    branch?: Branch;

    constructor(partial: Partial<TestInvitation>) {
        Object.assign(this, partial);
    }
} 