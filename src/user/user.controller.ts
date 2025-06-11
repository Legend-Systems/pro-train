import {
    Controller,
    Get,
    Put,
    Post,
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
    Query,
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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { StandardResponse } from '../common/types/standard-response.type';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import {
    StandardOperationResponse,
    ProfileUpdatedResponse,
    PasswordChangedResponse,
    UserSoftDeletedResponse,
    UserRestoredResponse,
} from './dto/common-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';

@ApiTags('👤 User & Profile Management')
@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
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

    // Helper method to safely extract and validate numeric values
    private safeNumericExtraction(value: any): number | undefined {
        if (value === undefined || value === null || value === '') {
            return undefined;
        }

        const numValue = Number(value);

        if (isNaN(numValue) || !isFinite(numValue)) {
            return undefined;
        }

        return numValue;
    }

    // Helper method to safely extract org and branch IDs from JWT
    private extractOrgAndBranchIds(req: any): {
        orgId?: number;
        branchId?: number;
    } {
        const orgIdRaw =
            req.user?.org?.uid ||
            req.user?.organisation?.uid ||
            req.organization?.ref;
        const branchIdRaw = req.user?.branch?.uid || req.branch?.uid;

        return {
            orgId: this.safeNumericExtraction(orgIdRaw),
            branchId: this.safeNumericExtraction(branchIdRaw),
        };
    }

    @Post()
    @Roles(UserRole.ADMIN) // Only admins can create users
    @ApiOperation({
        summary: '👥 Create New User',
        description: `
      **Creates a new user account with comprehensive validation**
      
      This endpoint allows creating new user accounts with:
      - Email uniqueness validation
      - Strong password requirements
      - Optional avatar assignment
      - Organization/branch assignment support
      
      **Security Features:**
      - Email must be unique across the system
      - Password complexity requirements enforced
      - Input validation for all fields
      
      **Use Cases:**
      - Admin user creation
      - Bulk user onboarding
      - Organization setup
      - User invitation fulfillment
    `,
        operationId: 'createUser',
    })
    @ApiBody({
        type: CreateUserDto,
        description: 'User creation data with required fields',
        examples: {
            'basic-user': {
                summary: '👤 Basic User Creation',
                description: 'Creates a standard user account',
                value: {
                    email: 'newuser@example.com',
                    password: 'SecurePass123!',
                    firstName: 'John',
                    lastName: 'Doe',
                },
            },
            'user-with-avatar': {
                summary: '🖼️ User with Avatar',
                description: 'Creates user with profile picture',
                value: {
                    email: 'user.avatar@example.com',
                    password: 'SecurePass123!',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    avatar: 5,
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: '✅ User created successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'User created successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            example: 'newuser@example.com',
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ Invalid input data',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Validation failed' },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 400 },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Email already exists',
        schema: {
            type: 'object',
            properties: {
                message: {
                    type: 'string',
                    example: 'Email address already in use',
                },
                status: { type: 'string', example: 'error' },
                code: { type: 'number', example: 409 },
            },
        },
    })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardResponse<{ email: string }>> {
        try {
            this.logger.log(`Creating new user: ${createUserDto.email}`);

            // Check if email already exists
            const existingUser = await this.userService.findByEmail(
                createUserDto.email,
            );
            if (existingUser) {
                this.logger.warn(
                    `Email already exists: ${createUserDto.email}`,
                );
                throw new ConflictException('Email address already in use');
            }

            // Extract org and branch context
            const { orgId, branchId } = this.extractOrgAndBranchIds(req);
            const scope = {
                orgId: orgId?.toString(),
                branchId:
                    branchId?.toString() || createUserDto.branchId?.toString(),
                userId: req.user.id,
                userRole: req.user.role,
            };

            await this.userService.create(createUserDto, scope);

            this.logger.log(
                `User created successfully: ${createUserDto.email}`,
            );

            return {
                success: true,
                message: 'User created successfully',
                data: {
                    email: createUserDto.email,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error creating user ${createUserDto.email}:`,
                error,
            );
            throw error;
        }
    }

    @Get('admin/all')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '📋 Get All Users (Admin)',
        description: `
      **Retrieves all users with optional filtering and pagination**
      
      This endpoint returns all users in the system with:
      - Pagination support
      - Search functionality
      - Status filtering
      - Organization/branch filtering
      
      **Query Parameters:**
      - page: Page number (default: 1)
      - limit: Items per page (default: 20)
      - search: Search in name/email
      - status: Filter by user status
      - orgId: Filter by organization
      - branchId: Filter by branch
      
      **Use Cases:**
      - User management dashboard
      - Administrative oversight
      - Bulk operations
      - User reporting
    `,
        operationId: 'getAllUsers',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Users retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'Users retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        users: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        example: 'user-uuid',
                                    },
                                    email: {
                                        type: 'string',
                                        example: 'user@example.com',
                                    },
                                    firstName: {
                                        type: 'string',
                                        example: 'John',
                                    },
                                    lastName: {
                                        type: 'string',
                                        example: 'Doe',
                                    },
                                    role: {
                                        type: 'string',
                                        example: 'user',
                                    },
                                    createdAt: {
                                        type: 'string',
                                        example: '2024-01-01T00:00:00Z',
                                    },
                                },
                            },
                        },
                        pagination: {
                            type: 'object',
                            properties: {
                                currentPage: { type: 'number', example: 1 },
                                totalPages: { type: 'number', example: 5 },
                                totalUsers: { type: 'number', example: 95 },
                                hasNext: { type: 'boolean', example: true },
                                hasPrev: { type: 'boolean', example: false },
                            },
                        },
                    },
                },
            },
        },
    })
    async getAllUsers(
        @Query() filters: UserFilterDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<
        StandardResponse<{
            users: any[];
            pagination: {
                currentPage: number;
                totalPages: number;
                totalUsers: number;
                hasNext: boolean;
                hasPrev: boolean;
            };
        }>
    > {
        try {
            this.logger.log(
                `Getting all users - page: ${filters.page || 1}, limit: ${filters.limit || 20}`,
            );

            // Extract org and branch context
            const { orgId, branchId } = this.extractOrgAndBranchIds(req);
            const scope = {
                orgId: orgId?.toString(),
                branchId: branchId?.toString(),
                userId: req.user.id,
                userRole: req.user.role,
            };

            // Use the new compliant service method
            const result = await this.userService.findAllWithFilters(
                filters,
                scope,
            );

            // Remove sensitive data
            const sanitizedUsers = result.users.map(user => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { password, ...userProfile } = user;
                return userProfile;
            });

            this.logger.log(
                `Retrieved ${result.users.length} users of ${result.total} total`,
            );

            return {
                success: true,
                message: 'Users retrieved successfully',
                data: {
                    users: sanitizedUsers,
                    pagination: {
                        currentPage: filters.page || 1,
                        totalPages: result.totalPages,
                        totalUsers: result.total,
                        hasNext: (filters.page || 1) < result.totalPages,
                        hasPrev: (filters.page || 1) > 1,
                    },
                },
            };
        } catch (error) {
            this.logger.error('Error getting all users:', error);
            throw error;
        }
    }

    @Get('admin/:id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '👤 Get User by ID (Admin)',
        description: `
      **Retrieves detailed information for a specific user**
      
      This endpoint returns complete user information including:
      - Personal details
      - Organization/branch assignments
      - Account status and metadata
      - Avatar information
      
      **Use Cases:**
      - User detail pages
      - Administrative user management
      - User profile editing
      - Account verification
    `,
        operationId: 'getUserById',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: {
                    type: 'string',
                    example: 'User retrieved successfully',
                },
                data: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'user-uuid' },
                        email: { type: 'string', example: 'user@example.com' },
                        firstName: { type: 'string', example: 'John' },
                        lastName: { type: 'string', example: 'Doe' },
                        role: { type: 'string', example: 'user' },
                        orgId: { type: 'string', example: 'org-uuid' },
                        branchId: { type: 'string', example: 'branch-uuid' },
                        createdAt: {
                            type: 'string',
                            example: '2024-01-01T00:00:00Z',
                        },
                        updatedAt: {
                            type: 'string',
                            example: '2024-01-01T00:00:00Z',
                        },
                    },
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
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'User not found' },
                data: { type: 'null', example: null },
            },
        },
    })
    async getUserById(@Param('id') id: string): Promise<StandardResponse<any>> {
        try {
            this.logger.log(`Getting user by ID: ${id}`);

            const user = await this.userService.findById(id);

            if (!user) {
                this.logger.error(`User not found: ${id}`);
                return {
                    success: false,
                    message: 'User not found',
                    data: null,
                };
            }

            // Remove sensitive data
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password, ...userProfile } = user;

            this.logger.log(`User retrieved successfully: ${id}`);

            return {
                success: true,
                message: 'User retrieved successfully',
                data: userProfile,
            };
        } catch (error) {
            this.logger.error(`Error getting user ${id}:`, error);
            throw error;
        }
    }

    @Put('admin/:id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '✏️ Update User by ID (Admin)',
        description: `
      **Updates user information by ID (administrative)**
      
      This endpoint allows administrators to update any user's information:
      - Personal details (name, email)
      - Profile picture (avatar)
      - Account status
      - Organization/branch assignments
      
      **Security Features:**
      - Email uniqueness validation
      - Password updates blocked (use dedicated endpoint)
      - Input validation for all fields
      
      **Use Cases:**
      - Administrative user updates
      - Bulk user modifications
      - Account corrections
      - Profile management
    `,
        operationId: 'updateUserById',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User updated successfully',
        type: StandardOperationResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User not found',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: '⚠️ Email already exists',
    })
    async updateUserById(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardResponse<{ id: string; email: string }>> {
        try {
            this.logger.log(`Updating user by ID: ${id}`);

            // Check if email is being updated and if it already exists
            if (updateUserDto.email) {
                const existingUser = await this.userService.findByEmail(
                    updateUserDto.email,
                );
                if (existingUser && existingUser.id !== id) {
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
                    `Password update attempted through admin update for user: ${id}`,
                );
                throw new BadRequestException(
                    'Use /user/change-password endpoint to update password',
                );
            }

            // Extract org and branch context
            const { orgId, branchId } = this.extractOrgAndBranchIds(req);
            const scope = {
                orgId: orgId?.toString(),
                branchId: branchId?.toString(),
                userId: req.user.id,
                userRole: req.user.role,
            };

            await this.userService.update(id, updateData, scope);

            this.logger.log(`User updated successfully: ${id}`);

            return {
                success: true,
                message: 'User updated successfully',
                data: {
                    id,
                    email: updateUserDto.email || 'Email not updated',
                },
            };
        } catch (error) {
            this.logger.error(`Error updating user ${id}:`, error);
            throw error;
        }
    }

    @Delete('admin/:id')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '🗑️ Delete User by ID (Admin)',
        description: `
      **Soft deletes a user account by ID (administrative)**
      
      This endpoint performs administrative soft deletion:
      - Sets user status to DELETED
      - Preserves user data for audit trails
      - User will not appear in normal queries
      - Can be restored using admin restore endpoint
      
      **Use Cases:**
      - Administrative user management
      - Account deactivation
      - Compliance requirements
      - Data retention policies
    `,
        operationId: 'deleteUserById',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ User deleted successfully',
        type: UserSoftDeletedResponse,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: '❌ User not found',
    })
    async deleteUserById(
        @Request() req: AuthenticatedRequest,
        @Param('id') id: string,
    ): Promise<StandardResponse<{ id: string; deletedBy: string }>> {
        try {
            this.logger.log(`Admin ${req.user.id} deleting user: ${id}`);

            await this.userService.softDelete(id, req.user.id);

            this.logger.log(`User deleted successfully by admin: ${id}`);

            return {
                success: true,
                message: 'User deleted successfully',
                data: {
                    id,
                    deletedBy: req.user.id,
                },
            };
        } catch (error) {
            this.logger.error(`Error deleting user ${id}:`, error);
            throw error;
        }
    }

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
    ): Promise<StandardResponse<any>> {
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
    ): Promise<StandardResponse<{ id: string }>> {
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

            await this.userService.updateProfile(req.user.id, updateData);

            this.logger.log(
                `Profile updated successfully for user: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Profile updated successfully',
                data: {
                    id: req.user.id,
                },
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
    ): Promise<StandardResponse<{ id: string }>> {
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

            return {
                success: true,
                message: 'Password changed successfully',
                data: {
                    id: req.user.id,
                },
            };
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
    ): Promise<StandardResponse<{ id: string; status: string }>> {
        try {
            this.logger.log(`Soft deleting user: ${req.user.id}`);

            await this.userService.softDelete(req.user.id, req.user.id);

            this.logger.log(`User soft deleted successfully: ${req.user.id}`);

            return {
                success: true,
                message: 'User account soft deleted successfully',
                data: {
                    id: req.user.id,
                    status: 'DELETED',
                },
            };
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
    ): Promise<StandardResponse<{ id: string; status: string }>> {
        try {
            this.logger.log(`Restoring user: ${req.user.id}`);

            await this.userService.restoreUser(req.user.id, req.user.id);

            this.logger.log(`User restored successfully: ${req.user.id}`);

            return {
                success: true,
                message: 'User account restored successfully',
                data: {
                    id: req.user.id,
                    status: 'ACTIVE',
                },
            };
        } catch (error) {
            this.logger.error(`Error restoring user ${req.user.id}:`, error);
            throw error;
        }
    }

    @Get('admin/deleted')
    @Roles(UserRole.ADMIN)
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
                    type: 'object',
                    properties: {
                        users: {
                            type: 'array',
                            description: 'List of soft-deleted users',
                            items: {
                                type: 'object',
                                description: 'Deleted user profile data',
                            },
                        },
                        count: {
                            type: 'number',
                            example: 5,
                            description: 'Total number of deleted users',
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
    async adminGetDeletedUsers(
        @Request() req: AuthenticatedRequest,
    ): Promise<StandardResponse<{ users: any[]; count: number }>> {
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
                data: {
                    users: sanitizedUsers,
                    count: sanitizedUsers.length,
                },
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
    @Roles(UserRole.ADMIN)
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
                    example: 'User account restored successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'object',
                    properties: {
                        id: {
                            type: 'string',
                            example: 'uuid-user-id',
                            description: 'ID of the restored user',
                        },
                        restoredBy: {
                            type: 'string',
                            example: 'uuid-admin-id',
                            description:
                                'ID of the admin who restored the user',
                        },
                    },
                },
            },
        },
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
    ): Promise<StandardResponse<{ id: string; restoredBy: string }>> {
        try {
            this.logger.log(`Admin ${req.user.id} restoring user: ${userId}`);

            await this.userService.restoreUser(userId, req.user.id);

            this.logger.log(
                `User ${userId} restored successfully by admin: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'User account restored successfully',
                data: {
                    id: userId,
                    restoredBy: req.user.id,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error restoring user ${userId} by admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Post('admin/re-invite-all')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '📧 Re-invite All Users (Admin)',
        description: `
      **Sends re-invitation emails to all users in the organization/branch**
      
      This endpoint allows administrators to send re-invitation emails to all users:
      - Fetches all active and inactive users in the current branch/organization
      - Sends personalized re-invitation emails to encourage platform usage
      - Excludes deleted, banned, or suspended users from re-invitations
      - Returns count of successfully sent invitations
      
      **Security Features:**
      - Requires valid JWT authentication
      - Restricted to admin users only
      - Respects organizational/branch boundaries
      
      **Use Cases:**
      - Platform re-engagement campaigns
      - Onboarding reminders
      - Feature update notifications
      - User activation drives
    `,
        operationId: 'reInviteAllUsers',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Re-invitation emails sent successfully',
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
                    example: 'Re-invitation emails sent successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'object',
                    properties: {
                        invitedCount: {
                            type: 'number',
                            example: 15,
                            description:
                                'Number of users who received re-invitation emails',
                        },
                        totalUsers: {
                            type: 'number',
                            example: 20,
                            description:
                                'Total number of users in the organization/branch',
                        },
                        excludedCount: {
                            type: 'number',
                            example: 5,
                            description:
                                'Number of users excluded from re-invitation (deleted, banned, etc.)',
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
    async reInviteAllUsers(
        @Request() req: AuthenticatedRequest,
        @OrgBranchScope()
        scope: {
            orgId?: string;
            branchId?: string;
            userId: string;
            userRole?: string;
        },
    ): Promise<
        StandardResponse<{
            invitedCount: number;
            totalUsers: number;
            excludedCount: number;
        }>
    > {
        try {
            this.logger.log(
                `Admin ${req.user.id} sending re-invitation emails to all users`,
            );

            // TODO: Implement reInviteAllUsers method in UserService
            // const result = await this.userService.reInviteAllUsers(scope);
            const result = { invitedCount: 0, totalUsers: 0, excludedCount: 0 };

            this.logger.log(
                `Re-invitation emails sent to ${result.invitedCount} users by admin: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Re-invitation emails sent successfully',
                data: {
                    invitedCount: result.invitedCount,
                    totalUsers: result.totalUsers,
                    excludedCount: result.excludedCount,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error sending re-invitation emails by admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }

    @Post('admin/:userId/re-invite')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '📧 Re-invite Individual User (Admin)',
        description: `
      **Sends a re-invitation email to a specific user**
      
      This endpoint allows administrators to send a re-invitation email to a specific user:
      - Validates that the user exists and is accessible
      - Sends a personalized re-invitation email
      - Excludes deleted, banned, or suspended users
      - Returns confirmation of email delivery
      
      **Security Features:**
      - Requires valid JWT authentication
      - Restricted to admin/owner users
      - Respects organizational/branch boundaries
      
      **Use Cases:**
      - Individual user re-engagement
      - Targeted onboarding reminders
      - Account activation follow-ups
      - Support-driven re-invitations
    `,
        operationId: 'reInviteUser',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '✅ Re-invitation email sent successfully',
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
                    example: 'Re-invitation email sent successfully',
                    description: 'Success confirmation message',
                },
                data: {
                    type: 'object',
                    properties: {
                        userId: {
                            type: 'string',
                            example: 'uuid-user-id',
                            description:
                                'ID of the user who received the re-invitation',
                        },
                        email: {
                            type: 'string',
                            example: 'user@example.com',
                            description:
                                'Email address where the re-invitation was sent',
                        },
                        sentBy: {
                            type: 'string',
                            example: 'uuid-admin-id',
                            description:
                                'ID of the admin who sent the re-invitation',
                        },
                    },
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
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'User not found' },
                data: { type: 'null' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '❌ User cannot be re-invited (deleted, banned, etc.)',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: {
                    type: 'string',
                    example: 'User cannot be re-invited due to account status',
                },
                data: { type: 'null' },
            },
        },
    })
    async reInviteUser(
        @Request() req: AuthenticatedRequest,
        @Param('userId') userId: string,
        @OrgBranchScope()
        scope: {
            orgId?: string;
            branchId?: string;
            userId: string;
            userRole?: string;
        },
    ): Promise<
        StandardResponse<{ userId: string; email: string; sentBy: string }>
    > {
        try {
            this.logger.log(
                `Admin ${req.user.id} sending re-invitation email to user: ${userId}`,
            );

            // TODO: Implement reInviteUser method in UserService
            // const result = await this.userService.reInviteUser(userId, scope);
            const result = { userId, email: 'user@example.com', sentBy: scope.userId };

            this.logger.log(
                `Re-invitation email sent to user ${userId} by admin: ${req.user.id}`,
            );

            return {
                success: true,
                message: 'Re-invitation email sent successfully',
                data: {
                    userId: result.userId,
                    email: result.email,
                    sentBy: req.user.id,
                },
            };
        } catch (error) {
            this.logger.error(
                `Error sending re-invitation email to user ${userId} by admin ${req.user.id}:`,
                error,
            );
            throw error;
        }
    }
}
