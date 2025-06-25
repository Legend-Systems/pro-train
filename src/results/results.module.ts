import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { Result } from './entities/result.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { Answer } from '../answers/entities/answer.entity';
import { Question } from '../questions/entities/question.entity';
import { Test } from '../test/entities/test.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Result, TestAttempt, Answer, Question, Test]),
        CacheModule.register(),
        LeaderboardModule,
        CommunicationsModule,
    ],
    controllers: [ResultsController],
    providers: [ResultsService],
    exports: [ResultsService],
})
export class ResultsModule {}
