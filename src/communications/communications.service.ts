import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { OrgBranchScope } from '../auth/decorators/org-branch-scope.decorator';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { UpdateCommunicationDto } from './dto/update-communication.dto';
import { Communication } from './entities/communication.entity';
import { EmailTemplateService } from './services/email-template.service';
import { EmailQueueService } from './services/email-queue.service';
import { EmailSMTPService } from './services/email-smtp.service';
import {
    WelcomeOrganizationTemplateData,
    WelcomeBranchTemplateData,
    WelcomeUserTemplateData,
} from './interfaces/template.interface';
import { EmailType } from './entities/communication.entity';
import { EmailStatus } from './entities/communication.entity';

@Injectable()
export class CommunicationsService {
    private readonly logger = new Logger(CommunicationsService.name);

    constructor(
        @InjectRepository(Communication)
        private readonly communicationRepository: Repository<Communication>,
        private readonly emailTemplateService: EmailTemplateService,
        private readonly emailSMTPService: EmailSMTPService,
        private readonly emailQueueService: EmailQueueService,
        private readonly configService: ConfigService,
    ) {}

    async sendWelcomeOrganizationEmail(
        organizationId: string,
        organizationName: string,
        organizationEmail: string,
        logoUrl?: string,
        website?: string,
    ): Promise<void> {
        try {
            const templateData: WelcomeOrganizationTemplateData = {
                recipientName: organizationName,
                recipientEmail: organizationEmail,
                organizationName,
                organizationId,
                dashboardUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/dashboard`,
                loginUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/login`,
                companyName: 'trainpro Platform',
                companyUrl: this.configService.get(
                    'CLIENT_URL',
                    'http://localhost:3000',
                ),
                supportEmail: this.configService.get(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                logoUrl,
                website,
                setupGuideUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/setup-guide`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.WELCOME_ORGANIZATION,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: organizationEmail,
                recipientName: organizationName,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.WELCOME_ORGANIZATION,
                templateUsed: 'welcome-organization',
                status: EmailStatus.PENDING,
                metadata: {
                    organizationId,
                    organizationName,
                },
            });

            await this.communicationRepository.save(communication);

            // Queue the email for sending
            await this.emailQueueService.queueEmail({
                to: organizationEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Welcome email queued for organization: ${organizationName} (${organizationEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send welcome email for organization ${organizationName}:`,
                error,
            );
        }
    }

    async sendWelcomeBranchEmail(
        branchId: string,
        branchName: string,
        branchEmail: string,
        organizationId: string,
        organizationName: string,
        address?: string,
        contactNumber?: string,
        managerName?: string,
    ): Promise<void> {
        try {
            const templateData: WelcomeBranchTemplateData = {
                recipientName: branchName,
                recipientEmail: branchEmail,
                branchName,
                branchId,
                organizationName,
                organizationId,
                dashboardUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/dashboard`,
                loginUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/login`,
                companyName: 'trainpro Platform',
                companyUrl: this.configService.get(
                    'CLIENT_URL',
                    'http://localhost:3000',
                ),
                supportEmail: this.configService.get(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                address,
                contactNumber,
                managerName,
                setupGuideUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/setup-guide`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.WELCOME_BRANCH,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: branchEmail,
                recipientName: branchName,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.WELCOME_BRANCH,
                templateUsed: 'welcome-branch',
                status: EmailStatus.PENDING,

                metadata: {
                    branchId,
                    branchName,
                    organizationId,
                    organizationName,
                },
            });

            await this.communicationRepository.save(communication);

            // Queue the email for sending
            await this.emailQueueService.queueEmail({
                to: branchEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Welcome email queued for branch: ${branchName} (${branchEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send welcome email for branch ${branchName}:`,
                error,
            );
        }
    }

    async sendWelcomeUserEmail(
        userId: string,
        userEmail: string,
        firstName: string,
        lastName: string,
        organizationId?: string,
        organizationName?: string,
        branchId?: string,
        branchName?: string,
        avatar?: string,
    ): Promise<void> {
        try {
            const templateData: WelcomeUserTemplateData = {
                recipientName: `${firstName} ${lastName}`,
                recipientEmail: userEmail,
                firstName,
                lastName,
                userId,
                dashboardUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/dashboard`,
                loginUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/login`,
                profileUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/profile`,
                companyName: 'trainpro Platform',
                companyUrl: this.configService.get(
                    'CLIENT_URL',
                    'http://localhost:3000',
                ),
                supportEmail: this.configService.get(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                organizationName,
                branchName,
                avatar,
                setupGuideUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/setup-guide`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.WELCOME_USER,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: `${firstName} ${lastName}`,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.WELCOME_USER,
                templateUsed: 'welcome-user',
                status: EmailStatus.PENDING,
                metadata: {
                    userId,
                    firstName,
                    lastName,
                    organizationId,
                    organizationName,
                    branchId,
                    branchName,
                },
            });

            await this.communicationRepository.save(communication);

            // Queue the email for sending
            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Welcome email queued for user: ${firstName} ${lastName} (${userEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send welcome email for user ${firstName} ${lastName}:`,
                error,
            );
        }
    }

    async sendUserProfileUpdateEmail(
        userId: string,
        userEmail: string,
        firstName: string,
        lastName: string,
        updatedFields: string[],
        organizationName?: string,
        branchName?: string,
    ): Promise<void> {
        try {
            const templateData = {
                recipientName: `${firstName} ${lastName}`,
                recipientEmail: userEmail,
                firstName,
                lastName,
                userId,
                updatedFields: updatedFields.join(', '),
                profileUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/profile`,
                companyName: 'trainpro Platform',
                companyUrl: this.configService.get(
                    'CLIENT_URL',
                    'http://localhost:3000',
                ),
                supportEmail: this.configService.get(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                organizationName,
                branchName,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.SYSTEM_ALERT,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: `${firstName} ${lastName}`,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject || 'Profile Updated',
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.SYSTEM_ALERT,
                templateUsed: 'profile-update',
                status: EmailStatus.PENDING,
                metadata: {
                    userId,
                    updatedFields,
                    profileUpdate: true,
                },
            });

            await this.communicationRepository.save(communication);

            // Queue the email for sending
            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject || 'Profile Updated',
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Profile update email queued for user: ${firstName} ${lastName} (${userEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send profile update email for user ${firstName} ${lastName}:`,
                error,
            );
        }
    }

    async sendPasswordChangeEmail(
        userId: string,
        userEmail: string,
        firstName: string,
        lastName: string,
        organizationName?: string,
        branchName?: string,
    ): Promise<void> {
        try {
            const templateData = {
                recipientName: `${firstName} ${lastName}`,
                recipientEmail: userEmail,
                firstName,
                lastName,
                userId,
                changeTime: new Date().toISOString(),
                securityUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/security`,
                companyName: 'trainpro Platform',
                companyUrl: this.configService.get(
                    'CLIENT_URL',
                    'http://localhost:3000',
                ),
                supportEmail: this.configService.get(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
                organizationName,
                branchName,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.PASSWORD_RESET,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: `${firstName} ${lastName}`,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject || 'Password Changed',
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.PASSWORD_RESET,
                templateUsed: 'password-change',
                status: EmailStatus.PENDING,
                metadata: {
                    userId,
                    passwordChange: true,
                    changeTime: new Date().toISOString(),
                },
            });

            await this.communicationRepository.save(communication);

            // Queue the email for sending
            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject || 'Password Changed',
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Password change email queued for user: ${firstName} ${lastName} (${userEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send password change email for user ${firstName} ${lastName}:`,
                error,
            );
        }
    }

    async sendOrganizationAssignmentEmail(
        userId: string,
        userEmail: string,
        firstName: string,
        lastName: string,
        organizationName: string,
        branchName?: string,
        assignedBy?: string,
    ): Promise<void> {
        try {
            const templateData = {
                recipientName: `${firstName} ${lastName}`,
                recipientEmail: userEmail,
                firstName,
                lastName,
                userId,
                organizationName,
                branchName,
                dashboardUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/dashboard`,
                companyName: 'trainpro Platform',
                companyUrl: this.configService.get(
                    'CLIENT_URL',
                    'http://localhost:3000',
                ),
                supportEmail: this.configService.get(
                    'SUPPORT_EMAIL',
                    'support@trainpro.com',
                ),
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.SYSTEM_ALERT,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: `${firstName} ${lastName}`,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject || 'Organization Assignment Updated',
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.SYSTEM_ALERT,
                templateUsed: 'organization-assignment',
                status: EmailStatus.PENDING,
                metadata: {
                    userId,
                    organizationAssignment: true,
                    organizationName,
                    branchName,
                    assignedBy,
                    assignedAt: new Date().toISOString(),
                },
            });

            await this.communicationRepository.save(communication);

            // Queue the email for sending
            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject || 'Organization Assignment Updated',
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Organization assignment email queued for user: ${firstName} ${lastName} (${userEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send organization assignment email for user ${firstName} ${lastName}:`,
                error,
            );
        }
    }

    create(
        createCommunicationDto: CreateCommunicationDto,
        scope: OrgBranchScope,
        userId: string,
    ) {
        // TODO: Implement actual communication creation with proper scoping
        console.log(
            'Creating communication for org:',
            scope.orgId,
            'user:',
            userId,
        );
        console.log('Communication data:', createCommunicationDto);
        return 'This action adds a new communication';
    }

    findAll(scope: OrgBranchScope, userId: string) {
        // TODO: Implement actual communication retrieval with proper scoping
        console.log(
            'Getting communications for org:',
            scope.orgId,
            'user:',
            userId,
        );
        return `This action returns all communications`;
    }

    findOne(id: number, scope: OrgBranchScope, userId: string) {
        // TODO: Implement actual communication retrieval with proper scoping
        console.log(
            'Getting communication',
            id,
            'for org:',
            scope.orgId,
            'user:',
            userId,
        );
        return `This action returns a #${id} communication`;
    }

    update(
        id: number,
        updateCommunicationDto: UpdateCommunicationDto,
        scope: OrgBranchScope,
        userId: string,
    ) {
        // TODO: Implement actual communication update with proper scoping
        console.log(
            'Updating communication',
            id,
            'for org:',
            scope.orgId,
            'user:',
            userId,
        );
        console.log('Update data:', updateCommunicationDto);
        return `This action updates a #${id} communication`;
    }

    remove(id: number, scope: OrgBranchScope, userId: string) {
        // TODO: Implement actual communication deletion with proper scoping
        console.log(
            'Removing communication',
            id,
            'for org:',
            scope.orgId,
            'user:',
            userId,
        );
        return `This action removes a #${id} communication`;
    }
}
