import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { OrgService } from '../org/org.service';
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
        private readonly orgService: OrgService,
    ) {}

    /**
     * Get base template data that all emails should include
     */
    private getBaseTemplateData(
        recipientEmail: string,
        recipientName?: string,
    ) {
        const clientUrl = this.configService.get<string>(
            'CLIENT_URL',
            'http://localhost:3000',
        );
        const appName = this.configService.get<string>(
            'APP_NAME',
            'trainpro Platform',
        );
        const supportEmail = this.configService.get<string>(
            'SUPPORT_EMAIL',
            'support@trainpro.com',
        );

        return {
            recipientName,
            recipientEmail,
            companyName: appName,
            companyUrl: clientUrl,
            supportEmail,
            unsubscribeUrl: `${clientUrl}/unsubscribe`,
        };
    }

    /**
     * Get organization data for email sender information
     */
    private async getOrganizationDataForEmail(
        organizationId?: string,
    ): Promise<{
        organization?: {
            id: string;
            name: string;
            email?: string;
            logoUrl?: string;
            website?: string;
        };
        sender: {
            email: string;
            name: string;
        };
    }> {
        let organizationData: any = undefined;
        let senderData: any;

        // Load organization data if organizationId is provided
        if (organizationId) {
            try {
                const organization = await this.orgService.findOrganizationById(organizationId);
                if (organization) {
                    organizationData = {
                        id: organization.id,
                        name: organization.name,
                        email: organization.email,
                        logoUrl: organization.logoUrl,
                        website: organization.website,
                    };

                    // Set organization as sender if organization email exists
                    if (organization.email) {
                        senderData = {
                            email: organization.email,
                            name: organization.name,
                        };
                    }
                }
            } catch (error) {
                console.error('Failed to load organization data for email:', error);
            }
        }

        // Fallback to system sender if no organization sender
        if (!senderData) {
            const appName = this.configService.get<string>(
                'APP_NAME',
                'trainpro Platform',
            );
            const systemEmail = this.configService.get<string>(
                'EMAIL_FROM_ADDRESS',
                'noreply@trainpro.com',
            );
            senderData = {
                email: systemEmail,
                name: appName,
            };
        }

        return {
            organization: organizationData,
            sender: senderData,
        };
    }

    async sendWelcomeOrganizationEmail(
        organizationId: string,
        organizationName: string,
        organizationEmail: string,
        logoUrl?: string,
        website?: string,
    ): Promise<void> {
        try {
            const clientUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const baseData = this.getBaseTemplateData(
                organizationEmail,
                organizationName,
            );

            const templateData: WelcomeOrganizationTemplateData = {
                ...baseData,
                organizationName,
                organizationId,
                dashboardUrl: `${clientUrl}/dashboard`,
                loginUrl: `${clientUrl}/login`,
                logoUrl,
                website,
                setupGuideUrl: `${clientUrl}/setup-guide`,
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
            const clientUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            const baseData = this.getBaseTemplateData(branchEmail, branchName);

            const templateData: WelcomeBranchTemplateData = {
                ...baseData,
                branchName,
                branchId,
                organizationName,
                organizationId,
                dashboardUrl: `${clientUrl}/dashboard`,
                loginUrl: `${clientUrl}/login`,
                address,
                contactNumber,
                managerName,
                setupGuideUrl: `${clientUrl}/setup-guide`,
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
                orgId: organizationId ? ({ id: organizationId } as any) : null,
                branchId: branchId ? ({ id: branchId } as any) : null,
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

    async sendUserDeactivatedEmail(
        userId: string,
        userEmail: string,
        firstName: string,
        lastName: string,
        organizationId?: string,
        organizationName?: string,
        branchId?: string,
        branchName?: string,
        reason?: string,
        deactivatedBy?: string,
    ): Promise<void> {
        try {
            const templateData = {
                recipientName: firstName,
                recipientEmail: userEmail,
                firstName,
                lastName,
                userEmail,
                organizationName,
                branchName,
                reason,
                deactivatedBy,
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
                EmailType.USER_DEACTIVATED,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: firstName,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.USER_DEACTIVATED,
                templateUsed: 'user-deactivated',
                status: EmailStatus.PENDING,
                metadata: {
                    userId,
                    organizationId,
                    organizationName,
                    branchId,
                    branchName,
                    reason,
                    deactivatedBy,
                },
            });

            await this.communicationRepository.save(communication);

            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `User deactivated email queued for: ${firstName} ${lastName} (${userEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send user deactivated email for ${firstName} ${lastName}:`,
                error,
            );
        }
    }

    async sendUserRestoredEmail(
        userId: string,
        userEmail: string,
        firstName: string,
        lastName: string,
        organizationId?: string,
        organizationName?: string,
        branchId?: string,
        branchName?: string,
        restoredBy?: string,
    ): Promise<void> {
        try {
            const templateData = {
                recipientName: firstName,
                recipientEmail: userEmail,
                firstName,
                lastName,
                userEmail,
                organizationName,
                branchName,
                restoredBy,
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
                unsubscribeUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/unsubscribe`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.USER_RESTORED,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: firstName,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.USER_RESTORED,
                templateUsed: 'user-restored',
                status: EmailStatus.PENDING,
                metadata: {
                    userId,
                    organizationId,
                    organizationName,
                    branchId,
                    branchName,
                    restoredBy,
                },
            });

            await this.communicationRepository.save(communication);

            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `User restored email queued for: ${firstName} ${lastName} (${userEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send user restored email for ${firstName} ${lastName}:`,
                error,
            );
        }
    }

    async sendCourseCreatedEmail(
        courseId: number,
        title: string,
        description: string,
        creatorId: string,
        creatorEmail: string,
        creatorFirstName: string,
        creatorLastName: string,
        organizationId?: string,
        organizationName?: string,
        branchId?: string,
        branchName?: string,
    ): Promise<void> {
        try {
            const templateData = {
                recipientName: creatorFirstName,
                recipientEmail: creatorEmail,
                title,
                description,
                creatorFirstName,
                creatorLastName,
                organizationName,
                branchName,
                courseUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/courses/${courseId}`,
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
                unsubscribeUrl: `${this.configService.get('CLIENT_URL', 'http://localhost:3000')}/unsubscribe`,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.COURSE_CREATED,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: creatorEmail,
                recipientName: creatorFirstName,
                senderEmail: this.configService.get(
                    'EMAIL_FROM_ADDRESS',
                    'noreply@trainpro.com',
                ),
                senderName: 'trainpro Platform',
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.COURSE_CREATED,
                templateUsed: 'course-created',
                status: EmailStatus.PENDING,
                metadata: {
                    courseId,
                    creatorId,
                    organizationId,
                    organizationName,
                    branchId,
                    branchName,
                },
            });

            await this.communicationRepository.save(communication);

            await this.emailQueueService.queueEmail({
                to: creatorEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(
                `Course created email queued for: ${creatorFirstName} ${creatorLastName} (${creatorEmail})`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to send course created email for course ${title}:`,
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

    async sendResultsSummaryEmail(templateData: {
        recipientName: string;
        recipientEmail: string;
        testTitle: string;
        score: number;
        totalQuestions: number;
        correctAnswers: number;
        percentage: number;
        completionTime: string;
        resultsUrl: string;
        feedback?: string;
        organizationId?: string;
    }): Promise<void> {
        try {
            const baseData = this.getBaseTemplateData(
                templateData.recipientEmail,
                templateData.recipientName,
            );

            // Get organization data for sender information
            const orgData = await this.getOrganizationDataForEmail(templateData.organizationId);

            const fullTemplateData = {
                ...baseData,
                ...templateData,
                organizationName: orgData.organization?.name,
                organizationLogo: orgData.organization?.logoUrl,
                organizationWebsite: orgData.organization?.website,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.RESULTS_SUMMARY,
                fullTemplateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: templateData.recipientEmail,
                recipientName: templateData.recipientName,
                senderEmail: orgData.sender.email,
                senderName: orgData.sender.name,
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.RESULTS_SUMMARY,
                templateUsed: 'results-summary',
                status: EmailStatus.PENDING,
                metadata: {
                    testTitle: templateData.testTitle,
                    score: templateData.score,
                    percentage: templateData.percentage,
                    resultsEmailSent: true,
                },
            });

            await this.communicationRepository.save(communication);
            await this.emailQueueService.queueEmail({
                to: templateData.recipientEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(`Results summary email queued for ${templateData.recipientEmail}`);
        } catch (error) {
            this.logger.error('Failed to send results summary email:', error);
            throw error;
        }
    }

    async sendTestInvitationEmail(
        invitationId: string,
        testId: number,
        testTitle: string,
        testType: string,
        courseId: number,
        courseTitle: string,
        userId: string,
        userEmail: string,
        userFirstName: string,
        userLastName: string,
        invitedBy: string,
        inviterName: string,
        message?: string,
        expiresAt?: Date,
        durationMinutes?: number,
        maxAttempts?: number,
        organizationId?: string,
        branchId?: string,
    ): Promise<void> {
        try {
            const clientUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            
            const baseData = this.getBaseTemplateData(
                userEmail,
                `${userFirstName} ${userLastName}`,
            );

            // Get organization data for sender information
            const orgData = await this.getOrganizationDataForEmail(organizationId);

            const templateData = {
                ...baseData,
                invitationId,
                testTitle,
                testType,
                courseTitle,
                courseId,
                testUrl: `${clientUrl}/dashboard/tests/${testId}`,
                courseUrl: `${clientUrl}/dashboard/courses/${courseId}`,
                acceptInvitationUrl: `${clientUrl}/dashboard/invitations/${invitationId}/accept`,
                declineInvitationUrl: `${clientUrl}/dashboard/invitations/${invitationId}/decline`,
                inviterName,
                customMessage: message,
                expiresAt: expiresAt?.toISOString(),
                formattedExpiryDate: expiresAt ? this.formatDate(expiresAt) : null,
                durationMinutes,
                maxAttempts,
                userFirstName,
                userLastName,
                hasTimeLimit: !!durationMinutes,
                hasExpiry: !!expiresAt,
                hasCustomMessage: !!message,
                organizationName: orgData.organization?.name,
                organizationLogo: orgData.organization?.logoUrl,
                organizationWebsite: orgData.organization?.website,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.TEST_INVITATION,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: `${userFirstName} ${userLastName}`,
                senderEmail: orgData.sender.email,
                senderName: orgData.sender.name,
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.TEST_INVITATION,
                templateUsed: 'test-invitation',
                status: EmailStatus.PENDING,
                metadata: {
                    invitationId,
                    testId,
                    testTitle,
                    userId,
                    invitedBy,
                    invitationType: 'test_invitation',
                    hasExpiry: !!expiresAt,
                    expiresAt: expiresAt?.toISOString(),
                },
            });

            await this.communicationRepository.save(communication);
            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(`Test invitation email queued for ${userEmail} (${testTitle})`);
        } catch (error) {
            this.logger.error('Failed to send test invitation email:', error);
            throw error;
        }
    }

    async sendTestInvitationAcceptedEmail(
        invitationId: string,
        testId: number,
        testTitle: string,
        userId: string,
        userEmail: string,
        userFirstName: string,
        userLastName: string,
        responseNotes?: string,
        organizationId?: string,
        branchId?: string,
    ): Promise<void> {
        try {
            const clientUrl = this.configService.get<string>(
                'CLIENT_URL',
                'http://localhost:3000',
            );
            
            const baseData = this.getBaseTemplateData(
                userEmail,
                `${userFirstName} ${userLastName}`,
            );

            // Get organization data for sender information
            const orgData = await this.getOrganizationDataForEmail(organizationId);

            const templateData = {
                ...baseData,
                invitationId,
                testTitle,
                startTestUrl: `${clientUrl}/dashboard/tests/${testId}/take`,
                testDashboardUrl: `${clientUrl}/dashboard/tests/${testId}`,
                userFirstName,
                userLastName,
                responseNotes,
                hasResponseNotes: !!responseNotes,
                organizationName: orgData.organization?.name,
                organizationLogo: orgData.organization?.logoUrl,
                organizationWebsite: orgData.organization?.website,
            };

            const rendered = await this.emailTemplateService.renderByType(
                EmailType.TEST_ACTIVATED,
                templateData,
            );

            const communication = this.communicationRepository.create({
                recipientEmail: userEmail,
                recipientName: `${userFirstName} ${userLastName}`,
                senderEmail: orgData.sender.email,
                senderName: orgData.sender.name,
                subject: rendered.subject,
                body: rendered.html || '',
                plainTextBody: rendered.text,
                emailType: EmailType.TEST_ACTIVATED,
                templateUsed: 'test-activated',
                status: EmailStatus.PENDING,
                metadata: {
                    invitationId,
                    testId,
                    testTitle,
                    userId,
                    invitationType: 'invitation_accepted',
                    responseNotes,
                },
            });

            await this.communicationRepository.save(communication);
            await this.emailQueueService.queueEmail({
                to: userEmail,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
            });

            this.logger.log(`Test invitation accepted email queued for ${userEmail}`);
        } catch (error) {
            this.logger.error('Failed to send test invitation accepted email:', error);
            throw error;
        }
    }

    // Remove the old test email methods and replace with invitation-based ones
    private formatDate(date: Date): string {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
        }).format(date);
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
