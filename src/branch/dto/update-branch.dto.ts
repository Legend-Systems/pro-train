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
}
