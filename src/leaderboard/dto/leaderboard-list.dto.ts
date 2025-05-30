import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, IsDate, ValidateNested } from 'class-validator';

export class LeaderboardEntryDto {
    @ApiProperty({
        description: 'Leaderboard entry ID',
        example: 1,
    })
    @IsNumber()
    leaderboardId: number;

    @ApiProperty({
        description: 'User ID',
        example: 'user-123',
    })
    @IsString()
    userId: string;

    @ApiProperty({
        description: 'User first name',
        example: 'John',
    })
    @IsString()
    firstName: string;

    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    @IsString()
    lastName: string;

    @ApiProperty({
        description: 'User email',
        example: 'john.doe@example.com',
    })
    @IsString()
    email: string;

    @ApiProperty({
        description: 'Total score accumulated',
        example: 450,
    })
    @IsNumber()
    totalScore: number;

    @ApiProperty({
        description: 'Current rank in the course',
        example: 3,
    })
    @IsNumber()
    rank: number;

    @ApiProperty({
        description: 'Previous rank (for comparison)',
        example: 5,
    })
    @IsNumber()
    previousRank: number;

    @ApiProperty({
        description: 'Rank change (+/- from previous)',
        example: 2,
    })
    @IsNumber()
    rankChange: number;

    @ApiProperty({
        description: 'Number of tests completed',
        example: 8,
    })
    @IsNumber()
    testsCompleted: number;

    @ApiProperty({
        description: 'Average score across all tests',
        example: 85.5,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Last activity date',
        example: '2024-01-15T14:30:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    lastUpdated: Date;

    @ApiProperty({
        description:
            'Achievement level (beginner/intermediate/advanced/expert)',
        example: 'intermediate',
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    })
    @IsString()
    achievementLevel: string;
}

export class LeaderboardMetaDto {
    @ApiProperty({
        description: 'Course ID',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'Course title',
        example: 'Web Development Bootcamp',
    })
    @IsString()
    courseTitle: string;

    @ApiProperty({
        description: 'Total number of participants',
        example: 150,
    })
    @IsNumber()
    totalParticipants: number;

    @ApiProperty({
        description: 'Number of active participants (recent activity)',
        example: 120,
    })
    @IsNumber()
    activeParticipants: number;

    @ApiProperty({
        description: 'Average score across all participants',
        example: 75.2,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Highest score achieved',
        example: 98.5,
    })
    @IsNumber()
    topScore: number;

    @ApiProperty({
        description: 'Last leaderboard update',
        example: '2024-01-16T02:00:00.000Z',
    })
    @IsDate()
    @Type(() => Date)
    lastUpdated: Date;

    @ApiProperty({
        description: 'Competition period (week/month/all-time)',
        example: 'all-time',
        enum: ['week', 'month', 'all-time'],
    })
    @IsString()
    period: string;
}

export class LeaderboardListDto {
    @ApiProperty({
        description: 'Array of leaderboard entries',
        type: [LeaderboardEntryDto],
    })
    @ValidateNested({ each: true })
    @Type(() => LeaderboardEntryDto)
    entries: LeaderboardEntryDto[];

    @ApiProperty({
        description: 'Leaderboard metadata',
        type: LeaderboardMetaDto,
    })
    @ValidateNested()
    @Type(() => LeaderboardMetaDto)
    metadata: LeaderboardMetaDto;

    @ApiProperty({
        description: 'Total number of entries',
        example: 150,
    })
    @IsNumber()
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    @IsNumber()
    page: number;

    @ApiProperty({
        description: 'Number of entries per page',
        example: 20,
    })
    @IsNumber()
    limit: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 8,
    })
    @IsNumber()
    totalPages: number;

    @ApiProperty({
        description: 'Whether there is a next page',
        example: true,
    })
    hasNext: boolean;

    @ApiProperty({
        description: 'Whether there is a previous page',
        example: false,
    })
    hasPrevious: boolean;
}
