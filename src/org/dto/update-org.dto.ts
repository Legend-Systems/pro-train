import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOrgDto } from './create-org.dto';

export class UpdateOrgDto extends PartialType(CreateOrgDto) {
    @ApiProperty({
        description: 'Organization active status (enable/disable organization)',
        example: true,
        required: false,
        type: Boolean,
        title: 'Active Status',
    })
    @IsOptional()
    @IsBoolean({ message: 'Active status must be a boolean' })
    isActive?: boolean;
}
