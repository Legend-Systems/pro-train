import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

export enum UserRole {
    BRANDON = 'brandon',
    OWNER = 'owner',
    ADMIN = 'admin',
    USER = 'user',
}

@Entity('users')
@Index('IDX_USER_EMAIL', ['email'])
@Index('IDX_USER_CREATED_AT', ['createdAt'])
@Index('IDX_USER_NAME_SEARCH', ['firstName', 'lastName'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    @ApiProperty({
        description: 'User unique identifier',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    id: string;

    @Column({ unique: true })
    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
    })
    @IsEmail()
    email: string;

    @Column()
    @ApiProperty({
        description: 'User password (excluded from responses)',
        example: 'securePassword123',
    })
    @IsString()
    @MinLength(6)
    @Exclude({ toPlainOnly: true })
    password: string;

    @Column()
    @ApiProperty({
        description: 'User first name',
        example: 'John',
    })
    @IsString()
    firstName: string;

    @Column()
    @ApiProperty({
        description: 'User last name',
        example: 'Doe',
    })
    @IsString()
    lastName: string;

    @Column({ nullable: true })
    @ApiProperty({
        description: 'User avatar URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
    })
    @IsString()
    avatar?: string;

    @Column({ nullable: true, default: UserRole.USER })
    @ApiProperty({
        description: 'User role',
        example: 'admin',
        required: false,
    })
    @IsEnum(UserRole)
    role?: UserRole;

    @IsString()
    @CreateDateColumn()
    @ApiProperty({
        description: 'Account creation date',
        example: '2024-01-01T00:00:00.000Z',
    })
    createdAt: Date;

    @UpdateDateColumn()
    @ApiProperty({
        description: 'Last update date',
        example: '2024-01-01T00:00:00.000Z',
    })
    updatedAt: Date;

    constructor(partial: Partial<User>) {
        Object.assign(this, partial);
    }
}
