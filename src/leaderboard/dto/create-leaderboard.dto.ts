import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsOptional } from 'class-validator';

export class CreateLeaderboardDto {
    @ApiProperty({
        description: 'Course ID for this leaderboard entry',
        example: 1,
    })
    @IsNumber()
    courseId: number;

    @ApiProperty({
        description: 'User ID for this leaderboard entry',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    userId: string;

    @ApiProperty({
        description: 'User rank in the course leaderboard',
        example: 1,
        minimum: 1,
    })
    @IsNumber()
    rank: number;

    @ApiProperty({
        description: 'Average score across all tests in the course',
        example: 92.5,
        minimum: 0,
        maximum: 100,
    })
    @IsNumber()
    averageScore: number;

    @ApiProperty({
        description: 'Total number of tests completed in the course',
        example: 5,
        minimum: 0,
    })
    @IsNumber()
    testsCompleted: number;

    @ApiProperty({
        description: 'Total points earned across all tests',
        example: 462.5,
        minimum: 0,
    })
    @IsNumber()
    totalPoints: number;

    @ApiProperty({
        description: 'Organization ID for this leaderboard entry',
        example: 1,
    })
    @IsNumber()
    orgId: number;

    @ApiProperty({
        description: 'Branch ID for this leaderboard entry',
        example: 1,
        required: false,
    })
    @IsNumber()
    @IsOptional()
    branchId?: number;
}
