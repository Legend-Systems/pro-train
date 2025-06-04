import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { SignInDto } from '../user/dto/sign-in.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { ResendVerificationDto } from '../user/dto/resend-verification.dto';
import { RefreshTokenDto } from '../user/dto/refresh-token.dto';
import { SendInvitationDto } from './dto/send-invitation.dto';
import { ValidateInvitationDto } from './dto/validate-invitation.dto';
import { TokenManagerService } from './token-manager.service';
import {
    SessionResponseDto,
    SignUpResponseDto,
    StandardApiResponse,
} from '../user/dto/session-response.dto';
import { UserResponseDto } from '../user/dto/session-response.dto';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { UserStatsResponseDto } from '../leaderboard/dto/user-stats-response.dto';
import { plainToClass } from 'class-transformer';
import { EmailTemplateService } from '../communications/services/email-template.service';
import {
    EmailQueueService,
    EmailJobPriority,
} from '../communications/services/email-queue.service';
import { EmailType } from '../communications/entities/communication.entity';
import { ConfigService } from '@nestjs/config';
import {
    ImageVariant,
    MediaFile,
} from '../media-manager/entities/media-manager.entity';
import { OrgService } from '../org/org.service';

@Injectable()
export class AuthService {
    private readonly saltRounds = 12;

    constructor(
        private readonly userService: UserService,
        private readonly tokenManagerService: TokenManagerService,
        private readonly leaderboardService: LeaderboardService,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly emailQueueService: EmailQueueService,
        private readonly configService: ConfigService,
        private readonly orgService: OrgService,
    ) {}

    /**
     * Transform MediaFile avatar to response format with variants
     */
    private transformAvatarForResponse(avatar?: MediaFile):
        | {
              id: number;
              originalName?: string;
              url?: string;
              thumbnail?: string;
              medium?: string;
              original?: string;
          }
        | undefined {
        if (!avatar) return undefined;

        // Base response with original file data
        const response = {
            id: avatar.id,
            originalName: avatar.originalName,
            url: avatar.url,
            original: avatar.url,
            thumbnail: avatar.url, // fallback to original if no thumbnail
            medium: avatar.url, // fallback to original if no medium
        };

        // If variants are loaded, use them to populate specific URLs
        if (avatar.variants && avatar.variants.length > 0) {
            avatar.variants.forEach(variant => {
                if (variant.variant === ImageVariant.THUMBNAIL) {
                    response.thumbnail = variant.url;
                } else if (variant.variant === ImageVariant.MEDIUM) {
                    response.medium = variant.url;
                }
            });
        }

        return response;
    }

