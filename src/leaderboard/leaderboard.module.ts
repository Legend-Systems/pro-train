import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { Leaderboard } from './entities/leaderboard.entity';
import { Result } from '../results/entities/result.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Leaderboard, Result]),
    ],
    controllers: [LeaderboardController],
    providers: [LeaderboardService],
    exports: [LeaderboardService],
})
export class LeaderboardModule {}
