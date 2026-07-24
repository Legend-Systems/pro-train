import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { TestService } from './test.service';
import { TestController } from './test.controller';
import { Test } from './entities/test.entity';
import { TestInvitation } from './entities/test-invitation.entity';
import { TestExamNotification } from './entities/test-exam-notification.entity';
import { Course } from '../course/entities/course.entity';
import { Question } from '../questions/entities/question.entity';
import { QuestionOption } from '../questions_options/entities/questions_option.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Result } from '../results/entities/result.entity';
import { User } from '../user/entities/user.entity';
import { CourseModule } from '../course/course.module';
import { CommonModule } from '../common/common.module';
import { QuestionsOptionsModule } from '../questions_options/questions_options.module';
import { CommunicationsModule } from '../communications/communications.module';
import { TestNotificationService } from './services/test-notification.service';
import { TestNotificationCronService } from './services/test-notification-cron.service';
import { TestNotificationController } from './controllers/test-notification.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Test,
            TestInvitation,
            TestExamNotification,
            Course,
            Question,
            QuestionOption,
            TestAttempt,
            Result,
            User,
        ]),
        CacheModule.register({
            ttl: 300,
            max: 1000,
        }),
        CommonModule,
        CourseModule,
        QuestionsOptionsModule,
        CommunicationsModule,
    ],
    controllers: [TestController, TestNotificationController],
    providers: [
        TestService,
        TestNotificationService,
        TestNotificationCronService,
    ],
    exports: [TestService, TestNotificationService],
})
export class TestModule {}
