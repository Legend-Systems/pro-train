import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Answer } from '../../answers/entities/answer.entity';
import type { TestResultCreatedEvent } from '../../common/events/test-result-created.event';
import { CourseMaterial } from '../../course-materials/entities/course-material.entity';
import { Result } from '../../results/entities/result.entity';
import { Test } from '../../test/entities/test.entity';
import {
    DIGITAL_SKILL_CATALOGUE,
    DIGITAL_SKILL_LEVELS,
    DIGITAL_SKILLS_CHECK_TITLE_PREFIX,
    DIGITAL_SKILLS_COURSE_ID,
    DIGITAL_SKILLS_MODULE_TITLE_PREFIX,
    DIGITAL_SKILLS_TEST_TITLE,
    digitalSkillsCheckTitle,
    digitalSkillsModuleTitle,
} from '../constants/digital-skills.constant';
import { DigitalSkillsPlanDto, DigitalSkillsPlanItemDto } from '../dto/digital-skills-plan.dto';
import { DigitalSkillsAssignment } from '../entities/digital-skills-assignment.entity';
import { getUtcDayBounds } from '../../test/utils/exam-window.util';
import { DigitalSkillsBookingService } from './digital-skills-booking.service';
import {
    calculateDigitalSkillsScore,
    calculateDigitalSkillsScoreRaw,
    classifyDigitalSkillsScore,
    isWeakDigitalSkillLevel,
} from '../utils/digital-skills-score.util';
import { isDigitalSkillsCourse } from '../utils/is-digital-skills-course.util';

interface ResolvedRating {
    readonly skillKey: string;
    readonly skillTitle: string;
    readonly skillGroup: string;
    readonly level: number;
    readonly levelLabel: string;
    readonly isWeakArea: boolean;
}

/**
 * Assigns weak-area modules after the Digital Skills survey and builds
 * the learner / admin training plan. Follow-up exam scores never rewrite
 * the 1–6 baseline ratings.
 */
@Injectable()
export class DigitalSkillsPlanService {
    private readonly logger = new Logger(DigitalSkillsPlanService.name);

    constructor(
        @InjectRepository(DigitalSkillsAssignment)
        private readonly assignmentRepository: Repository<DigitalSkillsAssignment>,
        @InjectRepository(Answer)
        private readonly answerRepository: Repository<Answer>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(CourseMaterial)
        private readonly materialRepository: Repository<CourseMaterial>,
        private readonly bookingService: DigitalSkillsBookingService,
    ) {}

    /** True when a result belongs to the course-50 self-assessment. */
    isBaselineAssessmentEvent(event: TestResultCreatedEvent): boolean {
        return (
            isDigitalSkillsCourse(event.courseId) &&
            event.testTitle === DIGITAL_SKILLS_TEST_TITLE
        );
    }

