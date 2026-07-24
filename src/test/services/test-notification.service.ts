import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { CommunicationsService } from '../../communications/communications.service';
import { Result } from '../../results/entities/result.entity';
import {
    User,
    UserRole,
    UserStatus,
} from '../../user/entities/user.entity';
import { TestInvitation, InvitationStatus } from '../entities/test-invitation.entity';
import { Test } from '../entities/test.entity';
import {
    TestExamNotification,
    TestExamNotificationStatus,
    TestExamNotificationType,
} from '../entities/test-exam-notification.entity';

interface ReminderRecipient {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

interface ProcessReminderResult {
    processedTests: number;
    emailsQueued: number;
    skipped: number;
    failed: number;
}

/**
 * Finds tests with approaching examDate and sends branded reminder emails.
 * Deduplicates via test_exam_notification unique (testId, userId, type).
 */
@Injectable()
export class TestNotificationService {
    private readonly logger = new Logger(TestNotificationService.name);

    constructor(
        @InjectRepository(Test)
        private readonly testRepository: Repository<Test>,
        @InjectRepository(TestInvitation)
        private readonly invitationRepository: Repository<TestInvitation>,
        @InjectRepository(TestExamNotification)
        private readonly notificationRepository: Repository<TestExamNotification>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(Result)
        private readonly resultRepository: Repository<Result>,
        private readonly communicationsService: CommunicationsService,
    ) {}

    /** Daily entry: 3-day and exam-day reminders (UTC calendar dates). */
    async processUpcomingExamReminders(
        referenceDate: Date = new Date(),
    ): Promise<ProcessReminderResult> {
        const summary: ProcessReminderResult = {
            processedTests: 0,
            emailsQueued: 0,
            skipped: 0,
            failed: 0,
        };

        const threeDay = await this.processForOffset(
            referenceDate,
            3,
            TestExamNotificationType.THREE_DAY,
            'About 3 days remaining',
        );
        const dayOf = await this.processForOffset(
            referenceDate,
            0,
            TestExamNotificationType.DAY_OF,
            'Due today',
        );

        summary.processedTests =
            threeDay.processedTests + dayOf.processedTests;
        summary.emailsQueued = threeDay.emailsQueued + dayOf.emailsQueued;
        summary.skipped = threeDay.skipped + dayOf.skipped;
        summary.failed = threeDay.failed + dayOf.failed;

        this.logger.log(
            `Exam reminders: tests=${summary.processedTests}, queued=${summary.emailsQueued}, skipped=${summary.skipped}, failed=${summary.failed}`,
        );
        return summary;
    }

    /** Admin/history: recent notification rows for an organization. */
    async listNotifications(params: {
        orgId: string;
        limit?: number;
    }): Promise<TestExamNotification[]> {
        return this.notificationRepository.find({
            where: { orgId: params.orgId },
            order: { createdAt: 'DESC' },
            take: params.limit ?? 100,
        });
    }

    /** Upcoming exams for in-app banners (next N days). */
    async listUpcomingExamsForUser(params: {
        userId: string;
        orgId?: string;
        withinDays?: number;
    }): Promise<
        Array<{
            testId: number;
            title: string;
            courseId: number;
            courseTitle: string;
            examDate: Date;
            daysUntil: number;
        }>
    > {
        const withinDays = params.withinDays ?? 7;
        const now = new Date();
        const end = new Date(now);
        end.setUTCDate(end.getUTCDate() + withinDays);

        const qb = this.testRepository
            .createQueryBuilder('test')
            .leftJoinAndSelect('test.course', 'course')
            .leftJoinAndSelect('test.orgId', 'org')
            .where('test.isActive = :active', { active: true })
            .andWhere('test.examDate IS NOT NULL')
            .andWhere('test.examDate >= :now', { now })
            .andWhere('test.examDate <= :end', { end })
            .orderBy('test.examDate', 'ASC');

        if (params.orgId) {
            qb.andWhere('org.id = :orgId', { orgId: params.orgId });
        }

        const tests = await qb.getMany();
        const eligible: Array<{
            testId: number;
            title: string;
            courseId: number;
            courseTitle: string;
            examDate: Date;
            daysUntil: number;
        }> = [];

        for (const test of tests) {
            if (!test.examDate) {
                continue;
            }
            const recipients = await this.resolveRecipients(test);
            if (!recipients.some(r => r.userId === params.userId)) {
                continue;
            }
            if (await this.hasCompletedTest(params.userId, test.testId)) {
                continue;
            }
            const daysUntil = this.utcCalendarDayDiff(now, test.examDate);
            eligible.push({
                testId: test.testId,
                title: test.title,
                courseId: test.courseId,
                courseTitle: test.course?.title ?? 'Course',
                examDate: test.examDate,
                daysUntil,
            });
        }

        return eligible;
    }

