import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestAttemptsService } from './test_attempts.service';
import { TestAttemptsController } from './test_attempts.controller';
import { TestAttempt } from './entities/test_attempt.entity';
import { Test } from '../test/entities/test.entity';
import { User } from '../user/entities/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TestAttempt, Test, User])],
    controllers: [TestAttemptsController],
    providers: [TestAttemptsService],
    exports: [TestAttemptsService],
})
export class TestAttemptsModule {}
