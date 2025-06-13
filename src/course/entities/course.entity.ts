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
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { User } from '../../user/entities/user.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { TrainingProgress } from 'src/training_progress/entities/training_progress.entity';
import { Result } from 'src/results/entities/result.entity';
import { Leaderboard } from 'src/leaderboard/entities/leaderboard.entity';
import { Test } from 'src/test/entities/test.entity';
import { CourseMaterial } from 'src/course-materials/entities/course-material.entity';

export enum CourseStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    DRAFT = 'draft',
}

@Entity('courses')
export class Course {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Course unique identifier',
        example: 1,
    })
    courseId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Course title',
        example: 'Introduction to Computer Science',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @Column('text', { nullable: true })
    @ApiProperty({
        description: 'Course description',
        example:
            'A comprehensive introduction to computer science fundamentals',
        required: false,
    })
    @IsString()
    @IsOptional()
    description?: string;

    @Column()
    @ApiProperty({
        description: 'ID of the user who created this course',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    @IsString()
    @IsNotEmpty()
    createdBy: string;

    @Column({ nullable: true, default: CourseStatus.ACTIVE })
    @ApiProperty({
        description: 'Course status',
        example: 'active',
        default: 'active',
        enum: CourseStatus,
    })
    @IsEnum(CourseStatus)
    status: CourseStatus;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Course creation timestamp',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Course last update timestamp',
        example: '2025-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this course belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this course belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => User, user => user.id, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'createdBy' })
    creator: User;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    deletedBy?: User;

    @OneToMany(() => Test, test => test.course)
    tests: Test[];

    @OneToMany(() => Result, result => result.course)
    results: Result[];

    @OneToMany(() => Leaderboard, leaderboard => leaderboard.course)
    leaderboards: Leaderboard[];

    @OneToMany(() => TrainingProgress, progress => progress.course)
    trainingProgress: TrainingProgress[];

    @OneToMany(() => CourseMaterial, material => material.course, {
        cascade: true,
    })
    courseMaterials: CourseMaterial[];

    constructor(partial: Partial<Course>) {
        Object.assign(this, partial);
    }
}
