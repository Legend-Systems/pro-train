import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { TestAttemptsService } from './test_attempts.service';
import { TestAttemptsController } from './test_attempts.controller';
import { TestAttempt } from './entities/test_attempt.entity';
import { Test } from '../test/entities/test.entity';
import { User } from '../user/entities/user.entity';
import { ResultsModule } from '../results/results.module';
import { AnswersModule } from '../answers/answers.module';
import { TestModule } from '../test/test.module';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TestAttempt, Test, User]),
        CacheModule.register(),
        CommonModule,
        ResultsModule,
        AnswersModule,
        TestModule,
    ],
    controllers: [TestAttemptsController],
    providers: [TestAttemptsService],
    exports: [TestAttemptsService],
})
export class TestAttemptsModule {}
