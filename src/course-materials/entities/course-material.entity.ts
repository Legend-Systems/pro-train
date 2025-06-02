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
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { Course } from '../../course/entities/course.entity';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { MediaFile } from '../../media-manager/entities/media-manager.entity';

export enum MaterialType {
    PDF = 'pdf',
    VIDEO = 'video',
    AUDIO = 'audio',
    DOCUMENT = 'document',
    LINK = 'link',
    IMAGE = 'image',
    PRESENTATION = 'presentation',
    SPREADSHEET = 'spreadsheet',
    OTHER = 'other',
}

export enum MaterialStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    DRAFT = 'draft',
}

@Entity('course_materials')
export class CourseMaterial {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Course material unique identifier',
        example: 1,
    })
    materialId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Material title',
        example: 'Introduction to Programming Concepts',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Material description',
        example:
            'A comprehensive guide covering basic programming concepts and fundamentals',
        required: false,
    })
    @IsString()
    @IsOptional()
    description?: string;

    @ManyToOne(() => MediaFile, { nullable: true })
    @ApiProperty({
        description: 'Media file containing the course material content',
        type: () => MediaFile,
        required: false,
    })
    mediaFile?: MediaFile;

    @Column('text', { nullable: true })
    @ApiProperty({
        description:
            'External URL for materials not stored in media manager (e.g., external links, embedded videos)',
        example: 'https://www.youtube.com/watch?v=example',
        required: false,
    })
    @IsString()
    @IsOptional()
    externalUrl?: string;

    @Column({
        type: 'enum',
        enum: MaterialType,
        default: MaterialType.DOCUMENT,
    })
    @Index()
    @ApiProperty({
        description: 'Type of the material',
        enum: MaterialType,
        example: MaterialType.PDF,
    })
    @IsEnum(MaterialType)
    type: MaterialType;

    @Column({ default: 0 })
    @ApiProperty({
        description: 'Display order of the material within the course',
        example: 1,
    })
    sortOrder: number;

    @Column({ default: true })
    @ApiProperty({
        description: 'Whether the material is currently available to students',
        example: true,
    })
    isActive: boolean;

    @Column({ nullable: true, default: MaterialStatus.ACTIVE })
    @ApiProperty({
        description: 'Material status',
        example: 'active',
        default: 'active',
        enum: MaterialStatus,
    })
    @IsEnum(MaterialStatus)
    status: MaterialStatus;

    @Column()
    @ApiProperty({
        description: 'ID of the course this material belongs to',
        example: 1,
    })
    @IsNotEmpty()
    courseId: number;

    @Column()
    @ApiProperty({
        description: 'ID of the user who created this material',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @IsString()
    @IsNotEmpty()
    createdBy: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'ID of the user who last updated this material',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    @IsString()
    @IsOptional()
    updatedBy?: string;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Material creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Material last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => Course, course => course.courseId, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'courseId' })
    @ApiProperty({
        description: 'Course this material belongs to',
        type: () => Course,
    })
    course: Course;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'createdBy' })
    creator: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'updatedBy' })
    updater?: User;

    // Derived from course relations for caching purposes
    @ManyToOne(() => Organization, { nullable: false })
    @JoinColumn({ name: 'orgId' })
    @ApiProperty({
        description:
            'Organization this material belongs to (derived from course)',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @JoinColumn({ name: 'branchId' })
    @ApiProperty({
        description: 'Branch this material belongs to (derived from course)',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    constructor(partial: Partial<CourseMaterial>) {
        Object.assign(this, partial);
    }
}
