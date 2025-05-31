import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsObject, MinLength } from 'class-validator';
import { OperatingHours } from '../entities/branch.entity';

export class CreateBranchDto {
    @ApiProperty({
        description: 'Branch name within the organization',
        example: 'Downtown Branch',
        type: String,
        title: 'Branch Name',
        minLength: 2,
        maxLength: 255,
    })
    @IsString({ message: 'Branch name must be a string' })
    @MinLength(2, { message: 'Branch name must be at least 2 characters long' })
    name: string;

    @ApiProperty({
        description: 'Physical address of the branch location',
        example: '123 Main Street, Downtown, City 12345',
        required: false,
        type: String,
        title: 'Address',
        maxLength: 500,
    })
    @IsOptional()
    @IsString({ message: 'Address must be a string' })
    address?: string;

    @ApiProperty({
        description: 'Branch contact phone number',
        example: '+1-555-123-4567',
        required: false,
        type: String,
        title: 'Contact Number',
        maxLength: 20,
    })
    @IsOptional()
    @IsString({ message: 'Contact number must be a string' })
    contactNumber?: string;

    @ApiProperty({
        description: 'Branch email address for communication',
        example: 'downtown@acmecorp.com',
        required: false,
        type: String,
        title: 'Email Address',
        format: 'email',
    })
    @IsOptional()
    @IsEmail({}, { message: 'Email must be a valid email address' })
    email?: string;

    @ApiProperty({
        description: 'Name of the branch manager or person in charge',
        example: 'John Smith',
        required: false,
        type: String,
        title: 'Manager Name',
        maxLength: 100,
    })
    @IsOptional()
    @IsString({ message: 'Manager name must be a string' })
    managerName?: string;

    @ApiProperty({
        description: 'Branch operating hours and days',
        example: {
            opening: '09:00',
            closing: '17:00',
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        required: false,
        type: Object,
        title: 'Operating Hours',
    })
    @IsOptional()
    @IsObject({ message: 'Operating hours must be an object' })
    operatingHours?: OperatingHours;
}
