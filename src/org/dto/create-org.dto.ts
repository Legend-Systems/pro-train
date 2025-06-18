import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsUrl,
    MinLength,
    IsObject,
    ValidateNested,
    IsArray,
    IsEnum,
    IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WhiteLabelingConfig } from '../interfaces/organization.interface';

// White Labeling DTOs
export class BrandingColorsDto {
    @ApiProperty({
        description: 'Primary brand color in hex format',
        example: '#1e40af',
        pattern: '^#[0-9A-Fa-f]{6}$',
    })
    @IsString()
    primary: string;

    @ApiProperty({
        description: 'Secondary brand color in hex format',
        example: '#3b82f6',
        pattern: '^#[0-9A-Fa-f]{6}$',
    })
    @IsString()
    secondary: string;

    @ApiProperty({
        description: 'Accent color for highlights in hex format',
        example: '#10b981',
        pattern: '^#[0-9A-Fa-f]{6}$',
    })
    @IsString()
    accent: string;

    @ApiProperty({
        description: 'Main background color in hex format',
        example: '#ffffff',
        pattern: '^#[0-9A-Fa-f]{6}$',
    })
    @IsString()
    background: string;

    @ApiProperty({
        description: 'Card/surface background color in hex format',
        example: '#f8fafc',
        pattern: '^#[0-9A-Fa-f]{6}$',
    })
    @IsString()
    surface: string;

    @ApiProperty({
        description: 'Text colors configuration',
        type: Object,
        example: {
            primary: '#1f2937',
            secondary: '#6b7280',
            muted: '#9ca3af',
        },
    })
    @IsObject()
    text: {
        primary: string;
        secondary: string;
        muted: string;
    };

    @ApiProperty({
        description: 'Sidebar colors configuration',
        type: Object,
        example: {
            background: '#1f2937',
            text: '#f9fafb',
            active: '#3b82f6',
            hover: '#374151',
        },
    })
    @IsObject()
    sidebar: {
        background: string;
        text: string;
        active: string;
        hover: string;
    };

    @ApiProperty({
        description: 'Header colors configuration',
        type: Object,
        example: {
            background: '#ffffff',
            text: '#1f2937',
            border: '#e5e7eb',
        },
    })
    @IsObject()
    header: {
        background: string;
        text: string;
        border: string;
    };
}

export class BrandingThemeDto {
    @ApiProperty({
        description: 'Default theme mode',
        enum: ['light', 'dark', 'auto'],
        example: 'light',
    })
    @IsEnum(['light', 'dark', 'auto'])
    mode: 'light' | 'dark' | 'auto';

    @ApiProperty({
        description: 'Allow users to toggle between themes',
        example: true,
    })
    @IsBoolean()
    allowUserToggle: boolean;

    @ApiProperty({
        description: 'Border radius style for UI elements',
        enum: ['none', 'small', 'medium', 'large'],
        example: 'medium',
    })
    @IsEnum(['none', 'small', 'medium', 'large'])
    roundedCorners: 'none' | 'small' | 'medium' | 'large';

    @ApiProperty({
        description: 'Base font size for the interface',
        enum: ['small', 'medium', 'large'],
        example: 'medium',
    })
    @IsEnum(['small', 'medium', 'large'])
    fontSize: 'small' | 'medium' | 'large';
}

export class BrandingConfigDto {
    @ApiProperty({
        description: 'Primary logo URL for header and login page',
        example: 'https://cdn.example.com/logos/primary-logo.png',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'Primary logo must be a valid URL' })
    primaryLogo?: string;

    @ApiProperty({
        description: 'Secondary logo URL for sidebar and compact views',
        example: 'https://cdn.example.com/logos/secondary-logo.png',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'Secondary logo must be a valid URL' })
    secondaryLogo?: string;

    @ApiProperty({
        description: 'Favicon URL for browser tab',
        example: 'https://cdn.example.com/favicon.ico',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'Favicon URL must be a valid URL' })
    faviconUrl?: string;

    @ApiProperty({
        description: 'Logo position in header',
        enum: ['left', 'center', 'right'],
        example: 'left',
        required: false,
    })
    @IsOptional()
    @IsEnum(['left', 'center', 'right'])
    logoPosition?: 'left' | 'center' | 'right';

    @ApiProperty({
        description: 'Brand color scheme configuration',
        type: BrandingColorsDto,
    })
    @ValidateNested()
    @Type(() => BrandingColorsDto)
    colors: BrandingColorsDto;

    @ApiProperty({
        description: 'Theme configuration',
        type: BrandingThemeDto,
    })
    @ValidateNested()
    @Type(() => BrandingThemeDto)
    theme: BrandingThemeDto;

    @ApiProperty({
        description: 'Custom CSS for advanced styling',
        example:
            '.custom-header { background: linear-gradient(45deg, #667eea 0%, #764ba2 100%); }',
        required: false,
    })
    @IsOptional()
    @IsString()
    customCss?: string;
}

export class LocalizationConfigDto {
    @ApiProperty({
        description: 'Default language (ISO 639-1 code)',
        example: 'en',
        pattern: '^[a-z]{2}$',
    })
    @IsString()
    defaultLanguage: string;

