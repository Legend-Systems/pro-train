import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { Branch } from '../../branch/entities/branch.entity';
import { WhiteLabelingConfig } from '../interfaces/organization.interface';

@Entity('organizations')
@Index('IDX_ORG_NAME', ['name'])
@Index('IDX_ORG_ACTIVE', ['isActive'])
@Index('IDX_ORG_CREATED_AT', ['createdAt'])
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'Organization unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    id: string;

    @Column({ unique: true })
    @ApiProperty({
        description: 'Organization name (must be unique)',
        example: 'Acme Corporation',
    })
    @IsString({ message: 'Organization name must be a string' })
    name: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Organization description',
        example:
            'Leading technology company specializing in innovative solutions',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    description?: string;

    @Column({ default: true })
    @ApiProperty({
        description: 'Organization active status',
        example: true,
        default: true,
    })
    @IsBoolean({ message: 'Active status must be a boolean' })
    isActive: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    @ApiProperty({
        description: 'Organization creation date',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @Column({ nullable: true })
    @ApiProperty({
        description:
            'Organization logo URL (legacy field - use whiteLabelingConfig for comprehensive branding)',
        example: 'https://cdn.example.com/logos/acme-corp.png',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'Logo URL must be a valid URL' })
    logoUrl?: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Organization website URL',
        example: 'https://www.acmecorp.com',
        required: false,
    })
    @IsOptional()
    @IsUrl({}, { message: 'Website must be a valid URL' })
    website?: string;

    @Column({ nullable: false, unique: true })
    @ApiProperty({
        description: 'Organization email',
        example: 'info@acmecorp.com',
        required: false,
    })
    email?: string;

    @Column({ type: 'json', nullable: true })
    @ApiProperty({
        description:
            'Comprehensive white labeling configuration for dashboard customization',
        example: {
            branding: {
                primaryLogo: 'https://cdn.example.com/logo-primary.png',
                colors: {
                    primary: '#1e40af',
                    secondary: '#3b82f6',
                    accent: '#10b981',
                    background: '#ffffff',
                    surface: '#f8fafc',
                    text: {
                        primary: '#1f2937',
                        secondary: '#6b7280',
                        muted: '#9ca3af',
                    },
                    sidebar: {
                        background: '#1f2937',
                        text: '#f9fafb',
                        active: '#3b82f6',
                        hover: '#374151',
                    },
                    header: {
                        background: '#ffffff',
                        text: '#1f2937',
                        border: '#e5e7eb',
                    },
                },
                theme: {
                    mode: 'light',
                    allowUserToggle: true,
                    roundedCorners: 'medium',
                    fontSize: 'medium',
                },
            },
            localization: {
                defaultLanguage: 'en',
                supportedLanguages: ['en', 'es', 'fr'],
                allowUserLanguageChange: true,
                region: 'US',
                timezone: 'America/New_York',
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h',
                currency: 'USD',
                numberFormat: { decimal: '.', thousands: ',' },
            },
            dashboard: {
                layout: 'sidebar',
                sidebarCollapsible: true,
                showBreadcrumbs: true,
                showOrganizationName: true,
                showBranchName: true,
                organizationNamePosition: 'header',
                features: {
                    darkModeToggle: true,
                    languageSelector: true,
                    profileMenu: true,
                    notifications: true,
                    search: true,
                    help: true,
                },
            },
            authentication: {
                showPoweredBy: true,
            },
        },
        required: false,
    })
    @IsOptional()
    whiteLabelingConfig?: WhiteLabelingConfig;

    @OneToMany(() => Branch, branch => branch.organization)
    @ApiProperty({
        description: 'Organization branches',
        type: () => [Branch],
        required: false,
    })
    branches?: Branch[];

    constructor(partial: Partial<Organization>) {
        Object.assign(this, partial);
    }
}
