import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus, UserRole } from '../entities/user.entity';

export class UserFilterDto {
    @ApiProperty({
        description: 'Search term for filtering users by name or email',
        required: false,
        example: 'john',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({
        description: 'Filter users by status',
        required: false,
        enum: UserStatus,
        example: UserStatus.ACTIVE,
    })
    @IsOptional()
    @IsEnum(UserStatus)
    status?: UserStatus;

    @ApiProperty({
        description: 'Filter users by role',
        required: false,
        enum: UserRole,
        example: UserRole.USER,
    })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;

    @ApiProperty({
        description: 'Page number for pagination',
        required: false,
        minimum: 1,
        default: 1,
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'Number of items per page',
        required: false,
        minimum: 1,
        maximum: 100,
        default: 20,
        example: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 20;

    @ApiProperty({
        description: 'Filter by specific organization ID',
        required: false,
        example: 'org-123',
    })
    @IsOptional()
    @IsString()
    orgId?: string;

    @ApiProperty({
        description: 'Filter by specific branch ID',
        required: false,
        example: 'branch-456',
    })
    @IsOptional()
    @IsString()
    branchId?: string;
}
