import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommunicationsService } from '../communications.service';
import {
    OrganizationCreatedEvent,
    BranchCreatedEvent,
    UserCreatedEvent,
} from '../../common/events';

@Injectable()
export class EmailListener {
    private readonly logger = new Logger(EmailListener.name);

    constructor(private readonly communicationsService: CommunicationsService) {}

    @OnEvent('organization.created')
    async handleOrganizationCreated(event: OrganizationCreatedEvent) {
        this.logger.log(`Handling organization created event for: ${event.organizationName}`);
        
        await this.communicationsService.sendWelcomeOrganizationEmail(
            event.organizationId,
            event.organizationName,
            event.organizationEmail,
            event.logoUrl,
            event.website,
        );
    }

    @OnEvent('branch.created')
    async handleBranchCreated(event: BranchCreatedEvent) {
        this.logger.log(`Handling branch created event for: ${event.branchName}`);
        
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
    }

    @OnEvent('user.created')
    async handleUserCreated(event: UserCreatedEvent) {
        this.logger.log(`Handling user created event for: ${event.firstName} ${event.lastName}`);
        
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
    }
} 