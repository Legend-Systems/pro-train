import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { SignInDto } from '../user/dto/sign-in.dto';
import { ForgotPasswordDto } from '../user/dto/forgot-password.dto';
import { ResetPasswordDto } from '../user/dto/reset-password.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { ResendVerificationDto } from '../user/dto/resend-verification.dto';
import { SessionResponseDto, StandardApiResponse } from '../user/dto/session-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async signUp(
    @Body() createUserDto: CreateUserDto,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    this.logger.log(`Sign up attempt for email: ${createUserDto.email}`);
    return this.authService.signUp(createUserDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({ summary: 'Sign in user' })
  @ApiResponse({ status: 200, description: 'User successfully signed in' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(@Body() signInDto: SignInDto): Promise<StandardApiResponse<SessionResponseDto>> {
    this.logger.log(`Sign in attempt for email: ${signInDto.email}`);
    return this.authService.signIn(signInDto);
  }

  @Post('signout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  signOut(): { message: string } {
    // For JWT, signout is handled client-side by removing the token
    // In a real app, you might want to implement token blacklisting
    return { message: 'Successfully signed out' };
  }

  @Get('session')
  @UseGuards(JwtAuthGuard)
  getSession(@Request() req: any): { user: any } {
    return { user: req.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(): { message: string } {
    // TODO: Implement refresh token logic
    return { message: 'Refresh token endpoint - to be implemented' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<StandardApiResponse<any>> {
    this.logger.log(`Password reset requested for email: ${forgotPasswordDto.email}`);
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password successfully reset' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<StandardApiResponse<any>> {
    this.logger.log(`Password reset attempt with token`);
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle() // Allow email verification without limits
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email successfully verified' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<StandardApiResponse<any>> {
    this.logger.log(`Email verification attempt`);
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendVerification(@Body() resendVerificationDto: ResendVerificationDto): Promise<StandardApiResponse<any>> {
    this.logger.log(`Resend verification requested for email: ${resendVerificationDto.email}`);
    return this.authService.resendVerification(resendVerificationDto);
  }
}
