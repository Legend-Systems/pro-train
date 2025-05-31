import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl, MinLength } from 'class-validator';

export class CreateOrgDto {
    @ApiProperty({
        description: 'Organization name (must be unique across the system)',
        example: 'Acme Corporation',
        type: String,
        title: 'Organization Name',
        minLength: 2,
        maxLength: 255,
    })
    @IsString({ message: 'Organization name must be a string' })
    @MinLength(2, {
        message: 'Organization name must be at least 2 characters long',
    })
    name: string;

    @ApiProperty({
        description: 'Organization description or mission statement',
        example:
            'Leading technology company specializing in innovative solutions',
        required: false,
        type: String,
        title: 'Description',
        maxLength: 1000,
    })
    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    description?: string;

    @ApiProperty({
        description: 'Organization logo image URL',
        example: 'https://cdn.example.com/logos/acme-corp.png',
        required: false,
        type: String,
        title: 'Logo URL',
        format: 'url',
    })
    @IsOptional()
    @IsUrl({}, { message: 'Logo URL must be a valid URL' })
    logoUrl?: string;

    @ApiProperty({
        description: 'Organization official website URL',
        example: 'https://www.acmecorp.com',
        required: false,
        type: String,
        title: 'Website URL',
        format: 'url',
    })
    @IsOptional()
    @IsUrl({}, { message: 'Website must be a valid URL' })
    website?: string;
}
