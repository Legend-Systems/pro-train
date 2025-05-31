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
    IsEmail,
    IsEnum,
    IsString,
    IsOptional,
    IsDateString,
    IsObject,
} from 'class-validator';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

export enum EmailType {
    WELCOME = 'welcome',
    PASSWORD_RESET = 'password_reset',
    TEST_NOTIFICATION = 'test_notification',
    RESULTS_SUMMARY = 'results_summary',
    COURSE_ENROLLMENT = 'course_enrollment',
    SYSTEM_ALERT = 'system_alert',
    CUSTOM = 'custom',
}

export enum EmailStatus {
    PENDING = 'pending',
    QUEUED = 'queued',
    SENDING = 'sending',
    SENT = 'sent',
    FAILED = 'failed',
    BOUNCED = 'bounced',
    DELIVERED = 'delivered',
    RETRY = 'retry',
}

@Entity('communications')
@Index('IDX_COMMUNICATION_RECIPIENT', ['recipientEmail'])
@Index('IDX_COMMUNICATION_SENDER', ['senderEmail'])
@Index('IDX_COMMUNICATION_STATUS', ['status'])
@Index('IDX_COMMUNICATION_TYPE', ['emailType'])
@Index('IDX_COMMUNICATION_SENT_DATE', ['sentAt'])
@Index('IDX_COMMUNICATION_CREATED_DATE', ['createdAt'])
export class Communication {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'Communication unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    id: string;

    @Column()
    @ApiProperty({
        description: 'Recipient email address',
        example: 'recipient@example.com',
    })
    @IsEmail()
    recipientEmail: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Recipient name',
        example: 'John Doe',
        required: false,
    })
    @IsString()
    @IsOptional()
    recipientName?: string;

    @Column()
    @ApiProperty({
        description: 'Sender email address',
        example: 'noreply@exxam.com',
    })
    @IsEmail()
    senderEmail: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Sender name',
        example: 'Exxam Platform',
        required: false,
    })
    @IsString()
    @IsOptional()
    senderName?: string;

    @Column()
    @ApiProperty({
        description: 'Email subject line',
        example: 'Welcome to Exxam!',
    })
    @IsString()
    subject: string;

    @Column('text')
    @ApiProperty({
        description: 'Email body content (HTML)',
        example: '<h1>Welcome!</h1><p>Thank you for joining Exxam.</p>',
    })
    @IsString()
    body: string;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Plain text version of email body',
        example: 'Welcome! Thank you for joining Exxam.',
        required: false,
    })
    @IsString()
    @IsOptional()
    plainTextBody?: string;

    @Column({
        type: 'enum',
        enum: EmailType,
        default: EmailType.CUSTOM,
    })
    @ApiProperty({
        description: 'Type of email being sent',
        enum: EmailType,
        example: EmailType.WELCOME,
    })
    @IsEnum(EmailType)
    emailType: EmailType;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Template used for this email',
        example: 'welcome-template',
        required: false,
    })
    @IsString()
    @IsOptional()
    templateUsed?: string;

    @Column({
        type: 'enum',
        enum: EmailStatus,
        default: EmailStatus.PENDING,
    })
    @ApiProperty({
        description: 'Current status of the email',
        enum: EmailStatus,
        example: EmailStatus.SENT,
    })
    @IsEnum(EmailStatus)
    status: EmailStatus;

    @Column({ type: 'datetime', nullable: true })
    @ApiProperty({
        description: 'Date and time when email was sent',
        example: '2024-01-01T12:00:00.000Z',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    sentAt?: Date;

    @Column({ type: 'datetime', nullable: true })
    @ApiProperty({
        description: 'Date and time when email was delivered',
        example: '2024-01-01T12:00:30.000Z',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    deliveredAt?: Date;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Error message if email failed',
        example: 'SMTP Error: Connection timeout',
        required: false,
    })
    @IsString()
    @IsOptional()
    errorMessage?: string;

    @Column('json', { nullable: true })
    @ApiProperty({
        description: 'Additional metadata for the email',
        example: { userId: '123', testId: '456', priority: 'high' },
        required: false,
    })
    @IsObject()
    @IsOptional()
    metadata?: Record<string, any>;

    @Column({ default: 0 })
    @ApiProperty({
        description: 'Number of retry attempts',
        example: 2,
    })
    retryCount: number;

    @Column({ type: 'datetime', nullable: true })
    @ApiProperty({
        description: 'Next retry attempt time',
        example: '2024-01-01T13:00:00.000Z',
        required: false,
    })
    @IsDateString()
    @IsOptional()
    nextRetryAt?: Date;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'External email service message ID',
        example: '<msg-123@smtp.gmail.com>',
        required: false,
    })
    @IsString()
    @IsOptional()
    externalMessageId?: string;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Record creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Record last update date',
        example: '2024-01-01T00:00:00.000Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this communication belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this communication belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    constructor(partial: Partial<Communication>) {
        Object.assign(this, partial);
    }
}
