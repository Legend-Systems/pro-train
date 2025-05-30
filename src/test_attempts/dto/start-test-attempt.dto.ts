import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class StartTestAttemptDto {
    @ApiProperty({
        description: 'Test ID to start an attempt for',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    testId: number;
}
