import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenManagerService {
  private readonly accessTokenExpiry = '1h';
  private readonly refreshTokens = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokenPair(user: {
    id: string;
    email: string;
    name: string;
  }): Promise<TokenPair> {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn:
        this.configService.get<string>('JWT_EXPIRES_IN') ||
        this.accessTokenExpiry,
      secret: this.configService.get<string>('JWT_SECRET'),
    });

    const refreshToken = this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  private generateRefreshToken(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    this.refreshTokens.set(token, { userId, expiresAt });
    return token;
  }

  async validateAccessToken(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
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

    if (tokenData.expiresAt < new Date()) {
      this.refreshTokens.delete(token);
      return { userId: '', isValid: false };
    }

    return { userId: tokenData.userId, isValid: true };
  }

  async refreshAccessToken(
    refreshToken: string,
    user: { id: string; email: string; name: string },
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
  }

  cleanupExpiredTokens(): void {
    const now = new Date();
    for (const [token, data] of this.refreshTokens.entries()) {
      if (data.expiresAt < now) {
        this.refreshTokens.delete(token);
      }
    }
  }
}
