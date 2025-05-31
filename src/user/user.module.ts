import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { MediaFile } from '../media-manager/entities/media-manager.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, MediaFile]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
