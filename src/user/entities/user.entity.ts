import { IsEmail, IsString, MinLength } from 'class-validator';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
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
    description: 'User full name',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    required: false,
  })
  @IsString()
  firstName?: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
  })
  @IsString()
  lastName?: string;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsString()
  avatar?: string;

  @Column({ default: false })
  @ApiProperty({
    description: 'Whether biometric authentication is enabled for this user',
    example: false,
    required: false,
  })
  biometricEnabled: boolean;

  @Column({ nullable: true })
  @ApiProperty({
    description: 'Encrypted biometric authentication token',
    required: false,
  })
  @Exclude({ toPlainOnly: true })
  biometricToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'Last biometric authentication date',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  lastBiometricAuth?: Date;

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
