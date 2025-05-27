import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableBiometricDto {
  @ApiProperty({
    description: 'Device identifier for biometric authentication',
    example: 'device-uuid-123',
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: 'Biometric type used (fingerprint, face, iris)',
    example: 'fingerprint',
  })
  @IsString()
  biometricType: string;
}

export class BiometricSignInDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'Device identifier for biometric authentication',
    example: 'device-uuid-123',
  })
  @IsString()
  deviceId: string;

  @ApiProperty({
    description: 'Biometric authentication token from device',
    example: 'biometric-token-abc123',
  })
  @IsString()
  biometricToken: string;


}

export class DisableBiometricDto {
  @ApiProperty({
    description: 'Device identifier to remove biometric access',
    example: 'device-uuid-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  deviceId?: string;
}