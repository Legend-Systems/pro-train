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
} from 'class-validator';
import { Organization } from '../../org/entities/org.entity';

export interface OperatingHours {
    opening: string;
    closing: string;
    days: string[];
}

@Entity('branches')
@Index('IDX_BRANCH_NAME', ['name'])
@Index('IDX_BRANCH_ACTIVE', ['isActive'])
@Index('IDX_BRANCH_ORG', ['organization'])
@Index('IDX_BRANCH_CREATED_AT', ['createdAt'])
export class Branch {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'Branch unique identifier',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
    })
    id: string;

    @Column()
    @ApiProperty({
        description: 'Branch name',
        example: 'Downtown Branch',
    })
    @IsString({ message: 'Branch name must be a string' })
    name: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Branch address',
        example: '123 Main Street, Downtown, City 12345',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Address must be a string' })
    address?: string;

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

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    @ApiProperty({
        description: 'Branch creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

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
