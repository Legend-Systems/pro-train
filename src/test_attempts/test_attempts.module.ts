import { Module } from '@nestjs/common';
import { TestAttemptsService } from './test_attempts.service';
import { TestAttemptsController } from './test_attempts.controller';

@Module({
    controllers: [TestAttemptsController],
    providers: [TestAttemptsService],
})
export class TestAttemptsModule {}
