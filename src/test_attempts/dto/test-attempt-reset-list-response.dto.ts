import { ApiProperty } from '@nestjs/swagger';
import { TestAttemptResetResponseDto } from './test-attempt-reset-response.dto';

/** Paginated audit history of attempt resets. */
export class TestAttemptResetListResponseDto {
    @ApiProperty({
        description: 'Reset records for the requested page',
        type: [TestAttemptResetResponseDto],
    })
    resets: TestAttemptResetResponseDto[];

    @ApiProperty({
        description: 'Total number of reset records matching the filters',
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
        example: 20,
    })
    limit: number;
}