    private async processForOffset(
        referenceDate: Date,
        daysUntilExam: number,
        notificationType: TestExamNotificationType,
        timeRemainingLabel: string,
    ): Promise<ProcessReminderResult> {
        const summary: ProcessReminderResult = {
            processedTests: 0,
            emailsQueued: 0,
            skipped: 0,
            failed: 0,
        };

        const { start, end } = this.utcDayWindow(
            referenceDate,
            daysUntilExam,
        );

        const tests = await this.testRepository
            .createQueryBuilder('test')
            .leftJoinAndSelect('test.course', 'course')
            .leftJoinAndSelect('test.orgId', 'org')
            .leftJoinAndSelect('test.branchId', 'branch')
            .where('test.isActive = :active', { active: true })
            .andWhere('test.examDate IS NOT NULL')
            .andWhere('test.examDate >= :start', { start })
            .andWhere('test.examDate < :end', { end })
            .getMany();

        for (const test of tests) {
            summary.processedTests += 1;
            if (!test.examDate || !test.orgId?.id) {
                summary.skipped += 1;
                continue;
            }

            const recipients = await this.resolveRecipients(test);
            for (const recipient of recipients) {
                const alreadySent = await this.notificationRepository.findOne({
                    where: {
                        testId: test.testId,
                        userId: recipient.userId,
                        notificationType,
                        status: In([
                            TestExamNotificationStatus.SENT,
                            TestExamNotificationStatus.PENDING,
                        ]),
                    },
                });
                if (alreadySent) {
                    summary.skipped += 1;
                    continue;
                }

                if (await this.hasCompletedTest(recipient.userId, test.testId)) {
                    await this.notificationRepository.save(
                        this.notificationRepository.create({
                            testId: test.testId,
                            userId: recipient.userId,
                            orgId: test.orgId.id,
                            notificationType,
                            status: TestExamNotificationStatus.SKIPPED,
                            examDate: test.examDate,
                            recipientEmail: recipient.email,
                            errorMessage: 'User already passed this test',
                        }),
                    );
                    summary.skipped += 1;
                    continue;
                }

                const log = this.notificationRepository.create({
                    testId: test.testId,
                    userId: recipient.userId,
                    orgId: test.orgId.id,
                    notificationType,
                    status: TestExamNotificationStatus.PENDING,
                    examDate: test.examDate,
                    recipientEmail: recipient.email,
                });

                try {
                    await this.notificationRepository.save(log);
                } catch {
                    // Unique constraint race — another worker already claimed this send
                    summary.skipped += 1;
                    continue;
                }

                try {
                    const communicationId =
                        await this.communicationsService.sendTestExamReminderEmail(
                            {
                                recipientEmail: recipient.email,
                                recipientName: `${recipient.firstName} ${recipient.lastName}`.trim(),
                                organizationId: test.orgId.id,
                                testId: test.testId,
                                testTitle: test.title,
                                courseId: test.courseId,
                                courseTitle: test.course?.title ?? 'Course',
                                examDate: test.examDate,
                                notificationType:
                                    notificationType ===
                                    TestExamNotificationType.THREE_DAY
                                        ? 'three_day'
                                        : 'day_of',
                                timeRemainingLabel,
                                userId: recipient.userId,
                            },
                        );

                    log.status = TestExamNotificationStatus.SENT;
                    log.sentAt = new Date();
                    log.communicationId = communicationId;
                    await this.notificationRepository.save(log);
                    summary.emailsQueued += 1;
                } catch (error) {
                    log.status = TestExamNotificationStatus.FAILED;
                    log.errorMessage =
                        error instanceof Error
                            ? error.message
                            : String(error);
                    await this.notificationRepository.save(log);
                    summary.failed += 1;
                    this.logger.error(
                        `Failed exam reminder test=${test.testId} user=${recipient.userId}`,
                        error instanceof Error ? error.stack : String(error),
                    );
                }
            }
        }

        return summary;
    }

    /**
     * Prefer invitation assignees; otherwise notify active learners in the
     * test org (and branch when the test is branch-scoped).
     */
    private async resolveRecipients(test: Test): Promise<ReminderRecipient[]> {
        const invitations = await this.invitationRepository.find({
            where: {
                testId: test.testId,
                status: In([
                    InvitationStatus.PENDING,
                    InvitationStatus.ACCEPTED,
                ]),
            },
        });

        if (invitations.length > 0) {
            const userIds = [...new Set(invitations.map(inv => inv.userId))];
            const users = await this.userRepository.find({
                where: {
                    id: In(userIds),
                    status: UserStatus.ACTIVE,
                },
            });
            return users
                .filter(user => Boolean(user.email))
                .map(user => ({
                    userId: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                }));
        }

        const orgId = test.orgId?.id;
        if (!orgId) {
            return [];
        }

        const qb = this.userRepository
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.orgId', 'org')
            .leftJoinAndSelect('user.branchId', 'branch')
            .where('org.id = :orgId', { orgId })
            .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
            .andWhere('user.role = :role', { role: UserRole.USER });

        if (test.branchId?.id) {
            qb.andWhere('branch.id = :branchId', {
                branchId: test.branchId.id,
            });
        }

        const users = await qb.getMany();
        return users.map(user => ({
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        }));
    }

    private async hasCompletedTest(
        userId: string,
        testId: number,
    ): Promise<boolean> {
        const passed = await this.resultRepository.findOne({
            where: { userId, testId, passed: true },
        });
        return Boolean(passed);
    }

    /** UTC midnight window for a day offset from reference. */
    private utcDayWindow(
        referenceDate: Date,
        daysFromNow: number,
    ): { start: Date; end: Date } {
        const start = new Date(
            Date.UTC(
                referenceDate.getUTCFullYear(),
                referenceDate.getUTCMonth(),
                referenceDate.getUTCDate() + daysFromNow,
                0,
                0,
                0,
                0,
            ),
        );
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        return { start, end };
    }

    private utcCalendarDayDiff(from: Date, to: Date): number {
        const fromUtc = Date.UTC(
            from.getUTCFullYear(),
            from.getUTCMonth(),
            from.getUTCDate(),
        );
        const toUtc = Date.UTC(
            to.getUTCFullYear(),
            to.getUTCMonth(),
            to.getUTCDate(),
        );
        return Math.round((toUtc - fromUtc) / (1000 * 60 * 60 * 24));
    }
}
