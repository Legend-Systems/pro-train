import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestService } from './test.service';
import { TestController } from './test.controller';
import { Test } from './entities/test.entity';
import { Course } from '../course/entities/course.entity';
import { Question } from '../questions/entities/question.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { CourseModule } from '../course/course.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Test, Course, Question, TestAttempt, Result]),
        CourseModule,
    ],
    controllers: [TestController],
    providers: [TestService],
    exports: [TestService],
})
export class TestModule {}