    /** Replaces the learner’s assigned modules from the latest survey. */
    async assignFromResult(event: TestResultCreatedEvent): Promise<void> {
        if (!this.isBaselineAssessmentEvent(event)) {
            return;
        }

        const ratings = await this.getRatingsForAttempt(event.attemptId);
        const weakRatings = ratings.filter(rating => rating.isWeakArea);
        const modules = await this.loadModuleMap();

        const existing = await this.assignmentRepository.find({
            where: { userId: event.userId },
        });
        const existingByKey = new Map(
            existing.map(row => [row.skillKey, row]),
        );
        const keepKeys = new Set(weakRatings.map(rating => rating.skillKey));

        const toRemove = existing.filter(row => !keepKeys.has(row.skillKey));
        if (toRemove.length > 0) {
            await this.assignmentRepository.remove(toRemove);
        }

        for (const rating of weakRatings) {
            const module = modules.get(rating.skillKey);
            const current = existingByKey.get(rating.skillKey);
            if (current) {
                const isNewResult = current.assignedFromResultId !== event.resultId;
                current.level = rating.level;
                current.skillTitle = rating.skillTitle;
                current.skillGroup = rating.skillGroup;
                current.materialId = module?.materialId ?? null;
                current.testId = module?.testId ?? null;
                current.assignedFromResultId = event.resultId;
                if (isNewResult) {
                    // Fresh survey clears the previous booking and any admin reschedule.
                    current.expectedDueDate = null;
                    current.bookingNotifiedAt = null;
                    current.rescheduledStartDate = null;
                    current.rescheduledExamEndDate = null;
                }
                await this.assignmentRepository.save(current);
                continue;
            }

            await this.assignmentRepository.save(
                this.assignmentRepository.create({
                    userId: event.userId,
                    skillKey: rating.skillKey,
                    skillTitle: rating.skillTitle,
                    skillGroup: rating.skillGroup,
                    level: rating.level,
                    materialId: module?.materialId ?? null,
                    testId: module?.testId ?? null,
                    assignedFromResultId: event.resultId,
                    orgId: { id: event.orgId },
                }),
            );
        }

        this.logger.log(
            `Assigned ${weakRatings.length} Digital Skills modules to ${event.userId}`,
        );

        if (weakRatings.length === 0) {
            return;
        }

        try {
            await this.bookingService.bookRemedialTests({
                userId: event.userId,
                orgId: event.orgId,
                branchId: event.branchId,
                resultId: event.resultId,
            });
        } catch (error) {
            this.logger.error(
                `Digital Skills booking failed for ${event.userId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    async getAssignedTestIds(userId: string): Promise<number[]> {
        const rows = await this.assignmentRepository.find({
            where: { userId },
            select: ['testId'],
        });
        return rows
            .map(row => row.testId)
            .filter((testId): testId is number => typeof testId === 'number');
    }

    async getAssignedMaterialIds(userId: string): Promise<number[]> {
        const rows = await this.assignmentRepository.find({
            where: { userId },
            select: ['materialId'],
        });
        return rows
            .map(row => row.materialId)
            .filter((materialId): materialId is number => typeof materialId === 'number');
    }

    /**
     * Personal exam window from an admin reschedule, if both dates are set.
     * Used by attempt start/submit so remedial checks ignore the shared test
     * window once an elevated admin has opened a new window for this learner.
     */
    async getRescheduledExamWindow(
        userId: string,
        testId: number,
    ): Promise<{ examStartDate: Date; examEndDate: Date } | null> {
        const row = await this.assignmentRepository.findOne({
            where: { userId, testId },
            select: ['rescheduledStartDate', 'rescheduledExamEndDate'],
        });
        if (!row?.rescheduledStartDate || !row?.rescheduledExamEndDate) {
            return null;
        }
        return {
            examStartDate: row.rescheduledStartDate,
            examEndDate: row.rescheduledExamEndDate,
        };
    }

    /**
     * Test ids that currently have an open admin reschedule window for this learner.
     * Lets closed shared exam windows stay visible on the learner test list.
     */
    async getOpenRescheduledTestIds(
        userId: string,
        reference: Date = new Date(),
    ): Promise<number[]> {
        const rows = await this.assignmentRepository.find({
            where: { userId },
            select: [
                'testId',
                'rescheduledStartDate',
                'rescheduledExamEndDate',
            ],
        });
        const { startOfDay, startOfNextDay } = getUtcDayBounds(reference);
        return rows
            .filter(row => {
                if (
                    typeof row.testId !== 'number' ||
                    !row.rescheduledStartDate ||
                    !row.rescheduledExamEndDate
                ) {
                    return false;
                }
                if (row.rescheduledStartDate >= startOfNextDay) {
                    return false;
                }
                if (row.rescheduledExamEndDate < startOfDay) {
                    return false;
                }
                return true;
            })
            .map(row => row.testId as number);
    }

    async getAssignmentsByUserIds(
        userIds: readonly string[],
    ): Promise<Map<string, DigitalSkillsPlanItemDto[]>> {
        const grouped = new Map<string, DigitalSkillsPlanItemDto[]>();
        if (userIds.length === 0) {
            return grouped;
        }

        const rows = await this.assignmentRepository.find({
            where: { userId: In([...userIds]) },
            order: { skillGroup: 'ASC', skillTitle: 'ASC' },
        });
        const enriched = await this.enrichAssignments(rows);
        rows.forEach((row, index) => {
            const existing = grouped.get(row.userId) ?? [];
            existing.push(enriched[index]);
            grouped.set(row.userId, existing);
        });
        return grouped;
    }

    async getPlanForUser(userId: string, orgId?: string): Promise<DigitalSkillsPlanDto> {
        const generatedAt = new Date();
        const baseline = await this.getLatestBaseline(userId, orgId);
        const ratings = baseline
            ? await this.getRatingsForAttempt(baseline.attemptId)
            : [];
        const assignments = await this.assignmentRepository.find({
            where: { userId },
            order: { skillGroup: 'ASC', skillTitle: 'ASC' },
        });
        if (
            baseline &&
            orgId &&
            assignments.some(row => !row.expectedDueDate || !row.bookingNotifiedAt)
        ) {
            try {
                await this.bookingService.bookRemedialTests({
                    userId,
                    orgId,
                    resultId: Number(baseline.resultId),
                });
            } catch (error) {
                this.logger.error(
                    `Digital Skills booking catch-up failed for ${userId}`,
                    error instanceof Error ? error.stack : String(error),
                );
            }
        }

        const bookedAssignments = await this.assignmentRepository.find({
            where: { userId },
            order: { skillGroup: 'ASC', skillTitle: 'ASC' },
        });
        const assignedPlan = await this.enrichAssignments(
            baseline ? bookedAssignments : assignments,
        );

        if (!baseline) {
            return {
                assessed: false,
                digitalSkillsScore: null,
                classification: null,
                assessedAt: null,
                ratings: [],
                assignedPlan,
                generatedAt,
            };
        }

        const levels = ratings.map(rating => rating.level);
        const rawScore =
            levels.length > 0
                ? calculateDigitalSkillsScoreRaw(levels)
                : Number(baseline.percentage);
        const score =
            levels.length > 0
                ? calculateDigitalSkillsScore(levels)
                : Math.round(rawScore * 10) / 10;

        return {
            assessed: true,
            digitalSkillsScore: score,
            classification: classifyDigitalSkillsScore(rawScore),
            assessedAt: baseline.calculatedAt,
            ratings,
            assignedPlan,
            generatedAt,
        };
    }

    /**
     * Learners may sit the survey plus knowledge tests assigned to them.
     * Unassigned Digital Skills checks stay hidden so 31 exams do not flood the list.
     */
    shouldLearnerSeeTest(title: string, testId: number, assignedTestIds: readonly number[]): boolean {
        if (title === DIGITAL_SKILLS_TEST_TITLE) {
            return true;
        }
        if (title.startsWith(DIGITAL_SKILLS_CHECK_TITLE_PREFIX)) {
            return assignedTestIds.includes(testId);
        }
        return true;
    }

    shouldLearnerSeeMaterial(
        title: string,
        materialId: number,
        assignedMaterialIds: readonly number[],
    ): boolean {
        if (title.startsWith(DIGITAL_SKILLS_MODULE_TITLE_PREFIX)) {
            return assignedMaterialIds.includes(materialId);
        }
        return true;
    }

    private async getLatestBaseline(
        userId: string,
        orgId?: string,
    ): Promise<{
        resultId: number;
        attemptId: number;
        percentage: number | string;
        calculatedAt: Date;
    } | null> {
        const test = await this.testRepository.findOne({
            where: {
                courseId: DIGITAL_SKILLS_COURSE_ID,
                title: DIGITAL_SKILLS_TEST_TITLE,
            },
            select: ['testId'],
        });
        if (!test) {
            return null;
        }

        const query = this.resultRepository
            .createQueryBuilder('result')
            .where('result.userId = :userId', { userId })
            .andWhere('result.testId = :testId', { testId: test.testId })
            .andWhere('result.voidedByResetId IS NULL')
            .orderBy('result.calculatedAt', 'DESC')
            .select('result.resultId', 'resultId')
            .addSelect('result.attemptId', 'attemptId')
            .addSelect('result.percentage', 'percentage')
            .addSelect('result.calculatedAt', 'calculatedAt')
            .limit(1);

        if (orgId) {
            query
                .leftJoin('result.orgId', 'org')
                .andWhere('org.id = :orgId', { orgId });
        }

        const row = await query.getRawOne<{
            resultId: number;
            attemptId: number;
            percentage: number | string;
            calculatedAt: Date;
        }>();
        return row ?? null;
    }

    private async getRatingsForAttempt(attemptId: number): Promise<ResolvedRating[]> {
        const rows = await this.answerRepository
            .createQueryBuilder('answer')
            .innerJoin('answer.question', 'question')
            .leftJoin('answer.selectedOption', 'option')
            .where('answer.attemptId = :attemptId', { attemptId })
            .select('question.tags', 'tags')
            .addSelect('question.questionText', 'questionText')
            .addSelect('option.orderIndex', 'level')
            .orderBy('question.orderIndex', 'ASC')
            .getRawMany<{
                tags: string | null;
                questionText: string;
                level: number | string | null;
            }>();

        const catalogueByKey = new Map(
            DIGITAL_SKILL_CATALOGUE.map(skill => [skill.key, skill]),
        );
        const labelByLevel = new Map(
            DIGITAL_SKILL_LEVELS.map(item => [item.level, item.label]),
        );

        const ratings: ResolvedRating[] = [];
        for (const row of rows) {
            const level = Number(row.level);
            if (!Number.isInteger(level) || level < 1 || level > 6) {
                continue;
            }
            const skillKey = row.tags?.split(',')[0]?.trim() ?? '';
            const catalogue = catalogueByKey.get(skillKey);
            ratings.push({
                skillKey: skillKey || `question-${ratings.length}`,
                skillTitle:
                    catalogue?.title ??
                    row.questionText.replace(/^Rate your current ability:\s*/i, '').trim(),
                skillGroup: catalogue?.group ?? 'Digital Skills',
                level,
                levelLabel: labelByLevel.get(level as 1 | 2 | 3 | 4 | 5 | 6) ?? String(level),
                isWeakArea: isWeakDigitalSkillLevel(level),
            });
        }
        return ratings;
    }

    private async loadModuleMap(): Promise<
        Map<string, { materialId: number | null; testId: number | null }>
    > {
        const [materials, tests] = await Promise.all([
            this.materialRepository.find({
                where: { courseId: DIGITAL_SKILLS_COURSE_ID },
                select: ['materialId', 'title'],
            }),
            this.testRepository.find({
                where: { courseId: DIGITAL_SKILLS_COURSE_ID },
                select: ['testId', 'title'],
            }),
        ]);

        const mapped = new Map<string, { materialId: number | null; testId: number | null }>();
        for (const skill of DIGITAL_SKILL_CATALOGUE) {
            const material = materials.find(
                row => row.title === digitalSkillsModuleTitle(skill.title),
            );
            const test = tests.find(
                row => row.title === digitalSkillsCheckTitle(skill.title),
            );
            mapped.set(skill.key, {
                materialId: material?.materialId ?? null,
                testId: test?.testId ?? null,
            });
        }
        return mapped;
    }

    private async enrichAssignments(
        rows: readonly DigitalSkillsAssignment[],
    ): Promise<DigitalSkillsPlanItemDto[]> {
        const testIds = [
            ...new Set(
                rows
                    .map(row => row.testId)
                    .filter((testId): testId is number => typeof testId === 'number'),
            ),
        ];
        const materialIds = [
            ...new Set(
                rows
                    .map(row => row.materialId)
                    .filter((materialId): materialId is number => typeof materialId === 'number'),
            ),
        ];

        const [tests, materials, latestResults] = await Promise.all([
            testIds.length > 0
                ? this.testRepository.find({
                      where: { testId: In(testIds) },
                      select: ['testId', 'title', 'examStartDate', 'examEndDate'],
                  })
                : [],
            materialIds.length > 0
                ? this.materialRepository.find({
                      where: { materialId: In(materialIds) },
                      select: ['materialId', 'title'],
                  })
                : [],
            testIds.length > 0
                ? this.resultRepository.find({
                      where: {
                          testId: In(testIds),
                          userId: In([...new Set(rows.map(row => row.userId))]),
                      },
                      order: { calculatedAt: 'DESC' },
                      select: ['testId', 'userId', 'percentage', 'passed', 'voidedByResetId'],
                  })
                : [],
        ]);

        const testById = new Map<
            number,
            Pick<Test, 'testId' | 'title' | 'examStartDate' | 'examEndDate'>
        >(
            tests.map(
                (test): [
                    number,
                    Pick<Test, 'testId' | 'title' | 'examStartDate' | 'examEndDate'>,
                ] => [test.testId, test],
            ),
        );
        const materialById = new Map<number, Pick<CourseMaterial, 'materialId' | 'title'>>(
            materials.map(
                (material): [number, Pick<CourseMaterial, 'materialId' | 'title'>] => [
                    material.materialId,
                    material,
                ],
            ),
        );
        const latestByUserTest = new Map<string, { percentage: number; passed: boolean }>();
        for (const result of latestResults) {
            if (result.voidedByResetId) {
                continue;
            }
            const key = `${result.userId}:${result.testId}`;
            if (!latestByUserTest.has(key)) {
                latestByUserTest.set(key, {
                    percentage: Math.round(Number(result.percentage) * 10) / 10,
                    passed: result.passed,
                });
            }
        }

        const labelByLevel = new Map(
            DIGITAL_SKILL_LEVELS.map(item => [item.level, item.label]),
        );

        return rows.map(row => {
            const test = row.testId ? testById.get(row.testId) : undefined;
            const material = row.materialId
                ? materialById.get(row.materialId)
                : undefined;
            const knowledge = latestByUserTest.get(`${row.userId}:${row.testId}`);
            return {
                skillKey: row.skillKey,
                skillTitle: row.skillTitle,
                skillGroup: row.skillGroup,
                level: row.level,
                levelLabel: labelByLevel.get(row.level as 1 | 2 | 3 | 4 | 5 | 6) ?? String(row.level),
                materialId: row.materialId ?? null,
                materialTitle: material?.title ?? null,
                testId: row.testId ?? null,
                testTitle: test?.title ?? null,
                examStartDate: test?.examStartDate ?? null,
                examEndDate: test?.examEndDate ?? null,
                latestKnowledgePercentage: knowledge?.percentage ?? null,
                latestKnowledgePassed: knowledge?.passed ?? null,
                assignedAt: row.assignedAt,
                expectedDueDate: row.expectedDueDate ?? null,
                rescheduledStartDate: row.rescheduledStartDate ?? null,
                rescheduledExamEndDate: row.rescheduledExamEndDate ?? null,
            };
        });
    }
}
