import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignInDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123!',
  })
  @IsString({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Remember me option for extended session',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Remember me must be a boolean value' })
  rememberMe?: boolean;
}
