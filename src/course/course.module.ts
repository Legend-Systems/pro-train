import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { Course } from './entities/course.entity';
import { Test } from '../test/entities/test.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Course, Test, TestAttempt, Result]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        UserModule,
        AuthModule,
    ],
    controllers: [CourseController],
    providers: [CourseService],
    exports: [CourseService],
})
export class CourseModule {}
