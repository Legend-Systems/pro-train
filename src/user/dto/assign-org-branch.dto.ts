import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class AssignOrgBranchDto {
    @ApiProperty({
        description: 'Organization ID to assign to the user',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Organization ID must be a string' })
    orgId?: string;

    @ApiProperty({
        description: 'Branch ID to assign to the user',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Branch ID must be a string' })
    branchId?: string;
}
