import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
    IsString,
    IsBoolean,
    IsOptional,
    IsEmail,
    IsObject,
    IsNumber,
} from 'class-validator';
import { Organization } from '../../org/entities/org.entity';
import { BranchWhiteLabelingConfig } from '../../org/interfaces/organization.interface';

export interface OperatingHours {
    opening: string;
    closing: string;
    days: string[];
}

/** Structured branch address from external systems or manual entry. */
export interface BranchAddress {
    street?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

/** Formats a branch address for display or event payloads. */
export function formatBranchAddress(
    address?: string | BranchAddress | null,
): string | undefined {
    if (address == null) {
        return undefined;
    }

    if (typeof address === 'string') {
        return address;
    }

    const parts = [
        address.street,
        address.suburb,
        address.city,
        address.state,
        address.country,
        address.postalCode,
    ].filter((part): part is string => Boolean(part?.trim()));

    return parts.length > 0 ? parts.join(', ') : undefined;
}

@Entity('branches')
@Index('IDX_BRANCH_NAME', ['name'])
@Index('IDX_BRANCH_ACTIVE', ['isActive'])
@Index('IDX_BRANCH_ORG', ['organization'])
@Index('IDX_BRANCH_CREATED_AT', ['createdAt'])
@Index('IDX_BRANCH_REF', ['ref'])
export class Branch {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    id: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    @ApiProperty({
        description: 'External reference identifier for the branch',
        example: 'BR-REPLACE-002',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Reference must be a string' })
    ref?: string | null;

    @Column()
    @ApiProperty({
        description: 'Branch name',
        example: 'Downtown Branch',
    })
    @IsString({ message: 'Branch name must be a string' })
    name: string;

    @Column({ type: 'json', nullable: true })
    @ApiProperty({
        description: 'Branch address (plain string or structured object)',
        example: {
            street: 'UNIT 20, VENTER CENTER',
            suburb: 'CNR TRICHARDT & RIETFONTEIN RD',
            city: 'HUGHES',
            state: 'BOKSBURG',
            country: 'South Africa',
            postalCode: '1459',
        },
        required: false,
    })
    @IsOptional()
    address?: string | BranchAddress | null;

    @Column({ type: 'varchar', length: 2048, nullable: true })
    @ApiProperty({
        description: 'Branch website URL',
        example: 'https://replace-002.local',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Website must be a string' })
    website?: string | null;

    @Column({ nullable: false, unique: true })
    @ApiProperty({
        description: 'Branch email address',
        example: 'downtown@acmecorp.com',
        required: false,
    })
    @IsEmail({}, { message: 'Email must be a valid email address' })
    email?: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Branch contact phone number',
        example: '+1-555-123-4567',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Contact number must be a string' })
    contactNumber?: string;

    @Column({ default: true })
    @ApiProperty({
        description: 'Branch active status',
        example: true,
        default: true,
    })
    @IsBoolean({ message: 'Active status must be a boolean' })
    isActive: boolean;

    @Column({ type: 'boolean', default: false })
    @ApiProperty({
        description: 'Soft-delete flag from external systems',
        example: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean({ message: 'Deleted status must be a boolean' })
    isDeleted?: boolean;

    @Column({ type: 'timestamp', nullable: true })
    @ApiProperty({
        description: 'Timestamp when the branch was soft-deleted',
        example: '2025-01-01T00:00:00.000Z',
        required: false,
    })
    deletedAt?: Date | null;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    @ApiProperty({
        description: 'Branch creation date',
        example: '2025-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @Column({ type: 'varchar', length: 255, nullable: true })
    @ApiProperty({
        description: 'Short alias or code for the branch',
        example: 'BitBoksburg',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Alias must be a string' })
    alias?: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    @ApiProperty({
        description: 'Branch country code or name',
        example: 'SA',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Country must be a string' })
    country?: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    @ApiProperty({
        description: 'Branch longitude coordinate',
        example: 28.235079,
        required: false,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Longitude must be a number' })
    longitude?: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    @ApiProperty({
        description: 'Branch latitude coordinate',
        example: -26.179577,
        required: false,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Latitude must be a number' })
    latitude?: number | null;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Branch manager name',
        example: 'John Smith',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Manager name must be a string' })
    managerName?: string;

    @Column({ type: 'json', nullable: true })
    @ApiProperty({
        description: 'Branch operating hours',
        example: {
            opening: '09:00',
            closing: '17:00',
            days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        required: false,
    })
    @IsOptional()
    @IsObject({ message: 'Operating hours must be an object' })
    operatingHours?: OperatingHours;

    @Column({ type: 'json', nullable: true })
    @ApiProperty({
        description:
            'Branch-specific white labeling configuration for dashboard customization',
        required: false,
    })
    @IsOptional()
    whiteLabelingConfig?: BranchWhiteLabelingConfig;

    @ManyToOne(() => Organization, organization => organization.branches)
    @ApiProperty({
        description: 'Organization this branch belongs to',
        type: () => Organization,
    })
    organization: Organization;

    constructor(partial: Partial<Branch>) {
        Object.assign(this, partial);
    }
}
