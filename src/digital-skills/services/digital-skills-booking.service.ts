import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CommunicationsService } from '../../communications/communications.service';
import {
    InvitationStatus,
    TestInvitation,
} from '../../test/entities/test-invitation.entity';
import { User } from '../../user/entities/user.entity';
import {
    DIGITAL_SKILLS_BOOKING_NOTE,
    DIGITAL_SKILLS_BOOKING_TIME_ZONE,
    digitalSkillsCheckTitle,
} from '../constants/digital-skills.constant';
import { DigitalSkillsAssignment } from '../entities/digital-skills-assignment.entity';

interface BookRemedialTestsInput {
    readonly userId: string;
    readonly orgId: string;
    readonly branchId?: string;
    readonly resultId: number;
}

/**
 * Books weak-skill knowledge checks for the next day and emails the learner once.
 *
 * A booking is the assignment row plus a test invitation. Repeating the same
 * assessment result does not create a second invitation or a second email.
 */
@Injectable()
export class DigitalSkillsBookingService {
    private readonly logger = new Logger(DigitalSkillsBookingService.name);

    constructor(
        @InjectRepository(DigitalSkillsAssignment)
        private readonly assignmentRepository: Repository<DigitalSkillsAssignment>,
        @InjectRepository(TestInvitation)
        private readonly invitationRepository: Repository<TestInvitation>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly communicationsService: CommunicationsService,
    ) {}

    /** Schedules every current weak-skill row and notifies the learner once. */
    async bookRemedialTests(input: BookRemedialTestsInput): Promise<void> {
        const assignments = await this.assignmentRepository.find({
            where: { userId: input.userId },
            order: { skillGroup: 'ASC', skillTitle: 'ASC' },
        });
        if (assignments.length === 0) {
            return;
        }

        this.logger.log(
            `Booking Digital Skills checks for ${input.userId} from result ${input.resultId}`,
        );

        const dueDate = nextDayDueDate(new Date());
        let changed = false;
        for (const assignment of assignments) {
            if (assignment.expectedDueDate) {
                continue;
            }
            assignment.expectedDueDate = dueDate;
            assignment.bookingNotifiedAt = null;
            changed = true;
        }
        if (changed) {
            await this.assignmentRepository.save(assignments);
        }

        await this.syncInvitations(assignments, input);

        const needsEmail = assignments.some(row => !row.bookingNotifiedAt);
        if (!needsEmail) {
            return;
        }

        const emailDueDate =
            assignments.find(row => row.expectedDueDate)?.expectedDueDate ?? dueDate;

        try {
            await this.sendBookingEmail(
                input.userId,
                input.orgId,
                assignments,
                emailDueDate,
            );
            const notifiedAt = new Date();
            for (const assignment of assignments) {
                assignment.bookingNotifiedAt = notifiedAt;
            }
            await this.assignmentRepository.save(assignments);
        } catch (error) {
            this.logger.error(
                `Digital Skills booking email failed for ${input.userId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    private async syncInvitations(
        assignments: readonly DigitalSkillsAssignment[],
        input: BookRemedialTestsInput,
    ): Promise<void> {
        const bookedTestIds = new Set(
            assignments
                .map(row => row.testId)
                .filter((testId): testId is number => typeof testId === 'number'),
        );

        for (const assignment of assignments) {
            if (typeof assignment.testId !== 'number') {
                continue;
            }
            try {
                if (!assignment.expectedDueDate) {
                    continue;
                }
                await this.upsertInvitation(
                    assignment.testId,
                    input,
                    assignment.expectedDueDate,
                    assignment.skillTitle,
                );
            } catch (error) {
                this.logger.error(
                    `Could not book Digital Skills test ${assignment.testId} for ${input.userId}`,
                    error instanceof Error ? error.stack : String(error),
                );
            }
        }

        try {
            await this.expireDroppedInvitations(input.userId, bookedTestIds);
        } catch (error) {
            this.logger.error(
                `Could not expire old Digital Skills bookings for ${input.userId}`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }

    private async upsertInvitation(
        testId: number,
        input: BookRemedialTestsInput,
        dueDate: Date,
        skillTitle: string,
    ): Promise<void> {
        const message =
            `${DIGITAL_SKILLS_BOOKING_NOTE} Complete ${skillTitle} by ${formatDueDate(dueDate)}.`;
        const existing = await this.invitationRepository.findOne({
            where: { testId, userId: input.userId },
        });

        if (existing) {
            const existingDue = existing.expiresAt
                ? new Date(existing.expiresAt).getTime()
                : null;
            const sameDue =
                existingDue === dueDate.getTime() &&
                existing.status === InvitationStatus.PENDING;
            if (sameDue) {
                return;
            }
            existing.expiresAt = dueDate;
            existing.message = message;
            existing.status = InvitationStatus.PENDING;
            await this.invitationRepository.save(existing);
            return;
        }

        await this.invitationRepository.save(
            this.invitationRepository.create({
                testId,
                userId: input.userId,
                invitedBy: input.userId,
                status: InvitationStatus.PENDING,
                message,
                expiresAt: dueDate,
                orgId: input.orgId,
                branchId: input.branchId,
            }),
        );
    }

    private async expireDroppedInvitations(
        userId: string,
        bookedTestIds: ReadonlySet<number>,
    ): Promise<void> {
        const invitations = await this.invitationRepository.find({
            where: { userId, status: InvitationStatus.PENDING },
        });
        const dropped = invitations.filter(
            invitation =>
                invitation.message?.startsWith(DIGITAL_SKILLS_BOOKING_NOTE) &&
                !bookedTestIds.has(invitation.testId),
        );
        if (dropped.length === 0) {
            return;
        }
        for (const invitation of dropped) {
            invitation.status = InvitationStatus.EXPIRED;
        }
        await this.invitationRepository.save(dropped);
    }

    private async sendBookingEmail(
        userId: string,
        orgId: string,
        assignments: readonly DigitalSkillsAssignment[],
        dueDate: Date,
    ): Promise<void> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'email', 'firstName', 'lastName'],
        });
        if (!user?.email) {
            this.logger.warn(
                `Skipping Digital Skills booking email; user ${userId} has no email`,
            );
            return;
        }

        const items = assignments.map(assignment => ({
            skillTitle: assignment.skillTitle,
            testTitle: assignment.testId
                ? digitalSkillsCheckTitle(assignment.skillTitle)
                : assignment.skillTitle,
        }));

        await this.communicationsService.sendDigitalSkillsBookingEmail({
            userEmail: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            organizationId: orgId,
            expectedDueDate: dueDate,
            items,
        });
    }
}

/** 17:00 SAST on the next calendar day. */
function nextDayDueDate(from: Date): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: DIGITAL_SKILLS_BOOKING_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(from);
    const year = Number(parts.find(part => part.type === 'year')?.value);
    const month = Number(parts.find(part => part.type === 'month')?.value);
    const day = Number(parts.find(part => part.type === 'day')?.value);
    return new Date(Date.UTC(year, month - 1, day + 1, 15, 0, 0));
}

/** Date label in the same timezone used to schedule the booking. */
export function formatDueDate(dueDate: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: DIGITAL_SKILLS_BOOKING_TIME_ZONE,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(dueDate);
}
