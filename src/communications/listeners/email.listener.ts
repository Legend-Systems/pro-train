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
}
