import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UsePipes,
    ValidationPipe,
    Logger,
    Get,
    UseGuards,
    Request,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { SignInDto } from '../user/dto/sign-in.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { ResendVerificationDto } from '../user/dto/resend-verification.dto';
import { RefreshTokenDto } from '../user/dto/refresh-token.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { ValidateInvitationDto } from './dto/validate-invitation.dto';
import {
    SessionResponseDto,
    StandardApiResponse,
} from '../user/dto/session-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

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
                                    example:
                                        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
                                    example:
                                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    description:
                                        'JWT access token for API authentication',
                                },
                                refreshToken: {
                                    type: 'string',
                                    example:
                                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    description:
                                        'JWT refresh token for token renewal',
                                },
                                expiresIn: {
                                    type: 'number',
                                    example: 3600,
                                    description:
                                        'Access token expiration time in seconds',
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
      - Returns user leaderboard statistics and metrics
      
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
      5. User leaderboard stats are fetched
      6. Session data with metrics is returned
      7. User is authenticated for protected endpoints
      
      **Using the Access Token:**
      After successful authentication, use the returned access token in the Authorization header for protected endpoints:
      
      \`\`\`
      Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
      \`\`\`
      
      **Example API Calls with Headers:**
      
      \`\`\`javascript
      // JavaScript/Node.js example
      const response = await fetch('/api/protected-endpoint', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      \`\`\`
      
      \`\`\`bash
      # cURL example
      curl -X GET "https://api.example.com/protected-endpoint" \\
        -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \\
        -H "Content-Type: application/json" \\
        -H "Accept: application/json"
      \`\`\`
      
      \`\`\`python
      # Python requests example
      import requests
      
      headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
      
      response = requests.get('https://api.example.com/protected-endpoint', headers=headers)
      \`\`\`
      
      **Use Cases:**
      - User login from web application
      - Mobile app authentication
      - API client authentication
      - Session restoration
      - Leaderboard data retrieval
    `,
        operationId: 'authenticateUser',
    })
    @ApiBody({
        type: SignInDto,
        description: 'User login credentials',
        examples: {
            'standard-login': {
                summary: '🔐 Standard Login',
                description:
                    'Regular user authentication with email and password',
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
                                    example:
                                        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
                                    example:
                                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    description:
                                        'JWT access token for API calls',
                                },
                                refreshToken: {
                                    type: 'string',
                                    example:
                                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                                    description:
                                        'JWT refresh token for session renewal',
                                },
                                expiresIn: {
                                    type: 'number',
                                    example: 3600,
                                    description: 'Token expiration in seconds',
                                },
                            },
                        },
                        leaderboard: {
                            type: 'object',
                            description:
                                'User leaderboard statistics and metrics',
                            properties: {
                                totalPoints: {
                                    type: 'number',
                                    example: 1250.75,
                                    description:
                                        'Total points earned across all courses',
                                },
                                totalTestsCompleted: {
                                    type: 'number',
                                    example: 15,
                                    description:
                                        'Total number of tests completed',
                                },
                                averageScore: {
                                    type: 'number',
                                    example: 88.5,
                                    description:
                                        'Overall average score across all tests',
                                },
                                coursesEnrolled: {
                                    type: 'number',
                                    example: 3,
                                    description:
                                        'Number of courses enrolled in',
                                },
                                bestRank: {
                                    type: 'number',
                                    example: 2,
                                    nullable: true,
                                    description:
                                        'Best rank achieved across all courses',
                                },
                                recentActivity: {
                                    type: 'array',
                                    description:
                                        'Recent activity in the last 5 courses',
                                    items: {
                                        type: 'object',
                                        description:
                                            'Leaderboard entry details',
                                    },
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
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 attempts per minute
    @ApiOperation({
        summary: '🔄 Refresh Authentication Token',
        description: `
      **Refreshes expired access tokens using refresh tokens**
      
      This endpoint handles token refresh functionality with:
      - Refresh token validation
      - New access token generation
      - Optional refresh token rotation
      - Session continuity maintenance
      - Security token validation
      
      **Security Features:**
      - Rate limiting: 10 attempts per minute
      - Refresh token validation
      - Token rotation security
      - Expired token cleanup
      - Invalid token detection
      
      **Refresh Flow:**
      1. Client submits refresh token
      2. System validates refresh token
      3. New access token is generated
      4. Optional new refresh token provided
      5. Old refresh token is invalidated
      6. New tokens returned to client
      
      **Use Cases:**
      - Automatic token refresh
      - Session extension
      - Seamless user experience
      - Background token management
    `,
        operationId: 'refreshAuthToken',
    })
    @ApiBody({
        type: RefreshTokenDto,
        description: 'Refresh token for generating new access token',
        examples: {
            'token-refresh': {
                summary: '🔄 Token Refresh Request',
                description: 'Refresh access token using valid refresh token',
                value: {
                    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Token successfully refreshed',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Token refresh success status',
                },
                message: {
                    type: 'string',
                    example: 'Token refreshed successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'object',
                    description: 'New authentication tokens',
                    properties: {
                        accessToken: {
                            type: 'string',
                            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                            description:
                                'New JWT access token for API authentication',
                        },
                        refreshToken: {
                            type: 'string',
                            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                            description:
                                'New JWT refresh token (if rotation enabled)',
                        },
                        expiresIn: {
                            type: 'number',
                            example: 3600,
                            description:
                                'Access token expiration time in seconds',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Invalid or expired refresh token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: {
                    type: 'string',
                    example: 'Invalid or expired refresh token',
                },
                error: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid refresh token format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    examples: [['Refresh token is required']],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    async refreshToken(
        @Body() refreshTokenDto: RefreshTokenDto,
    ): Promise<StandardApiResponse<any>> {
        this.logger.log('Token refresh request received');
        return this.authService.refreshToken(refreshTokenDto);
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
                description:
                    'Request new verification email for unverified account',
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

    @Get('token-info')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: '🔑 Get Token Information',
        description: `
      **Retrieves information about the authenticated user's token**
      
      This endpoint handles token information retrieval:
      - Token validation
      - User information extraction
      - Token expiration check
      - Token type identification
      
      **Security Features:**
      - Token validation
      - User information extraction
      - Token expiration check
      - Token type identification
      
      **Token Information:**
      - Token type
      - Token expiration
      - User information
      
      **Use Cases:**
      - Token information retrieval
      - Security token validation
      - User information access
    `,
        operationId: 'getTokenInfo',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Token information retrieved',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Token information retrieval success status',
                },
                message: {
                    type: 'string',
                    example: 'Token information retrieved successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'object',
                    description: 'Token information',
                    properties: {
                        tokenType: {
                            type: 'string',
                            example: 'Bearer',
                            description: 'Token type',
                        },
                        expiresIn: {
                            type: 'number',
                            example: 3600,
                            description: 'Token expiration time in seconds',
                        },
                        user: {
                            type: 'object',
                            description: 'Authenticated user information',
                            properties: {
                                id: {
                                    type: 'string',
                                    example:
                                        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
                                createdAt: {
                                    type: 'string',
                                    example: '2024-01-15T10:30:00.000Z',
                                    description: 'Account creation timestamp',
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
        description: '🚫 Invalid or expired token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: {
                    type: 'string',
                    example: 'Invalid or expired token',
                },
                error: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid token format',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    examples: [['Invalid token format']],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiBearerAuth()
    async getTokenInfo(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<any>> {
        this.logger.log('Token information retrieval request received');
        return this.authService.getTokenInfo(req.user);
    }

    @Post('send-invitation')
    @UseGuards(JwtAuthGuard)
    @Throttle({ default: { limit: 10, ttl: 300000 } }) // 10 invitations per 5 minutes
    @ApiOperation({
        summary: '📧 Send User Invitation',
        description: `
      **Sends an invitation email to a new user to join the platform**
      
      This endpoint handles user invitation functionality with the following features:
      - Email invitation sending
      - Customizable invitation messages
      - Organization/branch assignment
      - Secure invitation token generation
      - Email delivery tracking
      
      **Security Features:**
      - Rate limiting: 10 invitations per 5 minutes per user
      - Authentication required (JWT)
      - Invitation token with expiration
      - Email validation
      - Duplicate invitation prevention
      
      **Invitation Flow:**
      1. Authenticated user sends invitation
      2. System validates email and permissions
      3. Secure invitation token is generated
      4. Invitation email is sent to recipient
      5. Token expires after configured time
      6. Recipient can use token to register
      
      **Use Cases:**
      - Team member onboarding
      - Student invitation to courses
      - Organization member recruitment
      - Branch-specific invitations
    `,
        operationId: 'sendInvitation',
    })
    @ApiBody({
        type: SendInvitationDto,
        description:
            'Invitation details including recipient email and optional message',
        examples: {
            'basic-invitation': {
                summary: '✉️ Basic Invitation',
                description: 'Simple invitation with just email address',
                value: {
                    email: 'newuser@example.com',
                },
            },
            'team-invitation': {
                summary: '👥 Team Invitation',
                description: 'Invitation with custom message and organization',
                value: {
                    email: 'teammate@company.com',
                    message:
                        "Join our team on the Exxam platform! We're excited to have you aboard.",
                    organizationId: 'org_123456789',
                },
            },
            'branch-invitation': {
                summary: '🏢 Branch-Specific Invitation',
                description:
                    'Invitation to specific branch within organization',
                value: {
                    email: 'employee@company.com',
                    message: 'Welcome to our Sales division!',
                    organizationId: 'org_123456789',
                    branchId: 'branch_sales_001',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Invitation sent successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Invitation sending success status',
                },
                message: {
                    type: 'string',
                    example: 'Invitation sent successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'object',
                    description: 'Invitation details',
                    properties: {
                        invitationId: {
                            type: 'string',
                            example: 'inv_a1b2c3d4e5f6',
                            description: 'Unique invitation identifier',
                        },
                        email: {
                            type: 'string',
                            example: 'newuser@example.com',
                            description: 'Recipient email address',
                        },
                        expiresAt: {
                            type: 'string',
                            example: '2024-01-22T10:30:00.000Z',
                            description: 'Invitation expiration timestamp',
                        },
                        invitedBy: {
                            type: 'string',
                            example: 'John Doe',
                            description: 'Name of user who sent invitation',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or user already exists',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    examples: [
                        ['Please provide a valid email address'],
                        ['User with this email already exists'],
                        ['Invalid organization or branch ID'],
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Authentication required',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: {
                    type: 'string',
                    example: 'Unauthorized',
                },
                error: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: '⏰ Rate limit exceeded',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 429 },
                message: {
                    type: 'string',
                    example:
                        'Too many invitation requests. Please try again later.',
                },
                error: { type: 'string', example: 'Too Many Requests' },
            },
        },
    })
    @ApiBearerAuth()
    async sendInvitation(
        @Body() sendInvitationDto: SendInvitationDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse<any>> {
        this.logger.log(
            `Sending invitation to ${sendInvitationDto.email} from user ${req.user.id}`,
        );
        return this.authService.sendInvitation(sendInvitationDto, req.user.id);
    }

    @Post('validate-invitation')
    @SkipThrottle()
    @ApiOperation({
        summary: '🔍 Validate Invitation Token',
        description: `
      **Validates an invitation token and returns invitation details**
      
      This endpoint handles invitation token validation with the following features:
      - Token authenticity verification
      - Expiration date checking
      - Invitation details retrieval
      - Security token validation
      - Pre-registration validation
      
      **Security Features:**
      - Cryptographic token validation
      - Expiration time enforcement
      - Token tampering detection
      - Rate limiting bypass for validation
      - Secure token parsing
      
      **Validation Flow:**
      1. User receives invitation email
      2. User clicks invitation link with token
      3. Frontend calls this endpoint to validate
      4. System verifies token authenticity
      5. Invitation details are returned if valid
      6. User can proceed with registration
      
      **Use Cases:**
      - Pre-registration token validation
      - Invitation link verification
      - Registration form pre-population
      - Token expiration checking
    `,
        operationId: 'validateInvitation',
    })
    @ApiBody({
        type: ValidateInvitationDto,
        description: 'Invitation token from email link',
        examples: {
            'token-validation': {
                summary: '🎫 Token Validation',
                description: 'Validate invitation token from email',
                value: {
                    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im5ld3VzZXJAZXhhbXBsZS5jb20iLCJ0eXBlIjoiaW52aXRhdGlvbiIsImlhdCI6MTcwNTMxNzAwMCwiZXhwIjoxNzA1OTIxODAwfQ.ABC123...',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Invitation token is valid',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Token validation success status',
                },
                message: {
                    type: 'string',
                    example: 'Invitation token is valid',
                    description: 'Validation confirmation message',
                },
                data: {
                    type: 'object',
                    description: 'Invitation details from valid token',
                    properties: {
                        email: {
                            type: 'string',
                            example: 'newuser@example.com',
                            description:
                                'Email address the invitation was sent to',
                        },
                        invitedBy: {
                            type: 'object',
                            description: 'Details of user who sent invitation',
                            properties: {
                                name: {
                                    type: 'string',
                                    example: 'John Doe',
                                    description: 'Name of inviting user',
                                },
                                email: {
                                    type: 'string',
                                    example: 'john.doe@company.com',
                                    description: 'Email of inviting user',
                                },
                            },
                        },
                        message: {
                            type: 'string',
                            example: 'Join our team on the Exxam platform!',
                            description: 'Custom message from inviter',
                        },
                        organizationId: {
                            type: 'string',
                            example: 'org_123456789',
                            description:
                                'Organization ID if invitation is org-specific',
                            nullable: true,
                        },
                        branchId: {
                            type: 'string',
                            example: 'branch_sales_001',
                            description:
                                'Branch ID if invitation is branch-specific',
                            nullable: true,
                        },
                        expiresAt: {
                            type: 'string',
                            example: '2024-01-22T10:30:00.000Z',
                            description: 'Invitation expiration timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid or expired invitation token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'array',
                    items: { type: 'string' },
                    examples: [
                        ['Invalid invitation token'],
                        ['Invitation token has expired'],
                        ['Malformed token format'],
                        ['Invitation token is required'],
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.GONE,
        description: '🚫 Invitation has been revoked or used',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 410 },
                message: {
                    type: 'string',
                    example: 'Invitation has been revoked or already used',
                },
                error: { type: 'string', example: 'Gone' },
            },
        },
    })
    async validateInvitation(
        @Body() validateInvitationDto: ValidateInvitationDto,
    ): Promise<StandardApiResponse<any>> {
        this.logger.log(
            `Validating invitation token: ${validateInvitationDto.token.substring(0, 20)}...`,
        );
        return this.authService.validateInvitation(validateInvitationDto);
    }
}
