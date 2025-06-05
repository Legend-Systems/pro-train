import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { TestService } from './test.service';
import { TestController } from './test.controller';
import { Test } from './entities/test.entity';
import { Course } from '../course/entities/course.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { CourseModule } from '../course/course.module';
import { CommonModule } from '../common/common.module';
import { QuestionsOptionsModule } from '../questions_options/questions_options.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Test,
            Course,
            Question,
            QuestionOption,
            TestAttempt,
            Result,
        ]),
        CacheModule.register({
            ttl: 300, // 5 minutes default TTL
            max: 1000, // Maximum number of items in cache
        }),
        CommonModule,
        CourseModule,
        QuestionsOptionsModule,
    ],
    controllers: [TestController],
    providers: [TestService],
    exports: [TestService],
})
export class TestModule {}
