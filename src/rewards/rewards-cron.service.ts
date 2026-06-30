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

    /** Awards WEEKLY_TRAINING_HOURS_2 when ≥2 hours trained in rolling 7 days. */
    @Cron('30 5 * * 1')
    async evaluateWeeklyTrainingHourGoalsCron(): Promise<void> {
        try {
            const awarded =
                await this.rewardsService.evaluateWeeklyTrainingHourGoals();
            this.logger.log(
                `Weekly training hours XP cron: ${awarded} bonuses awarded`,
            );
        } catch (error) {
            this.logger.error(
                'Weekly training hours XP cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    /** Awards monthly hour milestones for the previous calendar month. */
    @Cron('0 6 1 * *')
    async evaluateMonthlyTrainingHourGoalsCron(): Promise<void> {
        try {
            const awarded =
                await this.rewardsService.evaluateMonthlyTrainingHourGoals();
            this.logger.log(
                `Monthly training hours XP cron: ${awarded} bonuses awarded`,
            );
        } catch (error) {
            this.logger.error(
                'Monthly training hours XP cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    /** Awards DAILY_TRAINING_30MIN for ≥30 minutes trained yesterday (UTC). */
    @Cron('30 4 * * *')
    async evaluateDailyTrainingGoalsCron(): Promise<void> {
        try {
            const awarded =
                await this.rewardsService.evaluateDailyTrainingGoals();
            this.logger.log(
                `Daily training hours XP cron: ${awarded} bonuses awarded`,
            );
        } catch (error) {
            this.logger.error(
                'Daily training hours XP cron failed',
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
