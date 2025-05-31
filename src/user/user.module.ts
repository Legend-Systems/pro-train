import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { MediaFile } from '../media-manager/entities/media-manager.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, MediaFile])],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}
