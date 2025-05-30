import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { LeaderboardResponseDto } from './leaderboard-response.dto';

export class UserStatsResponseDto {
    @ApiProperty({
        description: 'Total points earned across all courses',
        example: 1250.75,
        minimum: 0,
    })
    @Expose()
    totalPoints: number;

    @ApiProperty({
        description: 'Total number of tests completed across all courses',
        example: 15,
        minimum: 0,
    })
    @Expose()
    totalTestsCompleted: number;

    @ApiProperty({
        description: 'Overall average score across all tests',
        example: 88.5,
        minimum: 0,
        maximum: 100,
    })
    @Expose()
    averageScore: number;

    @ApiProperty({
        description: 'Number of courses the user is enrolled in',
        example: 3,
        minimum: 0,
    })
    @Expose()
    coursesEnrolled: number;

    @ApiProperty({
        description: 'Best rank achieved across all courses',
        example: 2,
        minimum: 1,
        nullable: true,
    })
    @Expose()
    bestRank: number | null;

    @ApiProperty({
        description: 'Recent activity in the last 5 courses',
        type: [LeaderboardResponseDto],
        isArray: true,
    })
    @Expose()
    recentActivity: LeaderboardResponseDto[];
}
