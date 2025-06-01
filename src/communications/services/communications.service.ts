import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailTemplateService } from './email-template.service';
import { EmailQueueService } from './email-queue.service';
import { EmailType } from '../entities/communication.entity';
import { WelcomeOrganizationTemplateData } from '../interfaces/template.interface';

@Injectable()
export class CommunicationsService {
    private readonly logger = new Logger(CommunicationsService.name);

    constructor(
        @Inject(forwardRef(() => EmailTemplateService))
        private readonly emailTemplateService: EmailTemplateService,
        private readonly emailQueueService: EmailQueueService,
        private readonly configService: ConfigService,
    ) {}

    /**
     * Get base template data that all emails should include
     */
    private getBaseTemplateData(recipientEmail: string, recipientName?: string) {
        const clientUrl = this.configService.get('CLIENT_URL', 'http://localhost:3000');
        const appName = this.configService.get('APP_NAME', 'trainpro Platform');
        const supportEmail = this.configService.get('SUPPORT_EMAIL', 'support@trainpro.com');
        
        return {
            recipientName,
            recipientEmail,
            companyName: appName,
            companyUrl: clientUrl,
            supportEmail,
            unsubscribeUrl: `${clientUrl}/unsubscribe`,
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
            const clientUrl = this.configService.get('CLIENT_URL', 'http://localhost:3000');
            const baseData = this.getBaseTemplateData(organizationEmail, organizationName);
            
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

            // ... existing code ...
        } catch (error) {
            this.logger.error(`Error sending welcome organization email: ${error.message}`);
            throw error;
        }
    }
} 