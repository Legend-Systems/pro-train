import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsUrl } from 'class-validator';
import { Branch } from '../../branch/entities/branch.entity';

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

    @Column({ nullable: true })
    @ApiProperty({
        description: 'Organization logo URL',
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

    @CreateDateColumn()
    @ApiProperty({
        description: 'Organization creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Last update date',
        example: '2024-01-15T10:30:45.123Z',
    })
    updatedAt: Date;

    @OneToMany(() => Branch, branch => branch.organization, { cascade: true })
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
