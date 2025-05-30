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
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { User } from '../../user/entities/user.entity';

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

    @CreateDateColumn()
    @ApiProperty({
        description: 'Course creation timestamp',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Course last update timestamp',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, { onDelete: 'RESTRICT' })
    creator: User;

    // Note: These relations will be added as we implement other entities
    // @OneToMany(() => Test, test => test.course)
    // tests: Test[];

    // @OneToMany(() => Result, result => result.course)
    // results: Result[];

    // @OneToMany(() => Leaderboard, leaderboard => leaderboard.course)
    // leaderboards: Leaderboard[];

    // @OneToMany(() => TrainingProgress, progress => progress.course)
    // trainingProgress: TrainingProgress[];

    constructor(partial: Partial<Course>) {
        Object.assign(this, partial);
    }
}
