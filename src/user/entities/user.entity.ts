import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    Index,
} from 'typeorm';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';
import { MediaFile } from '../../media-manager/entities/media-manager.entity';
import { TestAttempt } from 'src/test_attempts/entities/test_attempt.entity';
import { Result } from 'src/results/entities/result.entity';
import { Leaderboard } from 'src/leaderboard/entities/leaderboard.entity';
import { Answer } from 'src/answers/entities/answer.entity';
import { TrainingProgress } from 'src/training_progress/entities/training_progress.entity';
import { Course } from 'src/course/entities/course.entity';

export enum UserRole {
    BRANDON = 'brandon',
    OWNER = 'owner',
    ADMIN = 'admin',
    USER = 'user',
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended',
}

@Entity('users')
@Index('IDX_USER_EMAIL', ['email'])
@Index('IDX_USER_CREATED_AT', ['createdAt'])
@Index('IDX_USER_NAME_SEARCH', ['firstName', 'lastName'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'User unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    id: string;

    @Column({ unique: true })
    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
    })
    @IsEmail()
    email: string;

    @Column()
    @ApiProperty({
        description: 'User password (excluded from responses)',
        example: 'securePassword123',
    })
    @IsString()
    @MinLength(6)
    @Exclude({ toPlainOnly: true })
    password: string;

    @Column()
    @ApiProperty({
        description: 'User first name',
        example: 'John',
    })
    @IsString()
    firstName: string;

    @Column()
    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    @IsString()
    lastName: string;

    @ManyToOne(() => MediaFile, { nullable: true })
    @ApiProperty({
        description: 'User avatar image from media library',
        type: () => MediaFile,
        required: false,
    })
    avatar?: MediaFile;

    @Column({ nullable: true, default: UserRole.USER })
    @ApiProperty({
        description: 'User role',
        example: 'admin',
        required: false,
    })
    @IsEnum(UserRole)
    role?: UserRole;

    @Column({ default: false })
    @ApiProperty({
        description: 'Whether user email is verified',
        example: true,
        default: false,
    })
    emailVerified: boolean;

    @Column({ nullable: true, default: UserStatus.ACTIVE })
    @ApiProperty({
        description: 'User account status',
        example: 'active',
        default: 'active',
        enum: UserStatus,
    })
    @IsEnum(UserStatus)
    status: UserStatus;

    @IsString()
    @CreateDateColumn()
    @ApiProperty({
        description: 'Account creation date',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Last update date',
        example: '2025-01-01T00:00:00.000Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: true })
    @ApiProperty({
        description: 'Organization this user belongs to',
        type: () => Organization,
        required: false,
    })
    orgId?: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this user belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    @OneToMany(() => Course, 'creator')
    createdCourses: Course[];

    @OneToMany(() => TestAttempt, 'user')
    testAttempts: TestAttempt[];

    @OneToMany(() => Result, 'user')
    results: Result[];

    @OneToMany(() => Answer, 'markedByUser')
    markedAnswers: Answer[];

    @OneToMany(() => Leaderboard, 'user')
    leaderboardEntries: Leaderboard[];

    @OneToMany(() => TrainingProgress, 'user')
    trainingProgress: TrainingProgress[];

    constructor(partial: Partial<User>) {
        Object.assign(this, partial);
    }
}
