import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import type { OrgBranchScope } from '../../auth/decorators/org-branch-scope.decorator';
import { Result } from '../../results/entities/result.entity';
import { Test } from '../../test/entities/test.entity';
import { Answer } from '../../answers/entities/answer.entity';
import { QuestionOption } from '../../questions_options/entities/questions_option.entity';
import {
    LEARNER_USER_ROLES,
    User,
    UserStatus,
} from '../../user/entities/user.entity';
import {
    DIGITAL_SKILL_CATALOGUE,
    DIGITAL_SKILL_LEVELS,
    DIGITAL_SKILLS_COURSE_ID,
    DIGITAL_SKILLS_TEST_TITLE,
} from '../constants/digital-skills.constant';
import {
    AdminDigitalSkillRatingDto,
    AdminDigitalSkillsReportDto,
    AdminDigitalSkillsUserDto,
} from '../dto/admin-digital-skills-report.dto';
import {
    calculateDigitalSkillsScore,
    calculateDigitalSkillsScoreRaw,
    classifyDigitalSkillsScore,
    isWeakDigitalSkillLevel,
} from '../utils/digital-skills-score.util';
import { DigitalSkillsPlanService } from './digital-skills-plan.service';

const MAX_EVALUATED_LEARNERS = 1000;

interface LatestResultRow {
    readonly resultId: number;
    readonly attemptId: number;
    readonly userId: string;
    readonly percentage: number | string;
    readonly calculatedAt: Date;
}

/**
 * Admin report for the Digital Skills self-assessment on course 50.
 *
 * Latest non-voided result per learner is the stored score. Per-skill levels
 * come from the selected option `orderIndex` (1–6).
 */
@Injectable()
export class DigitalSkillsAdminService {
    private readonly logger = new Logger(DigitalSkillsAdminService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        private readonly planService: DigitalSkillsPlanService,
    ) {}

    /** Builds the Digital Skills admin report for the caller’s organisation. */
    async getAdminReport(
        scope: OrgBranchScope,
    ): Promise<AdminDigitalSkillsReportDto> {
        const orgId = scope.orgId;
        if (!orgId) {
            throw new NotFoundException('Organization context required');
        }

        const generatedAt = new Date();
        const test = await this.testRepository.findOne({
            where: {
                courseId: DIGITAL_SKILLS_COURSE_ID,
                title: DIGITAL_SKILLS_TEST_TITLE,
            },
            select: ['testId'],
        });

        const learners = await this.getLearnerRoster(orgId, scope.branchId);
        if (!test || learners.length === 0) {
            return {
                summary: {
                    skillCount: DIGITAL_SKILL_CATALOGUE.length,
                    totalLearners: learners.length,
                    assessedUserCount: 0,
                    notAssessedUserCount: learners.length,
                    needsTrainingUserCount: 0,
                },
                assessedUsers: [],
                usersNeedingTraining: [],
                generatedAt,
            };
        }

        const latestResults = await this.getLatestResults(orgId, test.testId);
        const ratingsByAttempt = await this.getRatingsByAttempt(
            latestResults.map(row => row.attemptId),
        );

        const learnerById = new Map(learners.map(learner => [learner.userId, learner]));
        const assessedUsers: AdminDigitalSkillsUserDto[] = [];

        for (const row of latestResults) {
            const learner = learnerById.get(row.userId);
            if (!learner) {
                continue;
            }

            const ratings = ratingsByAttempt.get(row.attemptId) ?? [];
            const levels = ratings.map(rating => rating.level);
            const rawScore =
                levels.length > 0
                    ? calculateDigitalSkillsScoreRaw(levels)
                    : Number(row.percentage);
            const score =
                levels.length > 0
                    ? calculateDigitalSkillsScore(levels)
                    : Math.round(rawScore * 10) / 10;
            const classification = classifyDigitalSkillsScore(rawScore);

            assessedUsers.push({
                userId: learner.userId,
                firstName: learner.firstName,
                lastName: learner.lastName,
                email: learner.email,
                branchName: learner.branchName,
                branchAlias: learner.branchAlias,
                digitalSkillsScore: score,
                classification,
                weakSkillCount: ratings.filter(rating => rating.isWeakArea).length,
                ratings,
                assessedAt: row.calculatedAt,
                resultId: row.resultId,
                attemptId: row.attemptId,
                assignedPlan: [],
            });
        }

        const plansByUser = await this.planService.getAssignmentsByUserIds(
            assessedUsers.map(user => user.userId),
        );
        for (const user of assessedUsers) {
            user.assignedPlan = plansByUser.get(user.userId) ?? [];
        }

        assessedUsers.sort(
            (left, right) =>
                left.digitalSkillsScore - right.digitalSkillsScore ||
                `${left.lastName} ${left.firstName}`.localeCompare(
                    `${right.lastName} ${right.firstName}`,
                ),
        );

        const usersNeedingTraining = assessedUsers.filter(
            user =>
                user.classification === 'Urgent Training' ||
                user.classification === 'Beginner',
        );

        this.logger.debug(
            `Digital Skills report: ${assessedUsers.length} assessed of ${learners.length} learners`,
        );

        return {
            summary: {
                skillCount: DIGITAL_SKILL_CATALOGUE.length,
                totalLearners: learners.length,
                assessedUserCount: assessedUsers.length,
                notAssessedUserCount: learners.length - assessedUsers.length,
                needsTrainingUserCount: usersNeedingTraining.length,
            },
            assessedUsers,
            usersNeedingTraining,
            generatedAt,
        };
    }

