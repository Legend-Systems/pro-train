import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestService } from './test.service';
import { TestController } from './test.controller';
import { Test } from './entities/test.entity';
import { Course } from '../course/entities/course.entity';
import { CourseModule } from '../course/course.module';

@Module({
    imports: [TypeOrmModule.forFeature([Test, Course]), CourseModule],
    controllers: [TestController],
    providers: [TestService],
    exports: [TestService],
})
export class TestModule {}