    /**
     * Get accessible organizations and branches based on user's role level
     */
    private async getAccessibleData(user: User): Promise<{
        accessibleOrganizations: {
            id: string;
            name: string;
            avatar?: string;
        }[];
        accessibleBranches: {
            id: string;
            name: string;
            email?: string;
            address?: string;
            contactNumber?: string;
            managerName?: string;
            organizationId: string;
        }[];
        permissions: {
            canAccessAllOrganizations: boolean;
            canAccessAllBranches: boolean;
            crossOrgAccess: boolean;
            crossBranchAccess: boolean;
        };
    }> {
        const permissions = {
            canAccessAllOrganizations: false,
            canAccessAllBranches: false,
            crossOrgAccess: false,
            crossBranchAccess: false,
        };

        let accessibleOrganizations: {
            id: string;
            name: string;
            avatar?: string;
            branches?: any[];
        }[] = [];
        let accessibleBranches: {
            id: string;
            name: string;
            email?: string;
            address?: string;
            contactNumber?: string;
            managerName?: string;
            organization?: { id: string };
            organizationId?: string;
        }[] = [];

        switch (user.role) {
            case UserRole.BRANDON:
                // BRANDON - Super admin, access to everything
                permissions.canAccessAllOrganizations = true;
                permissions.canAccessAllBranches = true;
                permissions.crossOrgAccess = true;
                permissions.crossBranchAccess = true;

                accessibleOrganizations =
                    await this.orgService.findAllOrganizations();
                // Get all branches across all organizations
                for (const org of accessibleOrganizations) {
                    if (org.branches && Array.isArray(org.branches)) {
                        accessibleBranches.push(...org.branches);
                    }
                }
                break;

            case UserRole.ADMIN:
                // ADMIN - Organization admin, can manage users within org (+ cross-org when allowed)
                permissions.crossOrgAccess = true; // Admins can have cross-org access when allowed
                permissions.crossBranchAccess = true;

                if (user.orgId) {
                    // Get user's organization and all its branches
                    try {
                        const userOrg =
                            await this.orgService.findOrganizationById(
                                user.orgId.id,
                            );
                        accessibleOrganizations = [userOrg];
                        accessibleBranches = userOrg.branches || [];
                    } catch {
                        // If user's org not found, they have access to their assigned data only
                        if (user.orgId) {
                            accessibleOrganizations = [user.orgId];
                        }
                        if (user.branchId) {
                            accessibleBranches = [user.branchId];
                        }
                    }
                } else {
                    // Admin without org assignment - no additional access
                    accessibleOrganizations = [];
                    accessibleBranches = [];
                }
                break;

            case UserRole.OWNER:
                // OWNER - Organization owner, can manage users within their organization
                permissions.crossBranchAccess = true; // Owners have access to all branches within their org

                if (user.orgId) {
                    try {
                        const userOrg =
                            await this.orgService.findOrganizationById(
                                user.orgId.id,
                            );
                        accessibleOrganizations = [userOrg];
                        accessibleBranches = userOrg.branches || [];
                    } catch {
                        // If user's org not found, they have access to their assigned data only
                        if (user.orgId) {
                            accessibleOrganizations = [user.orgId];
                        }
                        if (user.branchId) {
                            accessibleBranches = [user.branchId];
                        }
                    }
                } else {
                    // Owner without org assignment
                    accessibleOrganizations = [];
                    accessibleBranches = [];
                }
                break;

            case UserRole.USER:
            default:
                // USER - Regular user, access only to their specific org and branch
                if (user.orgId) {
                    accessibleOrganizations = [user.orgId];
                }
                if (user.branchId) {
                    accessibleBranches = [user.branchId];
                }
                break;
        }

        // Transform the data to include only necessary fields
        const transformedOrgs = accessibleOrganizations.map(org => ({
            id: String(org.id),
            name: String(org.name),
            avatar: org.avatar || undefined,
        }));

        const transformedBranches = accessibleBranches.map(branch => ({
            id: String(branch.id),
            name: String(branch.name),
            email: branch.email || undefined,
            address: branch.address || undefined,
            contactNumber: branch.contactNumber || undefined,
            managerName: branch.managerName || undefined,
            organizationId: String(branch.organization?.id || branch.organizationId || ''),
        }));

        return {
            accessibleOrganizations: transformedOrgs,
            accessibleBranches: transformedBranches,
            permissions,
        };
    }

