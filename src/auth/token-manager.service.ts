import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface TokenPayload {
    sub: string;
    email: string;
    firstName: string;
    lastName: string;
    orgId?: string;
    branchId?: string;
    iat?: number;
    exp?: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface SpecialTokenData {
    userId: string;
    email: string;
    type: 'password_reset' | 'email_verification' | 'invitation';
    expiresAt: number;
    createdAt: number;
    inviterUserId?: string; // For invitation tokens
    inviterName?: string; // For invitation tokens
    organizationId?: string; // For invitation tokens
    branchId?: string; // For invitation tokens
}

@Injectable()
export class TokenManagerService {
    private readonly accessTokenExpiry = '1h';
    private readonly refreshTokenExpiry = '7d';
    private readonly refreshTokens = new Map<
        string,
        { userId: string; expiresAt: number }
    >();

    // Store password reset and email verification tokens
    private readonly specialTokens = new Map<string, SpecialTokenData>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async generateTokenPair(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        orgId?: string;
        branchId?: string;
    }): Promise<TokenPair> {
        const payload: TokenPayload = {
            sub: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            orgId: user.orgId,
            branchId: user.branchId,
        };

        const accessToken = await this.jwtService.signAsync(payload, {
            expiresIn: this.accessTokenExpiry,
        });

        const refreshToken = this.generateRefreshToken(user.id);

        // Store refresh token with expiration
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
        this.refreshTokens.set(refreshToken, {
            userId: user.id,
            expiresAt,
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: 3600, // 1 hour in seconds
        };
    }

    private generateRefreshToken(userId: string): string {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        this.refreshTokens.set(token, { userId, expiresAt });
        return token;
    }

    /**
     * Generate a password reset token
     */
    generatePasswordResetToken(
        userId: string,
        email: string,
    ): { token: string; expiresAt: Date } {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

        this.specialTokens.set(token, {
            userId,
            email,
            type: 'password_reset',
            expiresAt,
            createdAt: Date.now(),
        });

        return {
            token,
            expiresAt: new Date(expiresAt),
        };
    }

    /**
     * Generate an email verification token
     */
    generateEmailVerificationToken(
        userId: string,
        email: string,
    ): { token: string; expiresAt: Date } {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        this.specialTokens.set(token, {
            userId,
            email,
            type: 'email_verification',
            expiresAt,
            createdAt: Date.now(),
        });

        return {
            token,
            expiresAt: new Date(expiresAt),
        };
    }

    /**
     * Generate an invitation token
     */
    generateInvitationToken(
        inviteeEmail: string,
        inviterUserId: string,
        inviterName: string,
        organizationId?: string,
        branchId?: string,
    ): { token: string; expiresAt: Date } {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

        this.specialTokens.set(token, {
            userId: '', // Will be set when user registers
            email: inviteeEmail,
            type: 'invitation',
            expiresAt,
            createdAt: Date.now(),
            inviterUserId,
            inviterName,
            organizationId,
            branchId,
        });

        return {
            token,
            expiresAt: new Date(expiresAt),
        };
    }

    /**
     * Validate a password reset token
     */
    validatePasswordResetToken(token: string): {
        isValid: boolean;
        userId?: string;
        email?: string;
    } {
        const tokenData = this.specialTokens.get(token);

        if (!tokenData || tokenData.type !== 'password_reset') {
            return { isValid: false };
        }

        if (tokenData.expiresAt < Date.now()) {
            this.specialTokens.delete(token);
            return { isValid: false };
        }

        return {
            isValid: true,
            userId: tokenData.userId,
            email: tokenData.email,
        };
    }

    /**
     * Validate an email verification token
     */
    validateEmailVerificationToken(token: string): {
        isValid: boolean;
        userId?: string;
        email?: string;
    } {
        const tokenData = this.specialTokens.get(token);

        if (!tokenData || tokenData.type !== 'email_verification') {
            return { isValid: false };
        }

        if (tokenData.expiresAt < Date.now()) {
            this.specialTokens.delete(token);
            return { isValid: false };
        }

        return {
            isValid: true,
            userId: tokenData.userId,
            email: tokenData.email,
        };
    }

    /**
     * Validate an invitation token
     */
    validateInvitationToken(token: string): {
        isValid: boolean;
        email?: string;
        inviterName?: string;
        organizationId?: string;
        branchId?: string;
        data?: SpecialTokenData;
    } {
        const tokenData = this.specialTokens.get(token);

        if (!tokenData || tokenData.type !== 'invitation') {
            return { isValid: false };
        }

        if (tokenData.expiresAt < Date.now()) {
            this.specialTokens.delete(token);
            return { isValid: false };
        }

        return {
            isValid: true,
            email: tokenData.email,
            inviterName: tokenData.inviterName,
            organizationId: tokenData.organizationId,
            branchId: tokenData.branchId,
            data: tokenData,
        };
    }

    /**
     * Consume a special token (removes it after use)
     */
    consumeSpecialToken(token: string): {
        isValid: boolean;
        data?: SpecialTokenData;
    } {
        const tokenData = this.specialTokens.get(token);

        if (!tokenData) {
            return { isValid: false };
        }

        if (tokenData.expiresAt < Date.now()) {
            this.specialTokens.delete(token);
            return { isValid: false };
        }

        // Remove token after successful validation
        this.specialTokens.delete(token);
        return { isValid: true, data: tokenData };
    }

    /**
     * Revoke all special tokens for a user
     */
    revokeUserSpecialTokens(
        userId: string,
        type?: 'password_reset' | 'email_verification' | 'invitation',
    ): void {
        for (const [token, data] of this.specialTokens.entries()) {
            if (data.userId === userId && (!type || data.type === type)) {
                this.specialTokens.delete(token);
            }
        }
    }

    /**
     * Revoke invitation tokens by email (for when invitation is consumed)
     */
    revokeInvitationTokensByEmail(email: string): void {
        for (const [token, data] of this.specialTokens.entries()) {
            if (data.type === 'invitation' && data.email === email) {
                this.specialTokens.delete(token);
            }
        }
    }

    async validateAccessToken(token: string): Promise<TokenPayload> {
        try {
            const payload = await this.jwtService.verifyAsync<TokenPayload>(
                token,
                {
                    secret: this.configService.get<string>('JWT_SECRET'),
                },
            );
            return payload;
        } catch {
            throw new UnauthorizedException('Invalid or expired access token');
        }
    }

    validateRefreshToken(token: string): { userId: string; isValid: boolean } {
        const tokenData = this.refreshTokens.get(token);

        if (!tokenData) {
            return { userId: '', isValid: false };
        }

        if (tokenData.expiresAt < Date.now()) {
            this.refreshTokens.delete(token);
            return { userId: '', isValid: false };
        }

        return { userId: tokenData.userId, isValid: true };
    }

    async refreshAccessToken(
        refreshToken: string,
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            orgId?: string;
            branchId?: string;
        },
    ): Promise<TokenPair> {
        const validation = this.validateRefreshToken(refreshToken);

        if (!validation.isValid || validation.userId !== user.id) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const newTokenPair = await this.generateTokenPair(user);
        this.refreshTokens.delete(refreshToken);

        return newTokenPair;
    }

    revokeRefreshToken(token: string): void {
        this.refreshTokens.delete(token);
    }

    revokeAllUserTokens(userId: string): void {
        for (const [token, data] of this.refreshTokens.entries()) {
            if (data.userId === userId) {
                this.refreshTokens.delete(token);
            }
        }

        // Also revoke special tokens
        this.revokeUserSpecialTokens(userId);
    }

    cleanupExpiredTokens(): void {
        const now = Date.now();

        // Cleanup refresh tokens
        for (const [token, data] of this.refreshTokens.entries()) {
            if (data.expiresAt < now) {
                this.refreshTokens.delete(token);
            }
        }

        // Cleanup special tokens
        for (const [token, data] of this.specialTokens.entries()) {
            if (data.expiresAt < now) {
                this.specialTokens.delete(token);
            }
        }
    }
}
