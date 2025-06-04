import {
    IsEmail,
    IsString,
    MinLength,
    IsOptional,
    Matches,
    IsNumber,
    IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

/**
 * Data Transfer Object for creating a new user account
 * Used for user registration with comprehensive validation
 */
export class CreateUserDto {
    @ApiProperty({
        description:
            'Unique email address for user authentication and communication',
        example: 'brandon.new@orrbit.co.za',
        format: 'email',
        type: String,
        title: 'Email Address',
        maxLength: 255,
        uniqueItems: true,
    })
    @IsEmail({}, { message: 'Please provide a valid email address' })
    email: string;

    @ApiProperty({
        description:
            'Secure password for user authentication. Must contain uppercase, lowercase, number, and special character',
        example: 'SecurePass123!',
        minLength: 8,
        type: String,
        title: 'Password',
        format: 'password',
        pattern:
            '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=\\[\\]{};\':"\\\\|,.<>\\/?])',
    })
    @IsString()
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    @Matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
        {
            message:
                'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        },
    )
    password: string;

    @ApiProperty({
        description:
            "User's first name for personalized communication and profile display",
        example: 'Brandon',
        type: String,
        title: 'First Name',
        maxLength: 50,
        minLength: 2,
    })
    @IsString({ message: 'First name must be a string' })
    @MinLength(2, { message: 'First name must be at least 2 characters long' })
    firstName: string;

    @ApiProperty({
        description:
            "User's last name for full identification and profile completion",
        example: 'Kawu',
        type: String,
        title: 'Last Name',
        maxLength: 50,
        minLength: 2,
    })
    @IsString({ message: 'Last name must be a string' })
    @MinLength(2, { message: 'Last name must be at least 2 characters long' })
    lastName: string;

    @ApiProperty({
        description:
            'Profile picture ID from media library for user avatar display across the application',
        example: 1,
        required: false,
        type: Number,
        title: 'Avatar Media ID',
    })
    @IsOptional()
    @IsNumber(
        { allowNaN: false, allowInfinity: false },
        { message: 'Avatar must be a valid media file ID' },
    )
    avatar?: number;

    @ApiProperty({
        description:
            'User role in the system for permission and access control',
        example: UserRole.USER,
        enum: UserRole,
        required: false,
        type: String,
        title: 'User Role',
        default: UserRole.USER,
    })
    @IsOptional()
    @IsEnum(UserRole, { message: 'Role must be a valid user role' })
    role?: UserRole;

    @ApiProperty({
        description:
            'Optional invitation token from email invitation to automatically assign organization and branch',
        example: 'abc123-invitation-token-xyz789',
        required: false,
        type: String,
        title: 'Invitation Token',
    })
    @IsOptional()
    @IsString({ message: 'Invitation token must be a string' })
    invitationToken?: string;

    @ApiProperty({
        description:
            'Optional branch ID to assign the user to a specific branch within the organization',
        example: 'b1c2d3e4-f5g6-7890-bcde-fg1234567890',
        required: false,
        type: String,
        title: 'Branch ID',
    })
    @IsOptional()
    @IsString({ message: 'Branch ID must be a string' })
    branchId?: string;
}
