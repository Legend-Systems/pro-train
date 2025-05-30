import { ApiProperty } from '@nestjs/swagger';
import { TestAttemptResponseDto } from './test-attempt-response.dto';

export class TestAttemptListResponseDto {
    @ApiProperty({
        description: 'Array of test attempts',
        type: [TestAttemptResponseDto],
    })
    attempts: TestAttemptResponseDto[];

    @ApiProperty({
        description: 'Total number of attempts',
        example: 25,
    })
    total: number;

    @ApiProperty({
        description: 'Current page number',
        example: 1,
    })
    page: number;

    @ApiProperty({
        description: 'Number of items per page',
        example: 10,
    })
    pageSize: number;

    @ApiProperty({
        description: 'Total number of pages',
        example: 3,
    })
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
