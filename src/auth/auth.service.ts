import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { SignInDto } from '../user/dto/sign-in.dto';
import { ForgotPasswordDto } from '../user/dto/forgot-password.dto';
import { ResetPasswordDto } from '../user/dto/reset-password.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { ResendVerificationDto } from '../user/dto/resend-verification.dto';
import {
  EnableBiometricDto,
  BiometricSignInDto,
  DisableBiometricDto,
} from '../user/dto/biometric-auth.dto';
import {
  SessionResponseDto,
  UserResponseDto,
  StandardApiResponse,
} from '../user/dto/session-response.dto';
import { TokenManagerService } from './token-manager.service';

@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private readonly userService: UserService,
    private readonly tokenManagerService: TokenManagerService,
  ) {}

  async signUp(createUserDto: CreateUserDto): Promise<StandardApiResponse<SessionResponseDto>> {
    const { email, password, name, firstName, lastName } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.saltRounds);

    // Create user
    const user = await this.userService.create({
      email,
      password: hashedPassword,
      name,
      firstName,
      lastName,
    });

    // Generate JWT tokens
    const tokenPair = await this.tokenManagerService.generateTokenPair({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Return user without password
    const userResponse: UserResponseDto = {
      uid: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      success: true,
      data: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        user: userResponse,
      },
      message: 'User registered successfully',
    };
  }

  async signIn(signInDto: SignInDto): Promise<StandardApiResponse<SessionResponseDto>> {
    const { email, password, rememberMe = false } = signInDto;

    // Find user by email
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens with extended expiry if rememberMe is true
    const tokenPair = await this.tokenManagerService.generateTokenPair(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      rememberMe,
    );

    // Return user without password
    const userResponse: UserResponseDto = {
      uid: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      success: true,
      data: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        user: userResponse,
      },
      message: 'User signed in successfully',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return await this.userService.findOne(id);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<StandardApiResponse<any>> {
    const { email } = forgotPasswordDto;
    
    // Check if user exists
    const user = await this.userService.findByEmail(email);
    if (!user) {
      // Return success even if user doesn't exist for security
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // TODO: Generate password reset token and send email
    // For now, just return success message
    return {
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<StandardApiResponse<any>> {
    const { token, password, confirmPassword } = resetPasswordDto;

    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // TODO: Validate reset token and update password
    // For now, just return placeholder
    throw new BadRequestException('Password reset functionality not yet implemented');
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<StandardApiResponse<any>> {
    const { token } = verifyEmailDto;

    // TODO: Validate email verification token
    // For now, just return placeholder
    return {
      success: true,
      message: 'Email verification functionality not yet implemented',
    };
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto): Promise<StandardApiResponse<any>> {
    const { email } = resendVerificationDto;

    // Check if user exists
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // TODO: Generate verification token and send email
    // For now, just return success message
    return {
      success: true,
      message: 'Verification email sent',
    };
  }

  async enableBiometric(
    userId: string,
    enableBiometricDto: EnableBiometricDto,
  ): Promise<StandardApiResponse<any>> {
    const { deviceId, biometricType } = enableBiometricDto;

    try {
      // Generate a secure biometric token for this device
      const biometricToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = await bcrypt.hash(biometricToken, this.saltRounds);

      // Update user with biometric settings
      await this.userService.updateBiometricSettings(userId, {
        biometricEnabled: true,
        biometricToken: hashedToken,
        lastBiometricAuth: new Date(),
      });

      return {
        success: true,
        message: `${biometricType} authentication enabled successfully`,
        data: {
          deviceId,
          biometricToken: biometricToken, // Return unhashed token to client for storage
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to enable biometric authentication');
    }
  }

  async signInWithBiometric(
    biometricSignInDto: BiometricSignInDto,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    const { email, deviceId, biometricToken, rememberMe = false } = biometricSignInDto;

    // Find user by email
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if biometric authentication is enabled
    if (!user.biometricEnabled || !user.biometricToken) {
      throw new UnauthorizedException('Biometric authentication not enabled');
    }

    // Verify biometric token
    const isTokenValid = await bcrypt.compare(biometricToken, user.biometricToken);
    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid biometric credentials');
    }

    // Update last biometric authentication
    await this.userService.updateBiometricSettings(user.id, {
      lastBiometricAuth: new Date(),
    });

    // Generate JWT tokens with extended expiry if rememberMe is true
    const tokenPair = await this.tokenManagerService.generateTokenPair(
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      rememberMe,
    );

    // Return user without password
    const userResponse: UserResponseDto = {
      uid: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return {
      success: true,
      data: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        user: userResponse,
      },
      message: 'User signed in successfully with biometrics',
    };
  }

  async disableBiometric(
    userId: string,
    disableBiometricDto: DisableBiometricDto,
  ): Promise<StandardApiResponse<any>> {
    try {
      // Disable biometric authentication for the user
      await this.userService.updateBiometricSettings(userId, {
        biometricEnabled: false,
        biometricToken: null,
        lastBiometricAuth: null,
      });

      return {
        success: true,
        message: 'Biometric authentication disabled successfully',
      };
    } catch (error) {
      throw new BadRequestException('Failed to disable biometric authentication');
    }
  }

  async getBiometricStatus(userId: string): Promise<StandardApiResponse<any>> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      data: {
        biometricEnabled: user.biometricEnabled,
        lastBiometricAuth: user.lastBiometricAuth,
      },
      message: 'Biometric status retrieved successfully',
    };
  }
}
