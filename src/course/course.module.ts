import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { Course } from './entities/course.entity';
import { UserModule } from '../user/user.module';

@Module({
    imports: [TypeOrmModule.forFeature([Course]), UserModule],
    controllers: [CourseController],
    providers: [CourseService],
    exports: [CourseService],
})
export class CourseModule {}