    private async getLatestResults(
        orgId: string,
        testId: number,
    ): Promise<LatestResultRow[]> {
        const rows = await this.resultRepository
            .createQueryBuilder('result')
            .leftJoin('result.orgId', 'org')
            .where('org.id = :orgId', { orgId })
            .andWhere('result.testId = :testId', { testId })
            .andWhere('result.voidedByResetId IS NULL')
            .select('result.resultId', 'resultId')
            .addSelect('result.attemptId', 'attemptId')
            .addSelect('result.userId', 'userId')
            .addSelect('result.percentage', 'percentage')
            .addSelect('result.calculatedAt', 'calculatedAt')
            .orderBy('result.calculatedAt', 'DESC')
            .getRawMany<LatestResultRow>();

        const latestByUser = new Map<string, LatestResultRow>();
        for (const row of rows) {
            if (!latestByUser.has(row.userId)) {
                latestByUser.set(row.userId, row);
            }
        }
        return Array.from(latestByUser.values());
    }

    private async getRatingsByAttempt(
        attemptIds: readonly number[],
    ): Promise<Map<number, AdminDigitalSkillRatingDto[]>> {
        const grouped = new Map<number, AdminDigitalSkillRatingDto[]>();
        if (attemptIds.length === 0) {
            return grouped;
        }

        const rows = await this.answerRepository
            .createQueryBuilder('answer')
            .innerJoin('answer.question', 'question')
            .leftJoin('answer.selectedOption', 'option')
            .where('answer.attemptId IN (:...attemptIds)', { attemptIds })
            .select('answer.attemptId', 'attemptId')
            .addSelect('question.tags', 'tags')
            .addSelect('question.questionText', 'questionText')
            .addSelect('option.orderIndex', 'level')
            .addSelect('answer.selectedOptionId', 'selectedOptionId')
            .addSelect('answer.textAnswer', 'textAnswer')
            .orderBy('question.orderIndex', 'ASC')
            .getRawMany<{
                attemptId: number;
                tags: string | null;
                questionText: string;
                level: number | string | null;
                selectedOptionId: number | string | null;
                textAnswer: string | null;
            }>();

        const missingOptionIds = this.collectMissingOptionIds(rows);
        const orderIndexByOptionId = await this.getOptionOrderIndexes(
            missingOptionIds,
        );

        const catalogueByKey = new Map(
            DIGITAL_SKILL_CATALOGUE.map(skill => [skill.key, skill]),
        );
        const labelByLevel = new Map(
            DIGITAL_SKILL_LEVELS.map(item => [item.level, item.label]),
        );

        for (const row of rows) {
            const level = this.resolveRatingLevel(row, orderIndexByOptionId);
            if (!Number.isInteger(level) || level < 1 || level > 6) {
                continue;
            }

            const skillKey = this.resolveSkillKey(row.tags);
            const catalogue = skillKey ? catalogueByKey.get(skillKey) : undefined;
            const rating: AdminDigitalSkillRatingDto = {
                skillKey: skillKey ?? `question-${grouped.size}`,
                skillTitle: catalogue?.title ?? this.stripRatingPrefix(row.questionText),
                skillGroup: catalogue?.group ?? 'Digital Skills',
                level,
                levelLabel: labelByLevel.get(level as 1 | 2 | 3 | 4 | 5 | 6) ?? String(level),
                isWeakArea: isWeakDigitalSkillLevel(level),
            };

            const existing = grouped.get(row.attemptId) ?? [];
            existing.push(rating);
            grouped.set(row.attemptId, existing);
        }

        return grouped;
    }

