import {
    Controller,
    Get,
    Put,
    Body,
    UseGuards,
    Request,
    HttpStatus,
    Logger,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiHeader,
    ApiSecurity,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { StandardApiResponse } from './dto/common-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('👤 User & Profile Management')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiSecurity('JWT-auth')
@ApiHeader({
    name: 'Authorization',
    description: 'Bearer JWT token for authentication',
    example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
})
export class UserController {
    private readonly logger = new Logger(UserController.name);

    constructor(private readonly userService: UserService) {}

    @Get('profile')
    @ApiOperation({
        summary: '📋 Retrieve User Profile',
        description: `
      **Retrieves the complete profile information for the authenticated user**
      
      This endpoint returns comprehensive user profile data including:
      - Personal information (name, email, avatar)
      - Account metadata (creation date, last update)
      - Secure data handling (password excluded from response)
      
      **Security Features:**
      - Requires valid JWT authentication
      - Automatically excludes sensitive information
      - User can only access their own profile
      
      **Use Cases:**
      - Profile page display
      - User account settings
      - Profile completion checks
      - Avatar and name display across application
    `,
        operationId: 'getUserProfile',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User profile retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Profile retrieved successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'User profile data (password excluded)',
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
                            description: 'Full display name',
                        },
                        firstName: {
                            type: 'string',
                            example: 'John',
                            description: 'First name (optional)',
                        },
                        lastName: {
                            type: 'string',
                            example: 'Doe',
                            description: 'Last name (optional)',
                        },
                        avatar: {
                            type: 'string',
                            example:
                                'https://cdn.example.com/avatars/john-doe.jpg',
                            description: 'Profile picture URL (optional)',
                        },
                        createdAt: {
                            type: 'string',
                            example: '2024-01-01T00:00:00.000Z',
                            description: 'Account creation timestamp',
                        },
                        updatedAt: {
                            type: 'string',
                            example: '2024-01-15T10:30:45.123Z',
                            description: 'Last profile update timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User profile not found',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'User not found' },
                data: { type: 'null' },
            },
        },
    })
    async getProfile(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Getting profile for user: ${req.user.id}`);

            const user = await this.userService.findById(req.user.id);

            if (!user) {
                this.logger.error(`User not found: ${req.user.id}`);
                return {
                    success: false,
                    message: 'User not found',
                    data: null,
                };
            }

            // Remove sensitive data
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password, ...userProfile } = user;

            this.logger.log(
                `Profile retrieved successfully for user: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Profile retrieved successfully',
                data: userProfile,
            };
        } catch (error) {
            this.logger.error(
                `Error getting profile for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Put('profile')
    @ApiOperation({
        summary: '✏️ Update User Profile',
        description: `
      **Updates user profile information with comprehensive validation**
      
      This endpoint allows authenticated users to update their profile data including:
      - Personal information (name, firstName, lastName)
      - Contact information (email with uniqueness validation)
      - Profile picture (avatar URL)
      
      **Security & Validation Features:**
      - Email uniqueness checking across all users
      - Input validation for all fields
      - Password updates blocked (use dedicated endpoint)
      - User can only update their own profile
      
      **Business Rules:**
      - Email must be unique across the system
      - Names must be at least 2 characters if provided
      - Avatar must be a valid URL if provided
      - Password changes require separate endpoint for security
      
      **Use Cases:**
      - Profile settings page
      - Account information updates
      - Avatar changes
      - Contact information updates
    `,
        operationId: 'updateUserProfile',
    })
    @ApiBody({
        type: UpdateUserDto,
        description: 'Profile update data with optional fields',
        examples: {
            'full-update': {
                summary: '🔄 Complete Profile Update',
                description: 'Updates all available profile fields',
                value: {
                    email: 'jane.smith@example.com',
                    name: 'Jane Smith',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    avatar: 'https://cdn.example.com/avatars/jane-smith-new.jpg',
                },
            },
            'name-only': {
                summary: '📝 Name Update Only',
                description: 'Updates only name-related fields',
                value: {
                    name: 'Jane Smith-Johnson',
                    firstName: 'Jane',
                    lastName: 'Smith-Johnson',
                },
            },
            'email-change': {
                summary: '📧 Email Address Change',
                description: 'Updates email with validation',
                value: {
                    email: 'jane.new-email@example.com',
                },
            },
            'avatar-update': {
                summary: '🖼️ Avatar Picture Update',
                description: 'Updates profile picture URL',
                value: {
                    avatar: 'https://cdn.example.com/profiles/new-avatar-2024.jpg',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Profile updated successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Update operation success status',
                },
                message: {
                    type: 'string',
                    example: 'Profile updated successfully',
                    description: 'Human-readable success message',
                },
                data: {
                    type: 'object',
                    description: 'Updated user profile data',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                            description: 'User unique identifier',
                        },
                        email: {
                            type: 'string',
                            example: 'jane.smith@example.com',
                            description: 'Updated email address',
                        },
                        name: {
                            type: 'string',
                            example: 'Jane Smith',
                            description: 'Updated full name',
                        },
                        firstName: {
                            type: 'string',
                            example: 'Jane',
                            description: 'Updated first name',
                        },
                        lastName: {
                            type: 'string',
                            example: 'Smith',
                            description: 'Updated last name',
                        },
                        avatar: {
                            type: 'string',
                            example:
                                'https://cdn.example.com/avatars/jane-smith-new.jpg',
                            description: 'Updated avatar URL',
                        },
                        updatedAt: {
                            type: 'string',
                            example: '2024-01-15T10:45:30.567Z',
                            description: 'Profile update timestamp',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or password update attempt',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'string',
                    examples: [
                        'Use /user/change-password endpoint to update password',
                        'Name must be at least 2 characters long',
                        'Please provide a valid email address',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Email address already exists',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 409 },
                message: {
                    type: 'string',
                    example: 'Email address already in use',
                },
                error: { type: 'string', example: 'Conflict' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async updateProfile(
        @Request() req: AuthenticatedRequest,
        @Body() updateUserDto: UpdateUserDto,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Updating profile for user: ${req.user.id}`);

            // Check if email is being updated and if it already exists
            if (updateUserDto.email) {
                const existingUser = await this.userService.findByEmail(
                    updateUserDto.email,
                );
                if (existingUser && existingUser.id !== req.user.id) {
                    this.logger.warn(
                        `Email already exists: ${updateUserDto.email}`,
                    );
                    throw new ConflictException('Email address already in use');
                }
            }

            // Remove password from update data (use separate endpoint)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password, ...updateData } = updateUserDto;

            if (password) {
                this.logger.warn(
                    `Password update attempted through profile update for user: ${req.user.id}`,
                );
                throw new BadRequestException(
                    'Use /user/change-password endpoint to update password',
                );
            }

            const updatedUser = await this.userService.updateProfile(
                req.user.id,
                updateData,
            );

            if (!updatedUser) {
                this.logger.error(
                    `Failed to update profile for user: ${req.user.id}`,
                );
                return {
                    success: false,
                    message: 'Failed to update profile',
                    data: null,
                };
            }

            // Remove sensitive data
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password: _, ...userProfile } = updatedUser;

            this.logger.log(
                `Profile updated successfully for user: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Profile updated successfully',
                data: userProfile,
            };
        } catch (error) {
            this.logger.error(
                `Error updating profile for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Put('change-password')
    @ApiOperation({
        summary: '🔐 Change User Password',
        description: `
      **Securely changes user password with current password verification**
      
      This dedicated endpoint handles password changes with comprehensive security:
      - Current password verification required
      - Strong password requirements enforced
      - Secure password hashing with bcrypt
      - Automatic session invalidation considerations
      
      **Security Features:**
      - Current password must be provided and verified
      - New password must meet complexity requirements
      - Password history validation (prevents reuse)
      - Secure password storage with salt rounds
      
      **Password Requirements:**
      - Minimum 8 characters length
      - At least one uppercase letter (A-Z)
      - At least one lowercase letter (a-z)
      - At least one digit (0-9)
      - At least one special character (!@#$%^&*()_+-=[]{}|;':"\\,.<>?)
      
      **Use Cases:**
      - Account security updates
      - Password strength improvements
      - Compromised account recovery
      - Regular security maintenance
    `,
        operationId: 'changeUserPassword',
    })
    @ApiBody({
        type: ChangePasswordDto,
        description: 'Password change request with current and new password',
        examples: {
            'password-change': {
                summary: '🔄 Standard Password Change',
                description:
                    'Change password with current password verification',
                value: {
                    currentPassword: 'CurrentPass123!',
                    newPassword: 'NewSecurePass456@',
                },
            },
            'security-upgrade': {
                summary: '🛡️ Security Upgrade',
                description:
                    'Upgrade to stronger password for enhanced security',
                value: {
                    currentPassword: 'OldWeakPass123',
                    newPassword: 'SuperSecure2024!@#$',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Password changed successfully',
        schema: {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    example: true,
                    description: 'Password change success status',
                },
                message: {
                    type: 'string',
                    example: 'Password changed successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'null',
                    description: 'No additional data returned for security',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid current password or validation errors',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 400 },
                message: {
                    type: 'string',
                    examples: [
                        'Current password is incorrect',
                        'Password must be at least 8 characters long',
                        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                    ],
                },
                error: { type: 'string', example: 'Bad Request' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: '🚫 Unauthorized - Invalid or missing JWT token',
        schema: {
            type: 'object',
            properties: {
                statusCode: { type: 'number', example: 401 },
                message: { type: 'string', example: 'Unauthorized' },
            },
        },
    })
    async changePassword(
        @Request() req: AuthenticatedRequest,
        @Body() changePasswordDto: ChangePasswordDto,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Changing password for user: ${req.user.id}`);

            const result = await this.userService.changePassword(
                req.user.id,
                changePasswordDto.currentPassword,
                changePasswordDto.newPassword,
            );

            if (!result) {
                this.logger.warn(
                    `Invalid current password for user: ${req.user.id}`,
                );
                throw new BadRequestException('Current password is incorrect');
            }

            this.logger.log(
                `Password changed successfully for user: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Password changed successfully',
                data: null,
            };
        } catch (error) {
            this.logger.error(
                `Error changing password for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
