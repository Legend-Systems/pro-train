import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Result } from '../results/entities/result.entity';
import { TrainingSession } from '../training-hours/entities/training-session.entity';
import { Branch } from '../branch/entities/branch.entity';
import { User } from '../user/entities/user.entity';
import { RankingModule } from '../ranking/ranking.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Result, TrainingSession, Branch, User]),
        RankingModule,
    ],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule {}
