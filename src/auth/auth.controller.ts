import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { SignInDto } from '../user/dto/sign-in.dto';
import { ForgotPasswordDto } from '../user/dto/forgot-password.dto';
import { ResetPasswordDto } from '../user/dto/reset-password.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { ResendVerificationDto } from '../user/dto/resend-verification.dto';
import {
  SessionResponseDto,
  StandardApiResponse,
} from '../user/dto/session-response.dto';

@ApiTags('🔐 Authentication & Account Management')
@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 attempts per minute
  @ApiOperation({
    summary: '🚀 Register New User Account',
    description: `
      **Creates a new user account with comprehensive validation and security measures**
      
      This endpoint handles user registration with the following features:
      - Strong password requirements enforcement
      - Email uniqueness validation
      - Automatic email verification flow initiation
      - Secure password hashing with bcrypt
      - Input sanitization and validation
      
      **Security Features:**
      - Rate limiting: 3 attempts per minute per IP
      - Password complexity requirements
      - Email format validation
      - Duplicate email prevention
      - SQL injection protection
      
      **Registration Flow:**
      1. User submits registration form
      2. System validates all input data
      3. Password is securely hashed
      4. User account is created
      5. JWT tokens are generated
      6. Email verification is sent (optional)
      7. Session data is returned
      
      **Use Cases:**
      - New user onboarding
      - Account creation from landing pages
      - Mobile app registration
      - API client registration
    `,
    operationId: 'registerUser',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User registration data with required and optional fields',
    examples: {
      'basic-registration': {
        summary: '✨ Basic Registration',
        description: 'Minimal required fields for account creation',
        value: {
          email: 'john.doe@example.com',
          password: 'SecurePass123!',
          name: 'John Doe',
        },
      },
      'complete-registration': {
        summary: '📋 Complete Profile Registration',
        description: 'Full registration with all optional fields',
        value: {
          email: 'jane.smith@company.com',
          password: 'StrongPassword456@',
          name: 'Jane Smith',
          firstName: 'Jane',
          lastName: 'Smith',
          avatar: 'https://cdn.example.com/avatars/jane-smith.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '✅ User successfully registered and authenticated',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Registration success status',
        },
        message: {
          type: 'string',
          example: 'User registered successfully',
          description: 'Success confirmation message',
        },
        data: {
          type: 'object',
          description: 'Session and user data for immediate login',
          properties: {
            user: {
              type: 'object',
              description: 'Registered user profile data',
              properties: {
                id: {
                  type: 'string',
                  example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  description: 'Unique user identifier',
                },
                email: {
                  type: 'string',
                  example: 'john.doe@example.com',
                  description: 'User email address',
                },
                name: {
                  type: 'string',
                  example: 'John Doe',
                  description: 'User full name',
                },
                createdAt: {
                  type: 'string',
                  example: '2024-01-15T10:30:00.000Z',
                  description: 'Account creation timestamp',
                },
              },
            },
            tokens: {
              type: 'object',
              description: 'JWT authentication tokens',
              properties: {
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  description: 'JWT access token for API authentication',
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  description: 'JWT refresh token for token renewal',
                },
                expiresIn: {
                  type: 'number',
                  example: 3600,
                  description: 'Access token expiration time in seconds',
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '❌ Invalid input data or validation errors',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          examples: [
            ['Please provide a valid email address'],
            ['Password must be at least 8 characters long'],
            ['Name must be at least 2 characters long'],
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '⚠️ User already exists with this email',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'User with this email already exists',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  async signUp(
    @Body() createUserDto: CreateUserDto,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    this.logger.log(`Sign up attempt for email: ${createUserDto.email}`);
    return this.authService.signUp(createUserDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 attempts per minute
  @ApiOperation({
    summary: '🔑 User Authentication & Login',
    description: `
      **Authenticates existing users and provides access tokens**
      
      This endpoint handles user authentication with comprehensive security:
      - Email and password validation
      - Secure password verification using bcrypt
      - JWT token generation for session management
      - Rate limiting to prevent brute force attacks
      - Login attempt monitoring and logging
      
      **Security Features:**
      - Rate limiting: 5 attempts per minute per IP
      - Secure password comparison
      - JWT token with expiration
      - Failed attempt logging
      - Account lockout protection (future enhancement)
      
      **Authentication Flow:**
      1. User submits email and password
      2. System validates credentials
      3. Password is verified against hash
      4. JWT tokens are generated
      5. Session data is returned
      6. User is authenticated for protected endpoints
      
      **Use Cases:**
      - User login from web application
      - Mobile app authentication
      - API client authentication
      - Session restoration
    `,
    operationId: 'authenticateUser',
  })
  @ApiBody({
    type: SignInDto,
    description: 'User login credentials',
    examples: {
      'standard-login': {
        summary: '🔐 Standard Login',
        description: 'Regular user authentication with email and password',
        value: {
          email: 'john.doe@example.com',
          password: 'SecurePass123!',
        },
      },
      'returning-user': {
        summary: '🔄 Returning User Login',
        description: 'Login for existing user with established account',
        value: {
          email: 'jane.smith@company.com',
          password: 'MyPassword456@',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '✅ User successfully authenticated',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Authentication success status',
        },
        message: {
          type: 'string',
          example: 'User signed in successfully',
          description: 'Success confirmation message',
        },
        data: {
          type: 'object',
          description: 'Authentication session data',
          properties: {
            user: {
              type: 'object',
              description: 'Authenticated user profile',
              properties: {
                id: {
                  type: 'string',
                  example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  description: 'User unique identifier',
                },
                email: {
                  type: 'string',
                  example: 'john.doe@example.com',
                  description: 'User email address',
                },
                name: {
                  type: 'string',
                  example: 'John Doe',
                  description: 'User display name',
                },
                lastLoginAt: {
                  type: 'string',
                  example: '2024-01-15T10:30:00.000Z',
                  description: 'Current login timestamp',
                },
              },
            },
            tokens: {
              type: 'object',
              description: 'JWT authentication tokens',
              properties: {
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  description: 'JWT access token for API calls',
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                  description: 'JWT refresh token for session renewal',
                },
                expiresIn: {
                  type: 'number',
                  example: 3600,
                  description: 'Token expiration in seconds',
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: '🚫 Invalid email or password',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Invalid credentials' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '❌ Invalid input format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          examples: [
            ['Please provide a valid email address'],
            ['Password is required'],
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async signIn(
    @Body() signInDto: SignInDto,
  ): Promise<StandardApiResponse<SessionResponseDto>> {
    this.logger.log(`Sign in attempt for email: ${signInDto.email}`);
    return this.authService.signIn(signInDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '🔄 Refresh Authentication Token',
    description: `
      **Refreshes expired access tokens using refresh tokens**
      
      This endpoint will handle token refresh functionality:
      - Validate existing refresh token
      - Generate new access token
      - Optional refresh token rotation
      - Maintain session continuity
      
      **Note:** This endpoint is currently in development.
      Implementation will include comprehensive token management.
      
      **Future Features:**
      - Refresh token validation
      - New access token generation
      - Token rotation security
      - Session extension
    `,
    operationId: 'refreshAuthToken',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '🚧 Endpoint under development',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Refresh token endpoint - to be implemented',
          description: 'Development status message',
        },
      },
    },
  })
  refreshToken(): { message: string } {
    // TODO: Implement refresh token logic
    return { message: 'Refresh token endpoint - to be implemented' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({
    summary: '🔑 Request Password Reset',
    description: `
      **Initiates secure password reset flow via email**
      
      This endpoint handles password reset requests with:
      - Email validation and user lookup
      - Secure reset token generation
      - Password reset email dispatch
      - Rate limiting for security
      - Token expiration management
      
      **Security Features:**
      - Rate limiting: 3 attempts per 5 minutes
      - Secure token generation
      - Time-limited reset tokens
      - Email validation
      - No user enumeration (same response for valid/invalid emails)
      
      **Reset Flow:**
      1. User submits email address
      2. System validates email format
      3. Reset token is generated (if user exists)
      4. Password reset email is sent
      5. User receives reset link
      6. Token is valid for limited time
      
      **Use Cases:**
      - Forgotten password recovery
      - Account security compromise
      - Password strength upgrades
      - Emergency account access
    `,
    operationId: 'requestPasswordReset',
  })
  @ApiBody({
    type: ForgotPasswordDto,
    description: 'Email address for password reset',
    examples: {
      'password-reset-request': {
        summary: '📧 Password Reset Request',
        description: 'Request password reset for existing account',
        value: {
          email: 'john.doe@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '✅ Password reset email sent (if account exists)',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Request processing status',
        },
        message: {
          type: 'string',
          example:
            'If an account with this email exists, a password reset link has been sent',
          description: 'Generic success message for security',
        },
        data: {
          type: 'null',
          description: 'No data returned for security reasons',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '❌ Invalid email format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          examples: [['Please provide a valid email address']],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<StandardApiResponse<any>> {
    this.logger.log(
      `Password reset requested for email: ${forgotPasswordDto.email}`,
    );
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({
    summary: '🔐 Reset Password with Token',
    description: `
      **Completes password reset using secure token**
      
      This endpoint finalizes the password reset process:
      - Validates reset token authenticity
      - Verifies token expiration
      - Updates password securely
      - Invalidates reset token
      - Confirms password change
      
      **Security Features:**
      - Token validation and expiration
      - Strong password requirements
      - Secure password hashing
      - Token invalidation after use
      - Rate limiting protection
      
      **Reset Completion:**
      1. User submits token and new password
      2. System validates token
      3. Password requirements are checked
      4. Password is securely hashed
      5. User password is updated
      6. Reset token is invalidated
      7. Success confirmation sent
      
      **Use Cases:**
      - Complete password reset flow
      - Security incident recovery
      - Account access restoration
      - Password update from email link
    `,
    operationId: 'resetPassword',
  })
  @ApiBody({
    type: ResetPasswordDto,
    description: 'Reset token and new password',
    examples: {
      'password-reset': {
        summary: '🔑 Complete Password Reset',
        description: 'Reset password using email token',
        value: {
          token: 'abc123-reset-token-xyz789',
          newPassword: 'NewSecurePass123!',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '✅ Password successfully reset',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Password reset success status',
        },
        message: {
          type: 'string',
          example: 'Password has been successfully reset',
          description: 'Reset confirmation message',
        },
        data: {
          type: 'null',
          description: 'No additional data for security',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '❌ Invalid token or password requirements not met',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          examples: [
            'Invalid or expired reset token',
            'Password must be at least 8 characters long',
            'Password must contain uppercase, lowercase, number, and special character',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<StandardApiResponse<any>> {
    this.logger.log(`Password reset attempt with token`);
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle() // Allow email verification without limits
  @ApiOperation({
    summary: '📧 Verify Email Address',
    description: `
      **Verifies user email address using verification token**
      
      This endpoint handles email verification with:
      - Token validation and verification
      - Account activation
      - Email confirmation
      - User status updates
      - Welcome flow initiation
      
      **Verification Features:**
      - No rate limiting for user convenience
      - Token authenticity validation
      - Account activation
      - Status confirmation
      - Welcome process initiation
      
      **Verification Flow:**
      1. User clicks email verification link
      2. Token is extracted and validated
      3. Account is marked as verified
      4. User receives confirmation
      5. Welcome flow may be initiated
      
      **Use Cases:**
      - New account email verification
      - Email address confirmation
      - Account activation
      - Security verification
    `,
    operationId: 'verifyEmailAddress',
  })
  @ApiBody({
    type: VerifyEmailDto,
    description: 'Email verification token',
    examples: {
      'email-verification': {
        summary: '✅ Email Verification',
        description: 'Verify email address using token from email',
        value: {
          token: 'abc123-verify-email-xyz789',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '✅ Email successfully verified',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Email verification success status',
        },
        message: {
          type: 'string',
          example: 'Email address verified successfully',
          description: 'Verification confirmation message',
        },
        data: {
          type: 'null',
          description: 'No additional data returned',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '❌ Invalid or expired verification token',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Invalid or expired verification token',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<StandardApiResponse<any>> {
    this.logger.log(`Email verification attempt`);
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } }) // 3 attempts per 5 minutes
  @ApiOperation({
    summary: '🔄 Resend Email Verification',
    description: `
      **Resends email verification for unverified accounts**
      
      This endpoint handles verification email resending:
      - Account verification status check
      - New verification token generation
      - Verification email dispatch
      - Rate limiting for abuse prevention
      - Token expiration management
      
      **Security Features:**
      - Rate limiting: 3 attempts per 5 minutes
      - Account status validation
      - New token generation
      - Abuse prevention
      - Expiration time limits
      
      **Resend Flow:**
      1. User requests verification resend
      2. Account verification status is checked
      3. New verification token is generated
      4. Verification email is sent
      5. User receives new verification link
      
      **Use Cases:**
      - Lost verification email
      - Expired verification token
      - Email delivery issues
      - Account activation assistance
    `,
    operationId: 'resendEmailVerification',
  })
  @ApiBody({
    type: ResendVerificationDto,
    description: 'Email address for verification resend',
    examples: {
      'resend-verification': {
        summary: '📧 Resend Verification Email',
        description: 'Request new verification email for unverified account',
        value: {
          email: 'john.doe@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      '✅ Verification email sent (if account exists and unverified)',
    schema: {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          example: true,
          description: 'Resend request processing status',
        },
        message: {
          type: 'string',
          example:
            'If an unverified account exists, a verification email has been sent',
          description: 'Generic success message for security',
        },
        data: {
          type: 'null',
          description: 'No data returned for security reasons',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '❌ Invalid email format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          examples: [['Please provide a valid email address']],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<StandardApiResponse<any>> {
    this.logger.log(
      `Resend verification requested for email: ${resendVerificationDto.email}`,
    );
    return this.authService.resendVerification(resendVerificationDto);
  }
}
