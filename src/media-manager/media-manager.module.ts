import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { MediaManagerService } from './media-manager.service';
import { MediaManagerController } from './media-manager.controller';
import { MediaFile } from './entities/media-manager.entity';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';

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
        MulterModule.register({
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB limit
            },
        }),
    ],
    controllers: [MediaManagerController],
    providers: [MediaManagerService],
    exports: [MediaManagerService],
})
export class MediaManagerModule {}
