import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingHoursService } from './training-hours.service';
import { TrainingHoursController } from './training-hours.controller';
import { TrainingSession } from './entities/training-session.entity';
import { UserTrainingHoursMonthly } from './entities/user-training-hours-monthly.entity';
import { TestAttempt } from '../test_attempts/entities/test_attempt.entity';
import { User } from '../user/entities/user.entity';

/** Training hours ledger module — exported for Results, Auth, Rewards, Reports. */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            TrainingSession,
            UserTrainingHoursMonthly,
            TestAttempt,
            User,
        ]),
    ],
    controllers: [TrainingHoursController],
    providers: [TrainingHoursService],
    exports: [TrainingHoursService],
})
export class TrainingHoursModule {}
