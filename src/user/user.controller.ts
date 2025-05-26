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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { StandardApiResponse } from './dto/common-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('User Profile')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile retrieved successfully' },
        data: {
          type: 'object',
          properties: {
            uid: { type: 'string', example: 'uuid-string' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            avatar: {
              type: 'string',
              example: 'https://example.com/avatar.jpg',
            },
            createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
            updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized access',
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
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({
    type: UpdateUserDto,
    description: 'User profile update data',
    examples: {
      example1: {
        summary: 'Update name and avatar',
        value: {
          name: 'Jane Smith',
          firstName: 'Jane',
          lastName: 'Smith',
          avatar: 'https://example.com/new-avatar.jpg',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profile updated successfully' },
        data: {
          type: 'object',
          properties: {
            uid: { type: 'string', example: 'uuid-string' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'Jane Smith' },
            firstName: { type: 'string', example: 'Jane' },
            lastName: { type: 'string', example: 'Smith' },
            avatar: {
              type: 'string',
              example: 'https://example.com/new-avatar.jpg',
            },
            updatedAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email already exists',
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
          this.logger.warn(`Email already exists: ${updateUserDto.email}`);
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
        this.logger.error(`Failed to update profile for user: ${req.user.id}`);
        return {
          success: false,
          message: 'Failed to update profile',
          data: null,
        };
      }

      // Remove sensitive data
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...userProfile } = updatedUser;

      this.logger.log(`Profile updated successfully for user: ${req.user.id}`);

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
  @ApiOperation({ summary: 'Change user password' })
  @ApiBody({
    type: ChangePasswordDto,
    description: 'Password change data',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password changed successfully' },
        data: { type: 'null' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid current password or validation errors',
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
        this.logger.warn(`Invalid current password for user: ${req.user.id}`);
        throw new BadRequestException('Current password is incorrect');
      }

      this.logger.log(`Password changed successfully for user: ${req.user.id}`);

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
