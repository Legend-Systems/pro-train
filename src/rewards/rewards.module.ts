import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { RewardsService } from './rewards.service';
import { RewardsController } from './rewards.controller';
import { RewardsSubscriber } from './rewards.subscriber';
import { RewardsCronService } from './rewards-cron.service';
import { UserRewards } from './entities/user-rewards.entity';
import { XPTransaction } from './entities/xp-transaction.entity';
import { User } from '../user/entities/user.entity';
import { Result } from '../results/entities/result.entity';
import { Test } from '../test/entities/test.entity';
import { CourseMaterial } from '../course-materials/entities/course-material.entity';
import { CourseMaterialView } from '../course-materials/entities/course-material-view.entity';
import { CommonModule } from '../common/common.module';
import { UserModule } from '../user/user.module';

/**
 * XP rewards module — Phases 2–6.
 * Exports RewardsService for injection into Results, Auth, User, CourseMaterials (Phase 4).
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            UserRewards,
            XPTransaction,
            User,
            Result,
            Test,
            CourseMaterial,
            CourseMaterialView,
        ]),
        CacheModule.register({
            ttl: 300,
            max: 1000,
        }),
        CommonModule,
        forwardRef(() => UserModule),
    ],
    controllers: [RewardsController],
    providers: [RewardsService, RewardsSubscriber, RewardsCronService],
    exports: [RewardsService],
})
export class RewardsModule {}
