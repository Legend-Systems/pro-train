import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEmail,
    IsObject,
    MinLength,
    ValidateNested,
    IsBoolean,
    IsEnum,
    IsNumber,
    IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BranchAddress, OperatingHours } from '../entities/branch.entity';
import { BranchWhiteLabelingConfig } from '../../org/interfaces/organization.interface';

/** Structured branch address fields from external systems. */
export class BranchAddressDto implements BranchAddress {
    @ApiProperty({ required: false, example: 'UNIT 20, VENTER CENTER' })
    @IsOptional()
    @IsString()
    street?: string;

    @ApiProperty({ required: false, example: 'CNR TRICHARDT & RIETFONTEIN RD' })
    @IsOptional()
    @IsString()
    suburb?: string;

    @ApiProperty({ required: false, example: 'HUGHES' })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false, example: 'BOKSBURG' })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty({ required: false, example: 'South Africa' })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({ required: false, example: '1459' })
    @IsOptional()
    @IsString()
    postalCode?: string;
}

// Branch-specific white labeling DTOs
export class BranchColorOverridesDto {
    @ApiProperty({
        description: 'Branch-specific accent color override',
        example: '#10b981',
        pattern: '^#[0-9A-Fa-f]{6}$',
        required: false,
    })
    @IsOptional()
    @IsString()
    accent?: string;

    @ApiProperty({
        description: 'Branch-specific sidebar colors',
        type: Object,
        example: { active: '#10b981' },
        required: false,
    })
    @IsOptional()
    @IsObject()
    sidebar?: {
        active?: string;
    };
}

export class BranchBrandingDto {
    @ApiProperty({
        description: 'Branch-specific logo URL',
        example: 'https://cdn.example.com/logos/downtown-branch.png',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchLogo?: string;

    @ApiProperty({
        description: 'Whether to show branch logo alongside organization logo',
        example: true,
        default: false,
    })
    @IsBoolean()
    showBranchLogo: boolean;

    @ApiProperty({
        description: 'Color overrides for branch-specific branding',
        type: BranchColorOverridesDto,
        required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => BranchColorOverridesDto)
    colorOverrides?: BranchColorOverridesDto;

    @ApiProperty({
        description: 'Branch-specific custom CSS',
        example: '.branch-header { border-left: 4px solid #10b981; }',
        required: false,
    })
    @IsOptional()
    @IsString()
    customBranchCss?: string;
}

export class BranchLocalizationDto {
    @ApiProperty({
        description: 'Branch-specific timezone override',
        example: 'America/Los_Angeles',
        required: false,
    })
    @IsOptional()
    @IsString()
    timezone?: string;

    @ApiProperty({
        description: 'Branch-specific region override',
        example: 'CA',
        pattern: '^[A-Z]{2}$',
        required: false,
    })
    @IsOptional()
    @IsString()
    region?: string;

    @ApiProperty({
        description: 'Branch-specific currency override',
        example: 'CAD',
        pattern: '^[A-Z]{3}$',
        required: false,
    })
    @IsOptional()
    @IsString()
    currency?: string;
}

export class BranchCustomMenuItemDto {
    @ApiProperty({
        description: 'Menu item label',
        example: 'Local Resources',
    })
    @IsString()
    label: string;

    @ApiProperty({
        description: 'Menu item URL',
        example: '/branch/resources',
    })
    @IsString()
    url: string;

    @ApiProperty({
        description: 'Icon for menu item (optional)',
        example: 'resource-icon',
        required: false,
    })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiProperty({
        description: 'Where to display the menu item',
        enum: ['header', 'sidebar', 'footer'],
        example: 'sidebar',
    })
    @IsEnum(['header', 'sidebar', 'footer'])
    position: 'header' | 'sidebar' | 'footer';

    @ApiProperty({
        description: 'Display order (lower numbers appear first)',
        example: 10,
    })
    @IsNumber()
    order: number;

    @ApiProperty({
        description: 'Roles that can see this menu item',
        example: ['admin', 'manager', 'user'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    visibleToRoles: string[];
}

export class BranchDashboardDto {
    @ApiProperty({
        description: 'Show branch-specific metrics in dashboard',
        example: true,
        default: true,
    })
    @IsBoolean()
    showBranchMetrics: boolean;

    @ApiProperty({
        description: 'Custom welcome message for branch users',
        example: 'Welcome to our Downtown Training Center!',
        required: false,
    })
    @IsOptional()
    @IsString()
    branchWelcomeMessage?: string;

    @ApiProperty({
        description: 'Branch-specific custom menu items',
        type: [BranchCustomMenuItemDto],
        required: false,
    })
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => BranchCustomMenuItemDto)
    customMenuItems?: BranchCustomMenuItemDto[];
}

export class BranchWhiteLabelingConfigDto implements BranchWhiteLabelingConfig {
    @ApiProperty({
        description: 'Branch-specific branding configuration',
        type: BranchBrandingDto,
        required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => BranchBrandingDto)
    branding?: BranchBrandingDto;

    @ApiProperty({
        description: 'Branch localization overrides',
        type: BranchLocalizationDto,
        required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => BranchLocalizationDto)
    localization?: BranchLocalizationDto;

    @ApiProperty({
        description: 'Branch dashboard customization',
        type: BranchDashboardDto,
        required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => BranchDashboardDto)
    dashboard?: BranchDashboardDto;
}

export class CreateBranchDto {
    @ApiProperty({
        description: 'External reference identifier for the branch',
        example: 'BR-REPLACE-002',
        required: false,
        type: String,
        title: 'Reference',
    })
    @IsOptional()
    @IsString({ message: 'Reference must be a string' })
    ref?: string | null;

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
        description: 'Physical address (plain string or structured object)',
        example: {
            street: 'UNIT 20, VENTER CENTER',
            suburb: 'CNR TRICHARDT & RIETFONTEIN RD',
            city: 'HUGHES',
            state: 'BOKSBURG',
            country: 'South Africa',
            postalCode: '1459',
        },
        required: false,
        title: 'Address',
    })
    @IsOptional()
    address?: string | BranchAddressDto | null;

    @ApiProperty({
        description: 'Branch website URL',
        example: 'https://replace-002.local',
        required: false,
        type: String,
        title: 'Website',
    })
    @IsOptional()
    @IsString({ message: 'Website must be a string' })
    website?: string | null;

    @ApiProperty({
        description: 'Short alias or code for the branch',
        example: 'BitBoksburg',
        required: false,
        type: String,
        title: 'Alias',
    })
    @IsOptional()
    @IsString({ message: 'Alias must be a string' })
    alias?: string | null;

    @ApiProperty({
        description: 'Branch country code or name',
        example: 'SA',
        required: false,
        type: String,
        title: 'Country',
    })
    @IsOptional()
    @IsString({ message: 'Country must be a string' })
    country?: string | null;

    @ApiProperty({
        description: 'Branch longitude coordinate',
        example: 28.235079,
        required: false,
        type: Number,
        title: 'Longitude',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Longitude must be a number' })
    longitude?: number | null;

    @ApiProperty({
        description: 'Branch latitude coordinate',
        example: -26.179577,
        required: false,
        type: Number,
        title: 'Latitude',
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber({}, { message: 'Latitude must be a number' })
    latitude?: number | null;

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

    @ApiProperty({
        description:
            'Branch-specific white labeling configuration to customize dashboard appearance',
        type: BranchWhiteLabelingConfigDto,
        required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => BranchWhiteLabelingConfigDto)
    whiteLabelingConfig?: BranchWhiteLabelingConfigDto;
}
