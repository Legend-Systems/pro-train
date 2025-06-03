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
    Patch,
    Delete,
    Param,
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
import {
    StandardApiResponse,
    StandardOperationResponse,
    ProfileUpdatedResponse,
    PasswordChangedResponse,
    UserSoftDeletedResponse,
    UserRestoredResponse,
} from './dto/common-response.dto';
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
                            example: '1',
                            description: 'Unique user identifier',
                        },
                        email: {
                            type: 'string',
                            example: 'theguy@orrbit.co.za',
                            description: 'User email address',
                        },
                        name: {
                            type: 'string',
                            example: 'Brandon Nhlanhla',
                            description: 'Full display name',
                        },
                        firstName: {
                            type: 'string',
                            example: 'Brandon',
                            description: 'First name (optional)',
                        },
                        lastName: {
                            type: 'string',
                            example: 'Nhlanhla',
                            description: 'Last name (optional)',
                        },
                        avatar: {
                            type: 'object',
                            example: {
                                id: 1,
                                originalName: 'pexels-photo-577585.jpg',
                                url: 'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585.jpg',
                                thumbnail:
                                    'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585-thumbnail.jpg',
                                medium: 'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585.jpg',
                                original:
                                    'https://storage.googleapis.com/crmapplications/media/1/1/2025-05-31/9d8818a4-bb5f-4d82-acf8-120c1485c572-pexels-photo-577585.jpg',
                            },
                            description:
                                'Profile picture with variants (optional)',
                        },
                        createdAt: {
                            type: 'string',
                            example: '2025-05-30T16:40:02.055Z',
                            description: 'Account creation timestamp',
                        },
                        updatedAt: {
                            type: 'string',
                            example: '2025-05-31T18:55:12.552Z',
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
                    email: 'brandon.updated@orrbit.co.za',
                    firstName: 'Brandon',
                    lastName: 'Nhlanhla',
                    avatar: 2,
                },
            },
            'name-only': {
                summary: '📝 Name Update Only',
                description: 'Updates only name-related fields',
                value: {
                    firstName: 'Brandon',
                    lastName: 'Kawu-Nhlanhla',
                },
            },
            'email-change': {
                summary: '📧 Email Address Change',
                description: 'Updates email with validation',
                value: {
                    email: 'brandon.new-email@legendsystems.co.za',
                },
            },
            'avatar-update': {
                summary: '🖼️ Avatar Picture Update',
                description: 'Updates profile picture ID',
                value: {
                    avatar: 3,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Profile updated successfully',
        type: ProfileUpdatedResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data or password update attempt',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Use /user/change-password endpoint to update password',
                        'Name must be at least 2 characters long',
                        'Please provide a valid email address',
                    ],
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Email address already exists',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Email address already in use',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 409,
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
    async updateProfile(
        @Request() req: AuthenticatedRequest,
        @Body() updateUserDto: UpdateUserDto,
    ): Promise<StandardOperationResponse> {
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
            const { password, ...updateData } = updateUserDto;

            if (password) {
                this.logger.warn(
                    `Password update attempted through profile update for user: ${req.user.id}`,
                );
                throw new BadRequestException(
                    'Use /user/change-password endpoint to update password',
                );
            }

            const result = await this.userService.updateProfile(
                req.user.id,
                updateData,
            );

            this.logger.log(
                `Profile updated successfully for user: ${req.user.id}`,
            );

            return result;
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
                    newPassword: 'SuperSecure2025!@#$',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Password changed successfully',
        type: PasswordChangedResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid current password or validation errors',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    examples: [
                        'Current password is incorrect',
                        'Password must be at least 8 characters long',
                        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                    ],
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
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
    async changePassword(
        @Request() req: AuthenticatedRequest,
        @Body() changePasswordDto: ChangePasswordDto,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Changing password for user: ${req.user.id}`);

            const result = await this.userService.changePassword(
                req.user.id,
                changePasswordDto.currentPassword,
                changePasswordDto.newPassword,
            );

            if (result.status === 'error') {
                this.logger.warn(
                    `Password change failed for user: ${req.user.id} - ${result.message}`,
                );
                if (result.code === 400) {
                    throw new BadRequestException(result.message);
                }
            }

            this.logger.log(
                `Password changed successfully for user: ${req.user.id}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error changing password for user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Delete('soft-delete')
    @ApiOperation({
        summary: '🗑️ Soft Delete User Account',
        description: `
      **Soft deletes the authenticated user's account by setting status to DELETED**
      
      This endpoint performs a soft delete of the user account:
      - Sets user status to DELETED instead of removing the record
      - Preserves user data for potential restoration
      - User will no longer appear in normal queries
      - Account can be restored later using the restore endpoint
      
      **Security Features:**
      - Requires valid JWT authentication
      - User can only soft delete their own account
      - Checks if user is already deleted before proceeding
      
      **Use Cases:**
      - Account deactivation
      - Temporary account suspension
      - GDPR compliance (soft deletion)
      - User-initiated account closure
    `,
        operationId: 'softDeleteUser',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User account soft deleted successfully',
        type: UserSoftDeletedResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ User is already deleted',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'User is already deleted',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
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
    async softDeleteUser(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Soft deleting user: ${req.user.id}`);

            const result = await this.userService.softDelete(
                req.user.id,
                req.user.id,
            );

            this.logger.log(`User soft deleted successfully: ${req.user.id}`);

            return result;
        } catch (error) {
            this.logger.error(
                `Error soft deleting user ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Patch('restore')
    @ApiOperation({
        summary: '♻️ Restore Soft Deleted User Account',
        description: `
      **Restores a soft-deleted user account by setting status to ACTIVE**
      
      This endpoint restores a previously soft-deleted user account:
      - Sets user status back to ACTIVE
      - Makes the account accessible again
      - User will appear in normal queries again
      - Validates that user is currently in DELETED status
      
      **Security Features:**
      - Requires valid JWT authentication
      - User can only restore their own account
      - Checks if user is actually deleted before proceeding
      
      **Use Cases:**
      - Account reactivation
      - Undoing accidental deletion
      - User returning after temporary deactivation
      - Admin-assisted account recovery
    `,
        operationId: 'restoreUser',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User account restored successfully',
        type: UserRestoredResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ User is not deleted and cannot be restored',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'User is not deleted and cannot be restored',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
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
    async restoreUser(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Restoring user: ${req.user.id}`);

            const result = await this.userService.restoreUser(
                req.user.id,
                req.user.id,
            );

            this.logger.log(`User restored successfully: ${req.user.id}`);

            return result;
        } catch (error) {
            this.logger.error(`Error restoring user ${req.user.id}:`, error);
            throw error;
        }
    }

    @Get('admin/deleted')
    @ApiOperation({
        summary: '📋 Get Deleted Users (Admin)',
        description: `
      **Retrieves all soft-deleted users (for administrative purposes)**
      
      This endpoint returns all users with DELETED status:
      - Shows users who have been soft-deleted
      - Includes full user profile data
      - Intended for administrative use
      - Helps with account recovery operations
      
      **Security Features:**
      - Requires valid JWT authentication
      - Should be restricted to admin users in production
      
      **Use Cases:**
      - Administrative user management
      - Account recovery operations
      - Audit trails and reporting
      - Bulk restoration operations
    `,
        operationId: 'adminGetDeletedUsers',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Deleted users retrieved successfully',
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
                    example: 'Deleted users retrieved successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'array',
                    description: 'List of soft-deleted users',
                    items: {
                        type: 'object',
                        description: 'Deleted user profile data',
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
    async adminGetDeletedUsers(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardApiResponse> {
        try {
            this.logger.log(`Getting deleted users for admin: ${req.user.id}`);

            const deletedUsers = await this.userService.findDeleted();

            // Remove sensitive data from all users
            const sanitizedUsers = deletedUsers.map(user => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userProfile } = user;
                return userProfile;
            });

            this.logger.log(
                `Retrieved ${deletedUsers.length} deleted users for admin: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Deleted users retrieved successfully',
                data: sanitizedUsers,
            };
        } catch (error) {
            this.logger.error(
                `Error getting deleted users for admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Patch('admin/restore/:userId')
    @ApiOperation({
        summary: '♻️ Restore User by ID (Admin)',
        description: `
      **Restores a soft-deleted user account by user ID (for administrative use)**
      
      This endpoint allows administrators to restore any soft-deleted user:
      - Sets specified user status back to ACTIVE
      - Makes the account accessible again
      - Validates that target user exists and is deleted
      - Returns success confirmation only
      
      **Security Features:**
      - Requires valid JWT authentication
      - Should be restricted to admin users in production
      - Validates target user exists and is deleted
      
      **Use Cases:**
      - Administrative account recovery
      - Bulk user restoration
      - Customer support operations
      - Data recovery procedures
    `,
        operationId: 'adminRestoreUser',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User account restored successfully by admin',
        type: UserRestoredResponse,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ User is not deleted and cannot be restored',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'User is not deleted and cannot be restored',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 400,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User not found',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'User with ID xxx not found',
                },
                status: {
                    type: 'string',
                    example: 'error',
                },
                code: {
                    type: 'number',
                    example: 404,
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
    async adminRestoreUser(
        @Request() req: AuthenticatedRequest,
        @Param('userId') userId: string,
    ): Promise<StandardOperationResponse> {
        try {
            this.logger.log(`Admin ${req.user.id} restoring user: ${userId}`);

            const result = await this.userService.restoreUser(
                userId,
                req.user.id,
            );

            this.logger.log(
                `User ${userId} restored successfully by admin: ${req.user.id}`,
            );

            return result;
        } catch (error) {
            this.logger.error(
                `Error restoring user ${userId} by admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