    async signUp(
        createUserDto: CreateUserDto,
    ): Promise<StandardApiResponse<SignUpResponseDto>> {
        const {
            email,
            password,
            firstName,
            lastName,
            avatar,
            invitationToken,
        } = createUserDto;

        // Check if user already exists
        const existingUser = await this.userService.findByEmail(email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Validate invitation token if provided
        let invitationData: {
            organizationId?: string;
            branchId?: string;
            email?: string;
        } | null = null;
        if (invitationToken) {
            const tokenValidation =
                this.tokenManagerService.validateInvitationToken(
                    invitationToken,
                );
            if (!tokenValidation.isValid) {
                throw new BadRequestException(
                    'Invalid or expired invitation token',
                );
            }

            // Ensure email matches invitation
            if (tokenValidation.email !== email) {
                throw new BadRequestException(
                    'Email does not match invitation',
                );
            }

            invitationData = tokenValidation.data as {
                organizationId?: string;
                branchId?: string;
                email?: string;
            };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, this.saltRounds);

        // Create user with org/branch from invitation if available
        await this.userService.create({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            avatar,
        });

        // Fetch the created user
        const user = await this.userService.findByEmail(email);
        if (!user) {
            throw new Error('Failed to retrieve user after creation');
        }

        // Assign organization and branch if from invitation
        if (
            invitationData &&
            (invitationData.organizationId || invitationData.branchId)
        ) {
            await this.userService.assignOrgAndBranch(
                user.id,
                invitationData.organizationId,
                invitationData.branchId,
            );
        }

        // Revoke invitation tokens for this email
        if (invitationToken) {
            this.tokenManagerService.revokeInvitationTokensByEmail(email);
        }

        // Send welcome email notification (not tokens)
        await this.sendWelcomeEmail(user);

        // Fetch updated user with org/branch details if assigned
        const updatedUser =
            await this.userService.findByEmailWithFullDetails(email);

        if (!updatedUser) {
            throw new Error('Failed to retrieve user after creation');
        }

        // Return user without password
        const userResponse: UserResponseDto = {
            uid: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            avatar: this.transformAvatarForResponse(updatedUser.avatar),
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
        };

        return {
            success: true,
            data: {
                user: userResponse,
                organization: updatedUser.orgId
                    ? {
                          id: updatedUser.orgId.id,
                          name: updatedUser.orgId.name,
                          avatar: updatedUser.orgId.logoUrl,
                      }
                    : undefined,
                branch: updatedUser.branchId
                    ? {
                          id: updatedUser.branchId.id,
                          name: updatedUser.branchId.name,
                          email: updatedUser.branchId.email,
                          address: updatedUser.branchId.address,
                          contactNumber: updatedUser.branchId.contactNumber,
                          managerName: updatedUser.branchId.managerName,
                      }
                    : undefined,
            },
            message:
                'Account created successfully. Please sign in with your credentials.',
        };
    }

    async signIn(
        signInDto: SignInDto,
    ): Promise<StandardApiResponse<SessionResponseDto>> {
        const { email, password } = signInDto;

        // Find user by email with full org/branch details
        const user = await this.userService.findByEmailWithFullDetails(email);
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
            orgId: user.orgId?.id,
            branchId: user.branchId?.id,
        });

        // Get user leaderboard stats
        const userStats = await this.leaderboardService.getUserOverallStats(
            user.id,
        );
        const leaderboardData = plainToClass(UserStatsResponseDto, userStats, {
            excludeExtraneousValues: true,
        });

        // Get accessible organizations and branches based on user's role
        const accessData = await this.getAccessibleData(user);

        // Return user without password
        const userResponse: UserResponseDto = {
            uid: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: this.transformAvatarForResponse(user.avatar),
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
                leaderboard: leaderboardData,
                organization: user.orgId
                    ? {
                          id: user.orgId.id,
                          name: user.orgId.name,
                          avatar: user.orgId.logoUrl,
                      }
                    : undefined,
                branch: user.branchId
                    ? {
                          id: user.branchId.id,
                          name: user.branchId.name,
                          email: user.branchId.email,
                          address: user.branchId.address,
                          contactNumber: user.branchId.contactNumber,
                          managerName: user.branchId.managerName,
                      }
                    : undefined,
                // Add role-based accessible data
                accessibleOrganizations: accessData.accessibleOrganizations,
                accessibleBranches: accessData.accessibleBranches,
                permissions: accessData.permissions,
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

        // Revoke any existing password reset tokens for this user
        this.tokenManagerService.revokeUserSpecialTokens(
            user.id,
            'password_reset',
        );

        // Generate password reset token
        const { token, expiresAt } =
            this.tokenManagerService.generatePasswordResetToken(
                user.id,
                user.email,
            );

        // Send password reset email
        await this.sendPasswordResetEmail(user, token, expiresAt);

        return {
            success: true,
            message:
                'If an account with that email exists, a password reset link has been sent.',
        };
    }

