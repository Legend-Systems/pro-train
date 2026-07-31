import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Result } from '../results/entities/result.entity';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { RewardsModule } from '../rewards/rewards.module';
import { TrainingHoursModule } from '../training-hours/training-hours.module';
import { ReportsModule } from '../reports/reports.module';
import { HomeInsightsController } from './home-insights.controller';
import { HomeInsightsService } from './home-insights.service';

/**
 * Home carousel insights module.
 * Composes leaderboard, rewards, training hours, and admin reports
 * into a single role-aware payload for web + mobile home screens.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([Result]),
        LeaderboardModule,
        RewardsModule,
        TrainingHoursModule,
        ReportsModule,
    ],
    controllers: [HomeInsightsController],
    providers: [HomeInsightsService],
    exports: [HomeInsightsService],
})
export class HomeInsightsModule {}
