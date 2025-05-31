import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

export interface JwtPayload {
    sub: string;
    email: string;
    firstName: string;
    lastName: string;
    orgId?: string;
    branchId?: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthService,
        private configService: ConfigService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey:
                configService.get<string>('JWT_SECRET') || 'fallback-secret',
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.authService.findById(payload.sub);
        if (!user) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userWithoutPassword } = user;
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            orgId: payload.orgId,
            branchId: payload.branchId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
