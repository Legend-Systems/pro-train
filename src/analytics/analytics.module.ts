import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Result } from '../results/entities/result.entity';
import { TrainingSession } from '../training-hours/entities/training-session.entity';
import { Branch } from '../branch/entities/branch.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Result, TrainingSession, Branch])],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule {}