    async resetPassword(
        resetPasswordDto: ResetPasswordDto,
    ): Promise<StandardApiResponse<any>> {
        const { token, password, confirmPassword } = resetPasswordDto;

        if (password !== confirmPassword) {
            throw new BadRequestException('Passwords do not match');
        }

        // Validate reset token
        const tokenValidation =
            this.tokenManagerService.validatePasswordResetToken(token);
        if (!tokenValidation.isValid || !tokenValidation.userId) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Find user
        const user = await this.userService.findById(tokenValidation.userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, this.saltRounds);

        // Update user password
        await this.userService.updatePassword(user.id, hashedPassword);

        // Revoke all tokens for the user
        this.tokenManagerService.revokeAllUserTokens(user.id);

        // Consume the reset token
        this.tokenManagerService.consumeSpecialToken(token);

        // Send password changed confirmation email
        await this.sendPasswordChangedEmail(user);

        return {
            success: true,
            message: 'Password has been successfully reset.',
        };
    }

    async verifyEmail(
        verifyEmailDto: VerifyEmailDto,
    ): Promise<StandardApiResponse<any>> {
        const { token } = verifyEmailDto;

        // Validate email verification token
        const tokenValidation =
            this.tokenManagerService.validateEmailVerificationToken(token);
        if (!tokenValidation.isValid || !tokenValidation.userId) {
            throw new BadRequestException(
                'Invalid or expired verification token',
            );
        }

        // Find user
        const user = await this.userService.findById(tokenValidation.userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Mark email as verified
        await this.userService.verifyEmail(user.id);

        // Consume the verification token
        this.tokenManagerService.consumeSpecialToken(token);

        return {
            success: true,
            message: 'Email has been successfully verified.',
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

        // Check if email is already verified
        if (user.emailVerified) {
            return {
                success: true,
                message: 'Email is already verified',
            };
        }

        // Revoke any existing verification tokens for this user
        this.tokenManagerService.revokeUserSpecialTokens(
            user.id,
            'email_verification',
        );

        // Generate new verification token
        const { token, expiresAt } =
            this.tokenManagerService.generateEmailVerificationToken(
                user.id,
                user.email,
            );

        // Send verification email
        await this.sendEmailVerificationEmail(user, token, expiresAt);

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
                        orgId: user.orgId?.id,
                        branchId: user.branchId?.id,
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

    /**
     * Get token information for authenticated user
     */
    async getTokenInfo(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatar?: {
            id: number;
            originalName?: string;
            url?: string;
            thumbnail?: string;
            medium?: string;
            original?: string;
        };
        orgId?: string;
        branchId?: string;
        createdAt: Date;
        updatedAt: Date;
    }): Promise<StandardApiResponse<any>> {
        // Fetch user with full org/branch details
        const fullUser = await this.userService.findById(user.id);

        if (!fullUser) {
            return {
                success: false,
                message: 'User not found',
            };
        }

        return {
            success: true,
            data: {
                user: {
                    id: fullUser.id,
                    email: fullUser.email,
                    firstName: fullUser.firstName,
                    lastName: fullUser.lastName,
                    avatar: this.transformAvatarForResponse(fullUser.avatar),
                    orgId: fullUser.orgId?.id,
                    branchId: fullUser.branchId?.id,
                    createdAt: fullUser.createdAt,
                    updatedAt: fullUser.updatedAt,
                },
                scope: {
                    orgId: fullUser.orgId?.id,
                    branchId: fullUser.branchId?.id,
                },
                organization: fullUser.orgId
                    ? {
                          id: fullUser.orgId.id,
                          name: fullUser.orgId.name,
                          avatar: fullUser.orgId.logoUrl,
                      }
                    : undefined,
                branch: fullUser.branchId
                    ? {
                          id: fullUser.branchId.id,
                          name: fullUser.branchId.name,
                          email: fullUser.branchId.email,
                          address: fullUser.branchId.address,
                          contactNumber: fullUser.branchId.contactNumber,
                          managerName: fullUser.branchId.managerName,
                      }
                    : undefined,
            },
            message: 'Token information retrieved successfully',
        };
    }

    /**
     * Send welcome email to new user
     */
    private async sendWelcomeEmail(user: User): Promise<void> {
        try {
            const baseUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const appName = this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            );

            const templateData = {
                recipientName: `${user.firstName} ${user.lastName}`,
                recipientEmail: user.email,
                loginUrl: `${baseUrl}/login`,
                dashboardUrl: `${baseUrl}/dashboard`,
                profileUrl: `${baseUrl}/profile`,
                companyName: appName,
                companyUrl: baseUrl,
                supportEmail: this.configService.get<string>(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                unsubscribeUrl: `${baseUrl}/unsubscribe`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.WELCOME,
                templateData,
            );

            await this.emailQueueService.queueEmail(
                {
                    to: user.email,
                    subject: rendered.subject,
                    html: rendered.html,
                    text: rendered.text,
                },
                EmailJobPriority.HIGH,
                0, // Send immediately
                {
                    userId: user.id,
                    templateType: EmailType.WELCOME,
                },
            );
        } catch (error) {
            // Log error but don't throw - welcome email failure shouldn't block registration
            console.error('Failed to send welcome email:', error);
        }
    }

    /**
     * Send password reset email
     */
    private async sendPasswordResetEmail(
        user: User,
        token: string,
        expiresAt: Date,
    ): Promise<void> {
        try {
            const baseUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const appName = this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            );
            const resetUrl = `${baseUrl}/reset-password?token=${token}`;

            const templateData = {
                recipientName: `${user.firstName} ${user.lastName}`,
                recipientEmail: user.email,
                resetUrl,
                resetToken: token,
                expiryTime: '15 minutes',
                companyName: appName,
                companyUrl: baseUrl,
                supportEmail: this.configService.get<string>(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                unsubscribeUrl: `${baseUrl}/unsubscribe`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.PASSWORD_RESET,
                templateData,
            );

            await this.emailQueueService.queueEmail(
                {
                    to: user.email,
                    subject: rendered.subject,
                    html: rendered.html,
                    text: rendered.text,
                },
                EmailJobPriority.CRITICAL,
                0, // Send immediately
                {
                    userId: user.id,
                    templateType: EmailType.PASSWORD_RESET,
                    tokenExpiresAt: expiresAt,
                },
            );
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Send email verification email
     */
    private async sendEmailVerificationEmail(
        user: User,
        token: string,
        expiresAt: Date,
    ): Promise<void> {
        try {
            const baseUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const appName = this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            );
            const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

            const templateData = {
                recipientName: `${user.firstName} ${user.lastName}`,
                recipientEmail: user.email,
                verificationUrl,
                verificationToken: token,
                expiryTime: '24 hours',
                companyName: appName,
                companyUrl: baseUrl,
                supportEmail: this.configService.get<string>(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                unsubscribeUrl: `${baseUrl}/unsubscribe`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.EMAIL_VERIFICATION,
                templateData,
            );

            await this.emailQueueService.queueEmail(
                {
                    to: user.email,
                    subject: rendered.subject,
                    html: rendered.html,
                    text: rendered.text,
                },
                EmailJobPriority.HIGH,
                0, // Send immediately
                {
                    userId: user.id,
                    templateType: EmailType.EMAIL_VERIFICATION,
                    tokenExpiresAt: expiresAt,
                },
            );
        } catch (error) {
            console.error('Failed to send email verification email:', error);
            throw new Error('Failed to send verification email');
        }
    }

    /**
     * Send invitation email to a user
     */
    async sendInvitation(
        sendInvitationDto: SendInvitationDto,
        inviterUserId: string,
    ): Promise<StandardApiResponse<any>> {
        const { email, message, organizationId, branchId } = sendInvitationDto;

        // Check if user already exists
        const existingUser = await this.userService.findByEmail(email);
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Get inviter information
        const inviter = await this.userService.findById(inviterUserId);
        if (!inviter) {
            throw new NotFoundException('Inviter not found');
        }

        // Revoke any existing invitation tokens for this email
        this.tokenManagerService.revokeInvitationTokensByEmail(email);

        // Generate invitation token
        const { token, expiresAt } =
            this.tokenManagerService.generateInvitationToken(
                email,
                inviterUserId,
                `${inviter.firstName} ${inviter.lastName}`,
                organizationId,
                branchId,
            );

        // Send invitation email
        await this.sendInvitationEmail(
            email,
            token,
            inviter,
            message,
            expiresAt,
        );

        return {
            success: true,
            message: 'Invitation sent successfully',
        };
    }

    /**
     * Validate invitation token
     */
    validateInvitation(
        validateInvitationDto: ValidateInvitationDto,
    ): StandardApiResponse<any> {
        const { token } = validateInvitationDto;

        const tokenValidation =
            this.tokenManagerService.validateInvitationToken(token);
        if (!tokenValidation.isValid) {
            throw new BadRequestException(
                'Invalid or expired invitation token',
            );
        }

        return {
            success: true,
            data: {
                email: tokenValidation.email,
                inviterName: tokenValidation.inviterName,
                organizationId: tokenValidation.organizationId,
                branchId: tokenValidation.branchId,
            },
            message: 'Invitation token is valid',
        };
    }

    /**
     * Send password changed confirmation email
     */
    private async sendPasswordChangedEmail(
        user: User,
        ipAddress?: string,
        userAgent?: string,
    ): Promise<void> {
        try {
            const baseUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const appName = this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            );

            const templateData = {
                recipientName: `${user.firstName} ${user.lastName}`,
                recipientEmail: user.email,
                changeDateTime: new Date().toLocaleString('en-US', {
                    timeZone: 'UTC',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short',
                }),
                loginUrl: `${baseUrl}/login`,
                dashboardUrl: `${baseUrl}/dashboard`,
                profileUrl: `${baseUrl}/profile`,
                companyName: appName,
                companyUrl: baseUrl,
                supportEmail: this.configService.get<string>(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                ipAddress,
                userAgent,
                unsubscribeUrl: `${baseUrl}/unsubscribe`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.PASSWORD_CHANGED,
                templateData,
            );

            await this.emailQueueService.queueEmail(
                {
                    to: user.email,
                    subject: rendered.subject,
                    html: rendered.html,
                    text: rendered.text,
                },
                EmailJobPriority.CRITICAL,
                0, // Send immediately
                {
                    userId: user.id,
                    templateType: EmailType.PASSWORD_CHANGED,
                },
            );
        } catch (error) {
            console.error('Failed to send password changed email:', error);
            // Don't throw error - email failure shouldn't block password change
        }
    }

    /**
     * Send re-engagement emails to all existing users
     * This is an organizational initiative to encourage users to start actively using the platform
     */
    async sendReInviteToAllUsers(): Promise<StandardApiResponse<any>> {
        try {
            // Get all users from the system with organization details
            const allUsers = await this.userService.findAll();

            if (!allUsers || allUsers.length === 0) {
                return {
                    success: false,
                    message: 'No users found in the system',
                };
            }

            const baseUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const appName = this.configService.get<string>(
                'APP_NAME',
                'Exxam Learning Platform',
            );

            let successCount = 0;
            let failedCount = 0;
            const failedEmails: string[] = [];

            // Send re-engagement email to each user
            for (const user of allUsers) {
                try {
                    // Use the user's linked organization name dynamically, fallback to default if no org
                    const organizationName =
                        user.orgId?.name || 'Your Organization';

                    const templateData = {
                        recipientName: `${user.firstName} ${user.lastName}`,
                        recipientEmail: user.email,
                        loginUrl: `${baseUrl}/login`,
                        dashboardUrl: `${baseUrl}/dashboard`,
                        profileUrl: `${baseUrl}/profile`,
                        coursesUrl: `${baseUrl}/courses`,
                        testsUrl: `${baseUrl}/tests`,
                        leaderboardUrl: `${baseUrl}/leaderboard`,
                        companyName: appName,
                        organizationName: organizationName,
                        companyUrl: baseUrl,
                        supportEmail: this.configService.get<string>(
                            'SUPPORT_EMAIL',
                            'support@exxam.com',
                        ),
                        unsubscribeUrl: `${baseUrl}/unsubscribe`,
                        currentYear: new Date().getFullYear(),
                    };

                    const rendered =
                        await this.emailTemplateService.renderTemplate({
                            template: 're-invite',
                            data: templateData,
                            format: 'both',
                        });

                    await this.emailQueueService.queueEmail(
                        {
                            to: user.email,
                            subject: `🎓 Your Learning Journey Awaits - Start Using ${appName} Today!`,
                            html: rendered.html,
                            text: rendered.text,
                        },
                        EmailJobPriority.HIGH,
                        Math.floor(Math.random() * 300000), // Random delay up to 5 minutes to avoid spam detection
                        {
                            userId: user.id,
                            templateType: 're-invite',
                            batchOperation: true,
                            campaignType: 'user-reengagement',
                            organizationId: user.orgId?.id,
                        },
                    );

                    successCount++;
                } catch (error) {
                    console.error(
                        `Failed to send re-engagement email to ${user.email}:`,
                        error,
                    );
                    failedCount++;
                    failedEmails.push(user.email);
                }
            }

            return {
                success: true,
                message: `Re-engagement emails sent successfully. ${successCount} emails queued, ${failedCount} failed.`,
                data: {
                    totalUsers: allUsers.length,
                    successCount,
                    failedCount,
                    failedEmails,
                },
            };
        } catch (error) {
            console.error('Failed to send re-engagement emails:', error);
            return {
                success: false,
                message: 'Failed to send re-engagement emails to users',
            };
        }
    }

    /**
     * Send invitation email
     */
    private async sendInvitationEmail(
        recipientEmail: string,
        token: string,
        inviter: User,
        customMessage: string | undefined,
        expiresAt: Date,
    ): Promise<void> {
        try {
            const baseUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const appName = this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            );
            const invitationUrl = `${baseUrl}/signup?invitation=${token}`;

            const templateData = {
                recipientEmail,
                inviterName: `${inviter.firstName} ${inviter.lastName}`,
                inviterEmail: inviter.email,
                invitationUrl,
                signupUrl: invitationUrl,
                customMessage:
                    customMessage ||
                    `You've been invited to join ${appName} by ${inviter.firstName} ${inviter.lastName}.`,
                expiryTime: '7 days',
                loginInstructions:
                    'After signing up, you will receive your login credentials and can access the platform immediately.',
                companyName: appName,
                companyUrl: baseUrl,
                supportEmail: this.configService.get<string>(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                unsubscribeUrl: `${baseUrl}/unsubscribe`,
            };

            // Use invitation template for personalized invitations
            const rendered = await this.emailTemplateService.renderTemplate({
                template: 'invitation',
                data: templateData,
                format: 'both',
            });

            await this.emailQueueService.queueEmail(
                {
                    to: recipientEmail,
                    subject: `${inviter.firstName} ${inviter.lastName} invited you to join ${appName}`,
                    html: rendered.html,
                    text: rendered.text,
                },
                EmailJobPriority.HIGH,
                0, // Send immediately
                {
                    inviterUserId: inviter.id,
                    templateType: 'invitation',
                    tokenExpiresAt: expiresAt,
                },
            );
        } catch (error) {
            console.error('Failed to send invitation email:', error);
            throw new Error('Failed to send invitation email');
        }
    }
}
