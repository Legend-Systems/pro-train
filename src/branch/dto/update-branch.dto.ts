import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateBranchDto } from './create-branch.dto';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
    @ApiProperty({
        description: 'Branch active status (enable/disable branch)',
        example: true,
        required: false,
        type: Boolean,
        title: 'Active Status',
    })
    @IsOptional()
    @IsBoolean({ message: 'Active status must be a boolean' })
    isActive?: boolean;

    @ApiProperty({
        description: 'Soft-delete flag from external systems',
        example: false,
        required: false,
        type: Boolean,
        title: 'Deleted Status',
    })
    @IsOptional()
    @IsBoolean({ message: 'Deleted status must be a boolean' })
    isDeleted?: boolean;

    @ApiProperty({
        description: 'Timestamp when the branch was soft-deleted',
        example: '2025-01-01T00:00:00.000Z',
        required: false,
        type: String,
        format: 'date-time',
        title: 'Deleted At',
    })
    @IsOptional()
    deletedAt?: Date | null;
}
