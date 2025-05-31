import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
