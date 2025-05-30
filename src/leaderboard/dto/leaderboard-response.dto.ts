import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

class UserInfo {
    @ApiProperty({
        description: 'User ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    id: string;

    @ApiProperty({
        description: 'Username',
        example: 'johndoe',
    })
    @Expose()
    username: string;

    @ApiProperty({
        description: 'User full name',
        example: 'John Doe',
    })
    @Expose()
    fullName: string;
}

class CourseInfo {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Advanced Mathematics',
    })
    @Expose()
    title: string;

    @ApiProperty({
        description: 'Course description',
        example: 'Advanced mathematics course covering calculus and algebra',
    })
    @Expose()
    description: string;
}

export class LeaderboardResponseDto {
    @ApiProperty({
        description: 'Leaderboard entry unique identifier',
        example: 1,
    })
    @Expose()
    leaderboardId: number;

    @ApiProperty({
        description: 'Course ID for this leaderboard entry',
        example: 1,
    })
    @Expose()
    courseId: number;

    @ApiProperty({
        description: 'User ID for this leaderboard entry',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @Expose()
    userId: string;

    @ApiProperty({
        description: 'User rank in the course leaderboard',
        example: 1,
        minimum: 1,
    })
    @Expose()
    rank: number;

    @ApiProperty({
        description: 'Average score across all tests in the course',
        example: 92.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    averageScore: number;

    @ApiProperty({
        description: 'Total number of tests completed in the course',
        example: 5,
        minimum: 0,
    })
    @Expose()
    testsCompleted: number;

    @ApiProperty({
        description: 'Total points earned across all tests',
        example: 462.5,
        minimum: 0,
    })
    @Expose()
    totalPoints: number;

    @ApiProperty({
        description: 'When the leaderboard entry was last updated',
        example: '2024-01-01T12:00:00.000Z',
    })
    @Expose()
    lastUpdated: Date;

    @ApiProperty({
        description: 'Leaderboard entry creation timestamp',
        example: '2024-01-01T09:00:00.000Z',
    })
    @Expose()
    createdAt: Date;

    @ApiProperty({
        description: 'Leaderboard entry last update timestamp',
        example: '2024-01-01T12:00:00.000Z',
    })
    @Expose()
    updatedAt: Date;

    @ApiProperty({
        description: 'User information',
        type: UserInfo,
    })
    @Expose()
    user: UserInfo;

    @ApiProperty({
        description: 'Course information',
        type: CourseInfo,
    })
    @Expose()
    course: CourseInfo;
} 