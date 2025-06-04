import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TokenManagerService } from './token-manager.service';
import { RolesGuard } from './guards/roles.guard';
import { OrgRoleGuard } from './guards/org-role.guard';
import { UserModule } from '../user/user.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
    imports: [
        UserModule,
        LeaderboardModule,
        CommunicationsModule,
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn:
                        configService.get<string>('JWT_EXPIRES_IN') || '1h',
                },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtStrategy,
        TokenManagerService,
        RolesGuard,
        OrgRoleGuard,
    ],
    exports: [AuthService, TokenManagerService, RolesGuard, OrgRoleGuard],
})
export class AuthModule {}
