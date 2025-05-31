import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { Course } from './entities/course.entity';
import { Test } from '../test/entities/test.entity';
import { UserModule } from '../user/user.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Course, Test]), UserModule, AuthModule],
    controllers: [CourseController],
    providers: [CourseService],
    exports: [CourseService],
})
export class CourseModule {}
