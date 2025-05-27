import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description:
      'Unique email address for user authentication and communication',
    example: 'john.doe@example.com',
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
      'Full display name of the user for profile and identification purposes',
    example: 'John Doe',
    minLength: 2,
    maxLength: 100,
    type: String,
    title: 'Full Name',
  })
  @IsString({ message: 'Name must be a string' })
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @ApiProperty({
    description:
      "User's first name for personalized communication and profile display",
    example: 'John',
    required: false,
    type: String,
    title: 'First Name',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  firstName?: string;

  @ApiProperty({
    description:
      "User's last name for full identification and profile completion",
    example: 'Doe',
    required: false,
    type: String,
    title: 'Last Name',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  lastName?: string;

  @ApiProperty({
    description:
      'Profile picture URL for user avatar display across the application',
    example: 'https://cdn.example.com/profiles/john-doe-avatar.jpg',
    required: false,
    type: String,
    title: 'Avatar URL',
    format: 'url',
  })
  @IsOptional()
  @IsString({ message: 'Avatar must be a valid URL string' })
  avatar?: string;
}
