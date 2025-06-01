import { ApiProperty } from '@nestjs/swagger';

export class TestAttemptStatsDto {
    @ApiProperty({
        description: 'Total number of attempts',
        example: 150,
    })
    totalAttempts: number;

    @ApiProperty({
        description: 'Number of completed attempts',
        example: 120,
    })
    completedAttempts: number;

    @ApiProperty({
        description: 'Number of in-progress attempts',
        example: 25,
    })
    inProgressAttempts: number;

    @ApiProperty({
        description: 'Number of expired attempts',
        example: 5,
    })
    expiredAttempts: number;

    @ApiProperty({
        description: 'Average completion time in minutes',
        example: 45.5,
    })
    averageCompletionTime: number;

    @ApiProperty({
        description: 'Average progress percentage',
        example: 85.2,
    })
    averageProgress: number;

    @ApiProperty({
        description: 'Completion rate percentage',
        example: 80.0,
    })
    completionRate: number;

    @ApiProperty({
        description: 'Most recent attempt date',
        example: '2025-01-15T10:30:00.000Z',
    })
    lastAttemptDate: Date;

    @ApiProperty({
        description: 'Statistics by status',
        example: {
            in_progress: 25,
            submitted: 120,
            expired: 5,
            cancelled: 0,
        },
    })
    statusBreakdown: Record<string, number>;
}
