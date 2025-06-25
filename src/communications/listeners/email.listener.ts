import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommunicationsService } from '../communications.service';
import {
    OrganizationCreatedEvent,
    BranchCreatedEvent,
    UserCreatedEvent,
    UserProfileUpdatedEvent,
    UserPasswordChangedEvent,
    UserOrgBranchAssignedEvent,
    UserDeactivatedEvent,
    UserRestoredEvent,
    CourseCreatedEvent,
    TestInvitationSentEvent,
    TestInvitationRespondedEvent,
} from '../../common/events';

@Injectable()
export class EmailListener {
    private readonly logger = new Logger(EmailListener.name);

    constructor(
        private readonly communicationsService: CommunicationsService,
    ) {}

    @OnEvent('organization.created')
    async handleOrganizationCreated(event: OrganizationCreatedEvent) {
        try {
            this.logger.log(
                `Handling organization created event for: ${event.organizationName}`,
            );

            await this.communicationsService.sendWelcomeOrganizationEmail(
                event.organizationId,
                event.organizationName,
                event.organizationEmail,
                event.logoUrl,
                event.website,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle organization created event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('branch.created')
    async handleBranchCreated(event: BranchCreatedEvent) {
        try {
            this.logger.log(
                `Handling branch created event for: ${event.branchName}`,
            );

            await this.communicationsService.sendWelcomeBranchEmail(
                event.branchId,
                event.branchName,
                event.branchEmail,
                event.organizationId,
                event.organizationName,
                event.address,
                event.contactNumber,
                event.managerName,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle branch created event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('user.created')
    async handleUserCreated(event: UserCreatedEvent) {
        try {
            this.logger.log(
                `Handling user created event for: ${event.firstName} ${event.lastName}`,
            );

            await this.communicationsService.sendWelcomeUserEmail(
                event.userId,
                event.userEmail,
                event.firstName,
                event.lastName,
                event.organizationId,
                event.organizationName,
                event.branchId,
                event.branchName,
                event.avatar,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle user created event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('user.profile.updated')
    async handleUserProfileUpdated(event: UserProfileUpdatedEvent) {
        try {
            this.logger.log(
                `Handling user profile updated event for: ${event.firstName} ${event.lastName}`,
            );

            await this.communicationsService.sendUserProfileUpdateEmail(
                event.userId,
                event.userEmail,
                event.firstName,
                event.lastName,
                event.updatedFields || [],
                event.organizationName,
                event.branchName,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle user profile updated event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('user.password.changed')
    async handleUserPasswordChanged(event: UserPasswordChangedEvent) {
        try {
            this.logger.log(
                `Handling user password changed event for: ${event.firstName} ${event.lastName}`,
            );

            await this.communicationsService.sendPasswordChangeEmail(
                event.userId,
                event.userEmail,
                event.firstName,
                event.lastName,
                event.organizationName,
                event.branchName,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle user password changed event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('user.org.branch.assigned')
    async handleUserOrgBranchAssigned(event: UserOrgBranchAssignedEvent) {
        try {
            this.logger.log(
                `Handling user organization/branch assignment event for: ${event.firstName} ${event.lastName}`,
            );

            if (event.organizationName) {
                await this.communicationsService.sendOrganizationAssignmentEmail(
                    event.userId,
                    event.userEmail,
                    event.firstName,
                    event.lastName,
                    event.organizationName,
                    event.branchName,
                    event.assignedBy,
                );
            }
        } catch (error) {
            this.logger.error(
                'Failed to handle user organization/branch assignment event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('user.deactivated')
    async handleUserDeactivated(event: UserDeactivatedEvent) {
        try {
            this.logger.log(
                `Handling user deactivated event for: ${event.firstName} ${event.lastName}`,
            );

            await this.communicationsService.sendUserDeactivatedEmail(
                event.userId,
                event.userEmail,
                event.firstName,
                event.lastName,
                event.organizationId,
                event.organizationName,
                event.branchId,
                event.branchName,
                event.reason,
                event.deactivatedBy,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle user deactivated event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('user.restored')
    async handleUserRestored(event: UserRestoredEvent) {
        try {
            this.logger.log(
                `Handling user restored event for: ${event.firstName} ${event.lastName}`,
            );

            await this.communicationsService.sendUserRestoredEmail(
                event.userId,
                event.userEmail,
                event.firstName,
                event.lastName,
                event.organizationId,
                event.organizationName,
                event.branchId,
                event.branchName,
                event.restoredBy,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle user restored event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('course.created')
    async handleCourseCreated(event: CourseCreatedEvent) {
        try {
            this.logger.log(
                `Handling course created event for: ${event.title}`,
            );

            await this.communicationsService.sendCourseCreatedEmail(
                event.courseId,
                event.title,
                event.description,
                event.creatorId,
                event.creatorEmail,
                event.creatorFirstName,
                event.creatorLastName,
                event.organizationId,
                event.organizationName,
                event.branchId,
                event.branchName,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle course created event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    // Test invitation event handlers
    @OnEvent('test.invitation.sent')
    async handleTestInvitationSent(event: TestInvitationSentEvent) {
        try {
            this.logger.log(
                `Handling test invitation sent event for: ${event.testTitle} to ${event.userEmail}`,
            );

            await this.communicationsService.sendTestInvitationEmail(
                event.invitationId,
                event.testId,
                event.testTitle,
                event.testType,
                event.courseId,
                event.courseTitle,
                event.userId,
                event.userEmail,
                event.userFirstName,
                event.userLastName,
                event.invitedBy,
                event.inviterName,
                event.message,
                event.expiresAt,
                event.durationMinutes,
                event.maxAttempts,
                event.organizationId,
                event.branchId,
            );
        } catch (error) {
            this.logger.error(
                'Failed to handle test invitation sent event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }

    @OnEvent('test.invitation.responded')
    async handleTestInvitationResponded(event: TestInvitationRespondedEvent) {
        try {
            this.logger.log(
                `Handling test invitation response event for: ${event.testTitle} from ${event.userEmail}`,
            );

            // Only send confirmation email for accepted invitations
            if (event.response === 'accepted') {
                await this.communicationsService.sendTestInvitationAcceptedEmail(
                    event.invitationId,
                    event.testId,
                    event.testTitle,
                    event.userId,
                    event.userEmail,
                    event.userFirstName,
                    event.userLastName,
                    event.responseNotes,
                    event.organizationId,
                    event.branchId,
                );
            }
        } catch (error) {
            this.logger.error(
                'Failed to handle test invitation response event',
                error instanceof Error ? error.message : String(error),
            );
        }
    }
}
