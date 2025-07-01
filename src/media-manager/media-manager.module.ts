import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MediaManagerService } from './media-manager.service';
import { MediaManagerController } from './media-manager.controller';
import { MediaFile } from './entities/media-manager.entity';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';
import { RetryService } from '../common/services/retry.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([MediaFile]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        ConfigModule,
        UserModule,
        AuthModule,
        MulterModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                limits: {
                    fileSize:
                        configService.get<number>('MEDIA_MAX_FILE_SIZE') ||
                        100 * 1024 * 1024, // 100MB default, configurable
                },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [MediaManagerController],
    providers: [MediaManagerService, RetryService],
    exports: [MediaManagerService],
})
export class MediaManagerModule {}
