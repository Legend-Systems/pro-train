import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    Index,
    Check,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsDateString } from 'class-validator';
import { User } from '../../user/entities/user.entity';
import { Course } from '../../course/entities/course.entity';
import { Organization } from '../../org/entities/org.entity';
import { Branch } from '../../branch/entities/branch.entity';

@Entity('leaderboards')
@Index('IDX_LEADERBOARD_COURSE', ['courseId'])
@Index('IDX_LEADERBOARD_USER', ['userId'])
@Index('IDX_LEADERBOARD_RANK', ['courseId', 'rank'])
@Check('CHK_LEADERBOARD_SCORE', 'average_score >= 0 AND average_score <= 100')
@Check('CHK_LEADERBOARD_RANK', 'rank > 0')
export class Leaderboard {
    @PrimaryGeneratedColumn()
    @ApiProperty({
        description: 'Leaderboard entry unique identifier',
        example: 1,
    })
    leaderboardId: number;

    @Column()
    @Index()
    @ApiProperty({
        description: 'Course ID for this leaderboard entry',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @Column('uuid')
    @Index()
    @ApiProperty({
        description: 'User ID for this leaderboard entry',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @Column()
    @Index()
    @ApiProperty({
        description: 'User rank in the course leaderboard',
        example: 1,
        minimum: 1,
    })
    @IsNumber()
    rank: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    @ApiProperty({
        description: 'Average score across all tests in the course',
        example: 92.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    averageScore: number;

    @Column()
    @ApiProperty({
        description: 'Total number of tests completed in the course',
        example: 5,
        minimum: 0,
    })
    @IsNumber()
    testsCompleted: number;

    @Column()
    @ApiProperty({
        description: 'Total points earned across all tests',
        example: 462.5,
        minimum: 0,
    })
    @IsNumber()
    totalPoints: number;

    @Column({ type: 'timestamp', default: () => 'NOW()' })
    @ApiProperty({
        description: 'When the leaderboard entry was last updated',
        example: '2025-01-01T12:00:00.000Z',
    })
    @IsDateString()
    lastUpdated: Date;

    @CreateDateColumn()
    @ApiProperty({
        description: 'Leaderboard entry creation timestamp',
        example: '2025-01-01T09:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Leaderboard entry last update timestamp',
        example: '2025-01-01T12:00:00.000Z',
    })
    updatedAt: Date;

    @ManyToOne(() => Organization, { nullable: false })
    @ApiProperty({
        description: 'Organization this leaderboard entry belongs to',
        type: () => Organization,
    })
    orgId: Organization;

    @ManyToOne(() => Branch, { nullable: true })
    @ApiProperty({
        description: 'Branch this leaderboard entry belongs to',
        type: () => Branch,
        required: false,
    })
    branchId?: Branch;

    // Relations
    @ManyToOne(() => Course, { onDelete: 'CASCADE' })
    course: Course;

    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    user: User;

    constructor(partial: Partial<Leaderboard>) {
        Object.assign(this, partial);
    }
}
