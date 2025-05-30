import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { SignInDto } from '../user/dto/sign-in.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { ResendVerificationDto } from '../user/dto/resend-verification.dto';
import { RefreshTokenDto } from '../user/dto/refresh-token.dto';
import { TokenManagerService } from './token-manager.service';
import {
    SessionResponseDto,
    StandardApiResponse,
} from '../user/dto/session-response.dto';
import { UserResponseDto } from '../user/dto/session-response.dto';

@Injectable()
export class AuthService {
    private readonly saltRounds = 12;

    constructor(
        private readonly userService: UserService,
        private readonly tokenManagerService: TokenManagerService,
    ) {}

    async signUp(
        createUserDto: CreateUserDto,
    ): Promise<StandardApiResponse<SessionResponseDto>> {
        const { email, password, firstName, lastName, avatar } = createUserDto;

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
            firstName,
            lastName,
            avatar,
        });

        // Generate JWT tokens
        const tokenPair = await this.tokenManagerService.generateTokenPair({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        });

        // Return user without password
        const userResponse: UserResponseDto = {
            uid: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            role: user.role,
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

    async signIn(
        signInDto: SignInDto,
    ): Promise<StandardApiResponse<SessionResponseDto>> {
        const { email, password } = signInDto;

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

        // Generate JWT tokens
        const tokenPair = await this.tokenManagerService.generateTokenPair({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        });

        // Return user without password
        const userResponse: UserResponseDto = {
            uid: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            role: user.role,
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

    async forgotPassword(
        forgotPasswordDto: ForgotPasswordDto,
    ): Promise<StandardApiResponse<any>> {
        const { email } = forgotPasswordDto;

        // Check if user exists
        const user = await this.userService.findByEmail(email);
        if (!user) {
            // Return success even if user doesn't exist for security
            return {
                success: true,
                message:
                    'If an account with that email exists, a password reset link has been sent.',
            };
        }

        // TODO: Generate password reset token and send email
        // Waiting for communications service setup (email provider integration)
        // For now, just return success message
        return {
            success: true,
            message:
                'If an account with that email exists, a password reset link has been sent.',
        };
    }

    async resetPassword(
        resetPasswordDto: ResetPasswordDto,
    ): Promise<StandardApiResponse<any>> {
        const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            token: _token,
            password,
            confirmPassword,
        } = resetPasswordDto;

        if (password !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        // TODO: Validate reset token and update password
        // Waiting for communications service setup (email token validation)
        // For now, just return placeholder
        await Promise.resolve(); // Keep async for future implementation
        throw new BadRequestException(
            'Password reset functionality not yet implemented',
        );
    }

    async verifyEmail(
        verifyEmailDto: VerifyEmailDto,
    ): Promise<StandardApiResponse<any>> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { token: _token } = verifyEmailDto;

        // TODO: Validate email verification token
        // Waiting for communications service setup (email verification system)
        // For now, just return placeholder
        await Promise.resolve(); // Keep async for future implementation
        return {
            success: true,
            message: 'Email verification functionality not yet implemented',
        };
    }

    async resendVerification(
        resendVerificationDto: ResendVerificationDto,
    ): Promise<StandardApiResponse<any>> {
        const { email } = resendVerificationDto;

        // Check if user exists
        const user = await this.userService.findByEmail(email);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // TODO: Generate verification token and send email
        // Waiting for communications service setup (email delivery service)
        // For now, just return success message
        return {
            success: true,
            message: 'Verification email sent',
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(
        refreshTokenDto: RefreshTokenDto,
    ): Promise<StandardApiResponse<any>> {
        const { refreshToken } = refreshTokenDto;

        try {
            // Validate refresh token
            const validation =
                this.tokenManagerService.validateRefreshToken(refreshToken);

            if (!validation.isValid) {
                throw new UnauthorizedException(
                    'Invalid or expired refresh token',
                );
            }

            // Find user by ID from refresh token
            const user = await this.userService.findById(validation.userId);
            if (!user) {
                throw new UnauthorizedException('User not found');
            }

            // Generate new token pair
            const newTokenPair =
                await this.tokenManagerService.refreshAccessToken(
                    refreshToken,
                    {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                    },
                );

            return {
                success: true,
                data: {
                    accessToken: newTokenPair.accessToken,
                    refreshToken: newTokenPair.refreshToken,
                    expiresIn: newTokenPair.expiresIn,
                },
                message: 'Token refreshed successfully',
            };
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                throw error;
            }
            throw new UnauthorizedException('Invalid refresh token');
        }
    }
}
