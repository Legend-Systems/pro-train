import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Result } from '../results/entities/result.entity';
import { Test } from '../test/entities/test.entity';
import { EligibleTestService } from './services/eligible-test.service';
import { LearnerRankingService } from './services/learner-ranking.service';

/**
 * Shared ranking engine.
 *
 * Leaderboards, top-performer widgets, and the admin report catalogue all
 * depend on this module so there is exactly one definition of "eligible test"
 * and one ranking formula across the platform.
 */
@Module({
    imports: [TypeOrmModule.forFeature([Test, Result])],
    providers: [EligibleTestService, LearnerRankingService],
    exports: [EligibleTestService, LearnerRankingService],
})
export class RankingModule {}
