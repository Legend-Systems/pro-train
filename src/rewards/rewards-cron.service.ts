import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RewardsService } from './rewards.service';

/**
 * Phase 6 — scheduled XP maintenance jobs.
 * Runs independently of user actions to close stale challenge months and award streaks.
 */
@Injectable()
export class RewardsCronService {
    private readonly logger = new Logger(RewardsCronService.name);

    constructor(private readonly rewardsService: RewardsService) {}

    /** Closes challenge months that were never rolled forward (users with no recent XP). */
    @Cron('0 3 * * *')
    async rollStaleChallengeMonthsCron(): Promise<void> {
        try {
            const rolled =
                await this.rewardsService.rollStaleChallengeMonths();
            this.logger.log(
                `Monthly challenge rollover: ${rolled} stale records updated`,
            );
        } catch (error) {
            this.logger.error(
                'Monthly challenge rollover cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    /** Evaluates 7-day learning streaks and awards LEARNING_STREAK_7. */
    @Cron('0 4 * * *')
    async evaluateLearningStreaksCron(): Promise<void> {
        try {
            const awarded =
                await this.rewardsService.evaluateLearningStreaks();
            this.logger.log(
                `Learning streak cron: ${awarded} streak bonuses awarded`,
            );
        } catch (error) {
            this.logger.error(
                'Learning streak cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    /** Awards WEEKLY_TRAINING_GOAL when ≥3 tests submitted in rolling 7 days. */
    @Cron('0 5 * * 1')
    async evaluateWeeklyTrainingGoalsCron(): Promise<void> {
        try {
            const awarded =
                await this.rewardsService.evaluateWeeklyTrainingGoals();
            this.logger.log(
                `Weekly training goal cron: ${awarded} goal bonuses awarded`,
            );
        } catch (error) {
            this.logger.error(
                'Weekly training goal cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