    private resolveRatingLevel(
        row: {
            level: number | string | null;
            selectedOptionId: number | string | null;
            textAnswer: string | null;
        },
        orderIndexByOptionId: Map<number, number>,
    ): number {
        const joinedLevel = Number(row.level);
        if (Number.isInteger(joinedLevel) && joinedLevel >= 1 && joinedLevel <= 6) {
            return joinedLevel;
        }

        const optionId = this.parseSelectedOptionId(row);
        if (optionId === null) {
            return 0;
        }
        return orderIndexByOptionId.get(optionId) ?? 0;
    }

    private collectMissingOptionIds(
        rows: readonly {
            level: number | string | null;
            selectedOptionId: number | string | null;
            textAnswer: string | null;
        }[],
    ): number[] {
        const optionIds = new Set<number>();
        for (const row of rows) {
            const joinedLevel = Number(row.level);
            if (Number.isInteger(joinedLevel) && joinedLevel >= 1 && joinedLevel <= 6) {
                continue;
            }
            const optionId = this.parseSelectedOptionId(row);
            if (optionId !== null) {
                optionIds.add(optionId);
            }
        }
        return Array.from(optionIds);
    }

    private parseSelectedOptionId(row: {
        selectedOptionId: number | string | null;
        textAnswer: string | null;
    }): number | null {
        const selectedOptionId = Number(row.selectedOptionId);
        if (Number.isInteger(selectedOptionId) && selectedOptionId > 0) {
            return selectedOptionId;
        }

        if (!row.textAnswer) {
            return null;
        }

        try {
            const parsed: unknown = JSON.parse(row.textAnswer);
            if (
                Array.isArray(parsed) &&
                parsed.length > 0 &&
                typeof parsed[0] === 'number'
            ) {
                return parsed[0];
            }
        } catch {
            return null;
        }
        return null;
    }

    private async getOptionOrderIndexes(
        optionIds: readonly number[],
    ): Promise<Map<number, number>> {
        const byId = new Map<number, number>();
        if (optionIds.length === 0) {
            return byId;
        }

        const options = await this.answerRepository.manager
            .getRepository(QuestionOption)
            .find({
                where: { optionId: In([...optionIds]) },
                select: ['optionId', 'orderIndex'],
            });

        for (const option of options) {
            byId.set(option.optionId, option.orderIndex);
        }
        return byId;
    }

    private resolveSkillKey(tags: string | null): string | null {
        if (!tags) {
            return null;
        }
        const first = tags.split(',')[0]?.trim();
        return first || null;
    }

    private stripRatingPrefix(questionText: string): string {
        return questionText.replace(/^Rate your current ability:\s*/i, '').trim();
    }

    private async getLearnerRoster(
        orgId: string,
        branchId?: string,
    ): Promise<
        Array<{
            userId: string;
            firstName: string;
            lastName: string;
            email: string | null;
            branchName: string | null;
            branchAlias: string | null;
        }>
    > {
        const query = this.userRepository
            .createQueryBuilder('user')
            .leftJoin('user.orgId', 'org')
            .leftJoin('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.role IN (:...learnerRoles)', {
                learnerRoles: LEARNER_USER_ROLES,
            })
            .andWhere('user.status = :activeStatus', {
                activeStatus: UserStatus.ACTIVE,
            })
            .select('user.id', 'userId')
            .addSelect('user.firstName', 'firstName')
            .addSelect('user.lastName', 'lastName')
            .addSelect('user.email', 'email')
            .addSelect('branch.name', 'branchName')
            .addSelect('branch.alias', 'branchAlias')
            .orderBy('user.lastName', 'ASC')
            .limit(MAX_EVALUATED_LEARNERS);

        if (branchId) {
            query.andWhere('branch.id = :branchId', { branchId });
        }

        const rows = await query.getRawMany<{
            userId: string;
            firstName: string | null;
            lastName: string | null;
            email: string | null;
            branchName: string | null;
            branchAlias: string | null;
        }>();

        return rows.map(row => ({
            userId: row.userId,
            firstName: row.firstName ?? '',
            lastName: row.lastName ?? '',
            email: row.email ?? null,
            branchName: row.branchName ?? null,
            branchAlias: row.branchAlias ?? null,
        }));
    }
}
