import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Result } from '../../results/entities/result.entity';
import { LEARNER_USER_ROLES } from '../../user/entities/user.entity';
import { EligibleTest } from '../types/eligible-test.type';
import { LearnerRankingProfile } from '../types/learner-ranking-profile.type';
import { LearnerRankingStats } from '../types/learner-ranking-stats.type';
import { calculateRankingScore } from '../utils/ranking-score.util';
import { isTestExpectedForLearner } from '../utils/test-scope.util';

/** Rounding applied to percentages and point totals. */
const METRIC_PRECISION = 100;

/** Rounding applied to the 0–1 participation rate. */
const RATE_PRECISION = 1000;

/** Inputs for a ranking pass over one eligible-test set. */
interface BuildLearnerRankingOptions {
    readonly orgId: string;
    /** Restricts the result scan to learners in one branch. */
    readonly branchId?: string;
    readonly eligibleTests: readonly EligibleTest[];
    readonly learners: readonly LearnerRankingProfile[];
}

/** The single graded result that counts for one learner on one test. */
interface CountedResult {
    readonly percentage: number;
    readonly score: number;
    readonly passed: boolean;
    readonly attemptNumber: number;
    readonly calculatedAt: number;
}

/**
 * Computes participation-aware ranking metrics for a set of learners over a
 * set of eligible tests.
 *
 * Two rules matter most and were both wrong before:
 * 1. **One result per test.** Retries no longer inflate `testsCompleted` or
 *    drag `averageScore` down. The learner's *latest* attempt on each test is
 *    the one that counts.
 * 2. **A real denominator.** `participationRate` measures completions against
 *    every eligible test the learner was expected to sit, so skipping tests
 *    costs rank instead of protecting an average.
 */
@Injectable()
export class LearnerRankingService {
    constructor(
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
    ) {}

    async buildLearnerRankingStats({
        orgId,
        branchId,
        eligibleTests,
        learners,
    }: BuildLearnerRankingOptions): Promise<Map<string, LearnerRankingStats>> {
        const countedResults =
            eligibleTests.length === 0
                ? new Map<string, CountedResult>()
                : await this.fetchCountedResults(
                      orgId,
                      branchId,
                      eligibleTests.map(test => test.testId),
                  );

        return new Map(
            learners.map(learner => [
                learner.userId,
                this.buildStatsForLearner(learner, eligibleTests, countedResults),
            ]),
        );
    }

    /**
     * Latest graded attempt per learner+test.
     *
     * Voided results and voided attempts are skipped so an anti-cheat reset
     * cannot leave a learner ranked on a withdrawn score. Attempts without a
     * result (`in_progress` / `expired`) simply never appear, which is how a
     * started-but-unfinished test stays counted as missed.
     */
    private async fetchCountedResults(
        orgId: string,
        branchId: string | undefined,
        testIds: readonly number[],
    ): Promise<Map<string, CountedResult>> {
        const query = this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .innerJoin('result.attempt', 'attempt')
            .innerJoin('result.user', 'user')
            .where('org.id = :orgId', { orgId })
            .andWhere('result.testId IN (:...testIds)', { testIds })
            .andWhere('result.voidedByResetId IS NULL')
            .andWhere('attempt.voidedByResetId IS NULL')
            .andWhere('user.role IN (:...learnerRoles)', {
                learnerRoles: LEARNER_USER_ROLES,
            })
            .select('result.userId', 'userId')
            .addSelect('result.testId', 'testId')
            .addSelect('result.percentage', 'percentage')
            .addSelect('result.score', 'score')
            .addSelect('result.passed', 'passed')
            .addSelect('attempt.attemptNumber', 'attemptNumber')
            .addSelect('result.calculatedAt', 'calculatedAt');

        if (branchId) {
            query
                .leftJoin('user.branchId', 'userBranch')
                .andWhere('userBranch.id = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            userId: string;
            testId: number | string;
            percentage: string;
            score: string;
            passed: number | boolean | string;
            attemptNumber: number | string | null;
            calculatedAt: Date | string;
        }>();

        const latestByUserAndTest = new Map<string, CountedResult>();

        for (const row of rows) {
            const key = this.resultKey(row.userId, Number(row.testId));
            const candidate: CountedResult = {
                percentage: Number(row.percentage) || 0,
                score: Number(row.score) || 0,
                passed:
                    row.passed === true ||
                    row.passed === 1 ||
                    row.passed === '1',
                attemptNumber: Number(row.attemptNumber) || 0,
                calculatedAt: this.toTimestamp(row.calculatedAt),
            };

            const existing = latestByUserAndTest.get(key);
            if (!existing || this.isLater(candidate, existing)) {
                latestByUserAndTest.set(key, candidate);
            }
        }

        return latestByUserAndTest;
    }

    /** Later = higher attempt number, falling back to grading time. */
    private isLater(candidate: CountedResult, existing: CountedResult): boolean {
        if (candidate.attemptNumber !== existing.attemptNumber) {
            return candidate.attemptNumber > existing.attemptNumber;
        }
        return candidate.calculatedAt > existing.calculatedAt;
    }

    private buildStatsForLearner(
        learner: LearnerRankingProfile,
        eligibleTests: readonly EligibleTest[],
        countedResults: Map<string, CountedResult>,
    ): LearnerRankingStats {
        const expectedTests = eligibleTests.filter(test =>
            isTestExpectedForLearner(test, learner.branchId),
        );

        const completedTestIds: number[] = [];
        const missedTestIds: number[] = [];
        let percentageSum = 0;
        let totalPoints = 0;
        let testsPassed = 0;

        for (const test of expectedTests) {
            const counted = countedResults.get(
                this.resultKey(learner.userId, test.testId),
            );

            if (!counted) {
                missedTestIds.push(test.testId);
                continue;
            }

            completedTestIds.push(test.testId);
            percentageSum += counted.percentage;
            totalPoints += counted.score;
            if (counted.passed) {
                testsPassed += 1;
            }
        }

        const testsCompleted = completedTestIds.length;
        const totalEligibleTests = expectedTests.length;
        const averageScore =
            testsCompleted > 0
                ? this.roundMetric(percentageSum / testsCompleted)
                : 0;
        const participationRate =
            totalEligibleTests > 0
                ? this.roundRate(testsCompleted / totalEligibleTests)
                : 0;

        return {
            userId: learner.userId,
            totalEligibleTests,
            testsCompleted,
            testsPassed,
            averageScore,
            participationRate,
            // A learner with no completed eligible test scores 0 and sorts
            // last rather than being hidden, so admins can still see them.
            rankingScore:
                testsCompleted > 0
                    ? calculateRankingScore({ averageScore, participationRate })
                    : 0,
            totalPoints: this.roundMetric(totalPoints),
            completedTestIds,
            missedTestIds,
        };
    }

    private resultKey(userId: string, testId: number): string {
        return `${userId}:${testId}`;
    }

    private toTimestamp(value: Date | string): number {
        return (value instanceof Date ? value : new Date(value)).getTime();
    }

    private roundMetric(value: number): number {
        return Math.round(value * METRIC_PRECISION) / METRIC_PRECISION;
    }

    private roundRate(value: number): number {
        return Math.round(value * RATE_PRECISION) / RATE_PRECISION;
    }
}
