import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CourseMaterialsService } from './course-materials.service';
import { CourseMaterialsController } from './course-materials.controller';
import { CourseMaterial } from './entities/course-material.entity';
import { Course } from '../course/entities/course.entity';
import { User } from '../user/entities/user.entity';
import { MediaFile } from '../media-manager/entities/media-manager.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([CourseMaterial, Course, User, MediaFile]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        EventEmitterModule.forRoot(),
    ],
    controllers: [CourseMaterialsController],
    providers: [CourseMaterialsService],
    exports: [CourseMaterialsService, TypeOrmModule],
})
export class CourseMaterialsModule {}
