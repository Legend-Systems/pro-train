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
import { User } from '../user/entities/user.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { CommunicationsModule } from '../communications/communications.module';
import { TrainingProgressModule } from '../training_progress/training_progress.module';
import { AuthModule } from '../auth/auth.module';
import { RewardsModule } from '../rewards/rewards.module';
import { TrainingHoursModule } from '../training-hours/training-hours.module';
import { AnswersModule } from '../answers/answers.module';
import { PendingResultsService } from './pending-results.service';

@Module({
    imports: [
        // User is needed for the Employee Performance roster (learners in org/branch scope)
        TypeOrmModule.forFeature([
            Result,
            TestAttempt,
            Answer,
            Question,
            Test,
            User,
        ]),
        CacheModule.register(),
        LeaderboardModule,
        CommunicationsModule,
        TrainingProgressModule,
        AuthModule,
        RewardsModule,
        TrainingHoursModule,
        AnswersModule,
    ],
    controllers: [ResultsController],
    providers: [ResultsService, PendingResultsService],
    exports: [ResultsService],
})
export class ResultsModule {}