    @ApiProperty({
        description: 'Supported languages (ISO 639-1 codes)',
        example: ['en', 'es', 'fr', 'de'],
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    supportedLanguages: string[];

    @ApiProperty({
        description: 'Allow users to change language',
        example: true,
    })
    @IsBoolean()
    allowUserLanguageChange: boolean;

    @ApiProperty({
        description: 'Country/region (ISO 3166-1 alpha-2 code)',
        example: 'US',
        pattern: '^[A-Z]{2}$',
    })
    @IsString()
    region: string;

    @ApiProperty({
        description: 'Timezone (IANA timezone identifier)',
        example: 'America/New_York',
    })
    @IsString()
    timezone: string;

    @ApiProperty({
        description: 'Date format pattern',
        example: 'MM/DD/YYYY',
    })
    @IsString()
    dateFormat: string;

    @ApiProperty({
        description: 'Time format preference',
        enum: ['12h', '24h'],
        example: '12h',
    })
    @IsEnum(['12h', '24h'])
    timeFormat: '12h' | '24h';

    @ApiProperty({
        description: 'Currency code (ISO 4217)',
        example: 'USD',
        pattern: '^[A-Z]{3}$',
    })
    @IsString()
    currency: string;

    @ApiProperty({
        description: 'Number format configuration',
        example: { decimal: '.', thousands: ',' },
        type: Object,
    })
    @IsObject()
    numberFormat: {
        decimal: string;
        thousands: string;
    };
}

export class DashboardFeaturesDto {
    @ApiProperty({ description: 'Show dark mode toggle', example: true })
    @IsBoolean()
    darkModeToggle: boolean;

    @ApiProperty({ description: 'Show language selector', example: true })
    @IsBoolean()
    languageSelector: boolean;

    @ApiProperty({ description: 'Show user profile menu', example: true })
    @IsBoolean()
    profileMenu: boolean;

    @ApiProperty({ description: 'Show notifications bell', example: true })
    @IsBoolean()
    notifications: boolean;

    @ApiProperty({ description: 'Show global search', example: true })
    @IsBoolean()
    search: boolean;

    @ApiProperty({ description: 'Show help/support links', example: true })
    @IsBoolean()
    help: boolean;
}

export class DashboardConfigDto {
    @ApiProperty({
        description: 'Main navigation layout',
        enum: ['sidebar', 'topbar', 'hybrid'],
        example: 'sidebar',
    })
    @IsEnum(['sidebar', 'topbar', 'hybrid'])
    layout: 'sidebar' | 'topbar' | 'hybrid';

    @ApiProperty({
        description: 'Allow sidebar to be collapsible',
        example: true,
    })
    @IsBoolean()
    sidebarCollapsible: boolean;

    @ApiProperty({
        description: 'Show navigation breadcrumbs',
        example: true,
    })
    @IsBoolean()
    showBreadcrumbs: boolean;

    @ApiProperty({
        description: 'Display organization name in header',
        example: true,
    })
    @IsBoolean()
    showOrganizationName: boolean;

    @ApiProperty({
        description: 'Display branch name in header',
        example: true,
    })
    @IsBoolean()
    showBranchName: boolean;

    @ApiProperty({
        description: 'Where to show organization name',
        enum: ['header', 'sidebar', 'both'],
        example: 'header',
    })
    @IsEnum(['header', 'sidebar', 'both'])
    organizationNamePosition: 'header' | 'sidebar' | 'both';

    @ApiProperty({
        description: 'Dashboard feature visibility',
        type: DashboardFeaturesDto,
    })
    @ValidateNested()
    @Type(() => DashboardFeaturesDto)
    features: DashboardFeaturesDto;
}

export class AuthenticationConfigDto {
    @ApiProperty({
        description: 'Logo for login page',
        example: 'https://cdn.example.com/logos/login-logo.png',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'Login logo must be a valid URL' })
    loginLogo?: string;

    @ApiProperty({
        description: 'Background image/color for login page',
        example: 'https://cdn.example.com/backgrounds/login-bg.jpg',
        required: false,
    })
    @IsOptional()
    @IsString()
    loginBackground?: string;

    @ApiProperty({
        description: 'Custom welcome message for login page',
        example: 'Welcome to Acme Corp Training Portal',
        required: false,
    })
    @IsOptional()
    @IsString()
    loginWelcomeMessage?: string;

    @ApiProperty({
        description: 'Show "Powered by TrainPro" text',
        example: true,
    })
    @IsBoolean()
    showPoweredBy: boolean;

    @ApiProperty({
        description: 'Custom footer text',
        example: '© 2025 Acme Corporation. All rights reserved.',
        required: false,
    })
    @IsOptional()
    @IsString()
    customFooterText?: string;
}

export class WhiteLabelingConfigDto implements WhiteLabelingConfig {
    @ApiProperty({
        description: 'Visual branding configuration',
        type: BrandingConfigDto,
    })
    @ValidateNested()
    @Type(() => BrandingConfigDto)
    branding: BrandingConfigDto;

    @ApiProperty({
        description: 'Localization and regional settings',
        type: LocalizationConfigDto,
    })
    @ValidateNested()
    @Type(() => LocalizationConfigDto)
    localization: LocalizationConfigDto;

    @ApiProperty({
        description: 'Dashboard layout and features',
        type: DashboardConfigDto,
    })
    @ValidateNested()
    @Type(() => DashboardConfigDto)
    dashboard: DashboardConfigDto;

    @ApiProperty({
        description: 'Authentication and login customization',
        type: AuthenticationConfigDto,
    })
    @ValidateNested()
    @Type(() => AuthenticationConfigDto)
    authentication: AuthenticationConfigDto;
}

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
        description:
            'Organization logo image URL (legacy field - use whiteLabelingConfig for comprehensive branding)',
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

    @ApiProperty({
        description:
            'Comprehensive white labeling configuration for dashboard customization',
        type: WhiteLabelingConfigDto,
        required: false,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => WhiteLabelingConfigDto)
    whiteLabelingConfig?: WhiteLabelingConfigDto;
}
