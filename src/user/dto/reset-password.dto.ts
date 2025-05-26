import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token from email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'Token is required' })
  token: string;

  @ApiProperty({
    description: 'New password',
    example: 'newSecurePassword123',
    minLength: 6,
  })
  @IsString({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    description: 'Confirm new password',
    example: 'newSecurePassword123',
  })
  @IsString({ message: 'Password confirmation is required' })
  confirmPassword: string;
}
