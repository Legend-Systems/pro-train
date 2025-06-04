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
    IsNumber,
    IsBoolean,
    IsEnum,
} from 'class-validator';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

export enum MediaType {
    IMAGE = 'image',
    DOCUMENT = 'document',
    VIDEO = 'video',
    AUDIO = 'audio',
    OTHER = 'other',
}

export enum ImageVariant {
    ORIGINAL = 'original',
    THUMBNAIL = 'thumbnail',
    MEDIUM = 'medium',
    LARGE = 'large',
}

export enum MediaFileStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    PROCESSING = 'processing',
}

export enum FileDesignation {
    USER_AVATAR = 'user_avatar',
    COURSE_THUMBNAIL = 'course_thumbnail',
    COURSE_MATERIAL = 'course_material',
    QUESTION_IMAGE = 'question_image',
    ANSWER_ATTACHMENT = 'answer_attachment',
    ORGANIZATION_LOGO = 'organization_logo',
    TEST_ATTACHMENT = 'test_attachment',
    GENERAL_UPLOAD = 'general_upload',
    OTHER = 'other',
}

@Entity('media_files')
export class MediaFile {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Media file unique identifier',
        example: 1,
    })
    id: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Original filename as uploaded',
        example: 'course-image.jpg',
    })
    @IsString()
    @IsNotEmpty()
    originalName: string;

    @Column()
    @ApiProperty({
        description: 'Stored filename in GCS',
        example: 'media/2025/01/15/uuid-course-image.jpg',
    })
    @IsString()
    @IsNotEmpty()
    filename: string;

    @Column()
    @ApiProperty({
        description: 'Full GCS URL for the file',
        example:
            'https://storage.googleapis.com/bucket-name/media/2025/01/15/uuid-course-image.jpg',
    })
    @IsString()
    @IsNotEmpty()
    url: string;

    @Column()
    @ApiProperty({
        description: 'MIME type of the file',
        example: 'image/jpeg',
    })
    @IsString()
    @IsNotEmpty()
    mimeType: string;

    @Column()
    @ApiProperty({
        description: 'File size in bytes',
        example: 2048576,
    })
    @IsNumber()
    size: number;

    @Column({
        type: 'enum',
        enum: MediaType,
        default: MediaType.OTHER,
    })
    @ApiProperty({
        description: 'Type of media file',
        enum: MediaType,
        example: MediaType.IMAGE,
    })
    @IsEnum(MediaType)
    type: MediaType;

    @Column({
        type: 'enum',
        enum: ImageVariant,
        nullable: true,
    })
    @ApiProperty({
        description: 'Image variant (for images only)',
        enum: ImageVariant,
        example: ImageVariant.ORIGINAL,
        required: false,
    })
    @IsOptional()
    @IsEnum(ImageVariant)
    variant?: ImageVariant;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Reference to original file (for thumbnails/variants)',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    originalFileId?: number;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Image width in pixels (for images)',
        example: 1920,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    width?: number;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Image height in pixels (for images)',
        example: 1080,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    height?: number;

    @Column({ default: true })
    @ApiProperty({
        description: 'Whether the file is active/available',
        example: true,
    })
    @IsBoolean()
    isActive: boolean;

    @Column({ nullable: true, default: MediaFileStatus.ACTIVE })
    @ApiProperty({
        description: 'Media file status',
        example: 'active',
        default: 'active',
        enum: MediaFileStatus,
    })
    @IsEnum(MediaFileStatus)
    status: MediaFileStatus;

    @Column({
        type: 'enum',
        enum: FileDesignation,
        default: FileDesignation.GENERAL_UPLOAD,
    })
    @ApiProperty({
        description: 'File designation - what this file is used for',
        enum: FileDesignation,
        example: FileDesignation.GENERAL_UPLOAD,
        default: FileDesignation.GENERAL_UPLOAD,
    })
    @IsEnum(FileDesignation)
    designation: FileDesignation;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Alt text for images (accessibility)',
        example: 'Course introduction illustration',
        required: false,
    })
    @IsOptional()
    @IsString()
    altText?: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'File description or caption',
        example: 'Introduction image for Computer Science course',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @Column('json', { nullable: true })
    @ApiProperty({
        description: 'Additional metadata for the file',
        example: { exif: {}, processing: {} },
        required: false,
    })
    @IsOptional()
    metadata?: Record<string, any>;

    @Column()
    @ApiProperty({
        description: 'ID of the user who uploaded this file',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @IsString()
    @IsNotEmpty()
    uploadedBy: string;

    @CreateDateColumn()
    @ApiProperty({
        description: 'File upload timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'File last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: true })
    @ApiProperty({
        description: 'Organization this file belongs to',
        type: () => Organization,
        required: false,
    })
    orgId?: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this file belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    uploader: User;

    @ManyToOne(() => MediaFile, { nullable: true, onDelete: 'CASCADE' })
    originalFile?: MediaFile;

    // Transient property for loaded variants (not persisted to database)
    variants?: MediaFile[];

    constructor(partial: Partial<MediaFile>) {
        Object.assign(this, partial);
    }
}
