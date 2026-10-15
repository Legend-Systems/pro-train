import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Test } from '../../test/entities/test.entity';
import { getUtcDayBounds } from '../../test/utils/exam-window.util';
import { EligibleTest } from '../types/eligible-test.type';
import { DIGITAL_SKILLS_COURSE_ID } from '../../digital-skills/constants/digital-skills.constant';

/** Selection criteria for the eligible-test set behind a ranking. */
interface ResolveEligibleTestsOptions {
    readonly orgId: string;
    /** Narrows to tests available to one branch (plus org-wide tests). */
    readonly branchId?: string;
    /** Inclusive lower bound on `examEndDate` — omit for all-time. */
    readonly periodStart?: Date | null;
    /** Exclusive upper bound on `examEndDate` — omit for all-time. */
    readonly periodEnd?: Date | null;
    /** "Now" for window-closed evaluation. Defaults to the current time. */
    readonly reference?: Date;
}

/**
 * Resolves which tests may contribute to leaderboards, top-performer lists,
 * and reports.
 *
 * A test is eligible only when **all** of the following hold:
 * - `isActive = true`
 * - `examStartDate` and `examEndDate` are both set (an unscheduled test never
 *   closes, so it can never form a fair participation denominator)
 * - the exam window has fully elapsed — `examEndDate` is before the start of
 *   today in UTC, matching `isExamWindowClosed`
 *
 * Period filters bucket by `examEndDate`, i.e. by the exam cycle rather than
 * by submission date. A learner who submits early is credited to the period
 * the test actually closed in, and a period never contains a test that is
 * still open.
 */
@Injectable()
export class EligibleTestService {
    private readonly logger = new Logger(EligibleTestService.name);

    constructor(
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
    ) {}

    async resolveEligibleTests({
        orgId,
        branchId,
        periodStart,
        periodEnd,
        reference = new Date(),
    }: ResolveEligibleTestsOptions): Promise<EligibleTest[]> {
        const { startOfDay } = getUtcDayBounds(reference);

        const query = this.testRepository
            .createQueryBuilder('test')
            .leftJoin('test.orgId', 'org')
            .leftJoin('test.course', 'course')
            .leftJoin('test.branchId', 'testBranch')
            .leftJoin('course.branchId', 'courseBranch')
            .where('org.id = :orgId', { orgId })
            .andWhere('test.isActive = :isActive', { isActive: true })
            .andWhere('test.courseId != :digitalSkillsCourseId', {
                digitalSkillsCourseId: DIGITAL_SKILLS_COURSE_ID,
            })
            .andWhere('test.examStartDate IS NOT NULL')
            .andWhere('test.examEndDate IS NOT NULL')
            // The window must have opened and then fully closed. The start
            // check is redundant for well-ordered windows but guards against
            // rows where the dates were saved the wrong way round.
            .andWhere('test.examStartDate < :startOfDay', { startOfDay })
            .andWhere('test.examEndDate < :startOfDay', { startOfDay })
            .select('test.testId', 'testId')
            .addSelect('test.title', 'testTitle')
            .addSelect('test.courseId', 'courseId')
            .addSelect('course.title', 'courseTitle')
            .addSelect('testBranch.id', 'testBranchId')
            .addSelect('courseBranch.id', 'courseBranchId')
            .addSelect('test.examStartDate', 'examStartDate')
            .addSelect('test.examEndDate', 'examEndDate')
            .orderBy('test.examEndDate', 'DESC');

        if (periodStart) {
            query.andWhere('test.examEndDate >= :periodStart', { periodStart });
        }
        if (periodEnd) {
            query.andWhere('test.examEndDate < :periodEnd', { periodEnd });
        }

        if (branchId) {
            query.andWhere(
                '(testBranch.id = :branchId OR (testBranch.id IS NULL AND (courseBranch.id = :branchId OR courseBranch.id IS NULL)))',
                { branchId },
            );
        }

        const rows = await query.getRawMany<{
            testId: number | string;
            testTitle: string | null;
            courseId: number | string | null;
            courseTitle: string | null;
            testBranchId: string | null;
            courseBranchId: string | null;
            examStartDate: Date | string;
            examEndDate: Date | string;
        }>();

        this.logger.debug(
            `Resolved ${rows.length} eligible tests for org ${orgId}`,
        );

        return rows.map(row => ({
            testId: Number(row.testId),
            testTitle: row.testTitle ?? 'Untitled test',
            courseId: row.courseId === null ? null : Number(row.courseId),
            courseTitle: row.courseTitle ?? null,
            testBranchId: row.testBranchId ?? null,
            courseBranchId: row.courseBranchId ?? null,
            examStartDate: this.toDate(row.examStartDate),
            examEndDate: this.toDate(row.examEndDate),
        }));
    }

    private toDate(value: Date | string): Date {
        return value instanceof Date ? value : new Date(value);
    }
}
