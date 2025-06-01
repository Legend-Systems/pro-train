import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
    TemplateConfig,
    TemplateData,
    TemplateRenderOptions,
    TemplateRenderResult,
    TemplateValidationResult,
} from '../interfaces/template.interface';
import { EmailType } from '../entities/communication.entity';

@Injectable()
export class EmailTemplateService {
    private readonly logger = new Logger(EmailTemplateService.name);
    private templateCache: Map<string, Handlebars.TemplateDelegate> = new Map();
    private templateConfigs: Map<EmailType, TemplateConfig> = new Map();
    private templatesPath: string;

    constructor(private readonly configService: ConfigService) {
        this.templatesPath = this.configService.get<string>(
            'EMAIL_TEMPLATES_PATH',
            path.join(process.cwd(), 'templates'),
        );
        this.initializeHandlebars();
    }

    async onModuleInit() {
        this.loadTemplateConfigurations();
        await this.preloadTemplates();
    }

    private initializeHandlebars(): void {
        // Register common Handlebars helpers
        Handlebars.registerHelper('eq', (a: any, b: any): boolean => a === b);
        Handlebars.registerHelper('ne', (a: any, b: any): boolean => a !== b);
        Handlebars.registerHelper('gt', (a: any, b: any): boolean => a > b);
        Handlebars.registerHelper('lt', (a: any, b: any): boolean => a < b);
        Handlebars.registerHelper('gte', (a: any, b: any): boolean => a >= b);
        Handlebars.registerHelper('lte', (a: any, b: any): boolean => a <= b);
        Handlebars.registerHelper('and', (a: any, b: any): boolean => a && b);
        Handlebars.registerHelper('or', (a: any, b: any): boolean => a || b);
        Handlebars.registerHelper('not', a => !a);

        // Date formatting helper
        Handlebars.registerHelper(
            'formatDate',
            (date: any, format: any): string => {
                if (!date) return '';
                const d = new Date(date);
                if (format === 'short') {
                    return d.toLocaleDateString();
                }
                if (format === 'long') {
                    return (
                        d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
                    );
                }
                return d.toISOString();
            },
        );

        // Percentage helper
        Handlebars.registerHelper(
            'percentage',
            (value: any, total: any): string => {
                if (!total || total === 0) return '0%';
                return Math.round((value / total) * 100) + '%';
            },
        );

        // Capitalize helper
        Handlebars.registerHelper('capitalize', (str: any): string => {
            if (!str) return '';
            const stringValue = String(str);
            return (
                stringValue.charAt(0).toUpperCase() +
                stringValue.slice(1).toLowerCase()
            );
        });

        this.logger.log('Handlebars helpers registered successfully');
    }

    private loadTemplateConfigurations(): void {
        try {
            // Define template configurations
            const configs: TemplateConfig[] = [
                {
                    name: 'welcome',
                    type: EmailType.WELCOME,
                    htmlFile: 'welcome.hbs',
                    textFile: 'welcome.txt.hbs',
                    metadata: {
                        name: 'Welcome Email',
                        type: EmailType.WELCOME,
                        version: '1.0.0',
                        description: 'Welcome new users to the platform',
                        requiredData: [
                            'recipientName',
                            'loginUrl',
                            'dashboardUrl',
                        ],
                        optionalData: ['activationToken', 'profileUrl'],
                    },
                },
                {
                    name: 'welcome-organization',
                    type: EmailType.WELCOME_ORGANIZATION,
                    htmlFile: 'welcome-organization.hbs',
                    textFile: 'welcome-organization.txt.hbs',
                    metadata: {
                        name: 'Organization Welcome Email',
                        type: EmailType.WELCOME_ORGANIZATION,
                        version: '1.0.0',
                        description:
                            'Welcome new organizations to the platform',
                        requiredData: [
                            'organizationName',
                            'organizationId',
                            'dashboardUrl',
                            'loginUrl',
                        ],
                        optionalData: ['logoUrl', 'website', 'setupGuideUrl'],
                    },
                },
                {
                    name: 'welcome-branch',
                    type: EmailType.WELCOME_BRANCH,
                    htmlFile: 'welcome-branch.hbs',
                    textFile: 'welcome-branch.txt.hbs',
                    metadata: {
                        name: 'Branch Welcome Email',
                        type: EmailType.WELCOME_BRANCH,
                        version: '1.0.0',
                        description: 'Welcome new branches to the platform',
                        requiredData: [
                            'branchName',
                            'branchId',
                            'organizationName',
                            'organizationId',
                            'dashboardUrl',
                            'loginUrl',
                        ],
                        optionalData: [
                            'address',
                            'contactNumber',
                            'managerName',
                            'setupGuideUrl',
                        ],
                    },
                },
                {
                    name: 'welcome-user',
                    type: EmailType.WELCOME_USER,
                    htmlFile: 'welcome-user.hbs',
                    textFile: 'welcome-user.txt.hbs',
                    metadata: {
                        name: 'User Welcome Email',
                        type: EmailType.WELCOME_USER,
                        version: '1.0.0',
                        description: 'Welcome new users to the platform',
                        requiredData: [
                            'firstName',
                            'lastName',
                            'userId',
                            'dashboardUrl',
                            'loginUrl',
                            'profileUrl',
                        ],
                        optionalData: [
                            'organizationName',
                            'branchName',
                            'avatar',
                            'activationToken',
                            'setupGuideUrl',
                        ],
                    },
                },
                {
                    name: 'password-reset',
                    type: EmailType.PASSWORD_RESET,
                    htmlFile: 'password-reset.hbs',
                    textFile: 'password-reset.txt.hbs',
                    metadata: {
                        name: 'Password Reset',
                        type: EmailType.PASSWORD_RESET,
                        version: '1.0.0',
                        description: 'Password reset instructions',
                        requiredData: ['resetUrl', 'resetToken', 'expiryTime'],
                        optionalData: ['ipAddress'],
                    },
                },
                {
                    name: 'password-changed',
                    type: EmailType.PASSWORD_CHANGED,
                    htmlFile: 'password-changed.hbs',
                    textFile: 'password-changed.txt.hbs',
                    metadata: {
                        name: 'Password Changed',
                        type: EmailType.PASSWORD_CHANGED,
                        version: '1.0.0',
                        description:
                            'Password change confirmation notification',
                        requiredData: [
                            'recipientName',
                            'changeDateTime',
                            'loginUrl',
                        ],
                        optionalData: ['ipAddress', 'userAgent'],
                    },
                },
                {
                    name: 'test-notification',
                    type: EmailType.TEST_NOTIFICATION,
                    htmlFile: 'test-notification.hbs',
                    textFile: 'test-notification.txt.hbs',
                    metadata: {
                        name: 'Test Notification',
                        type: EmailType.TEST_NOTIFICATION,
                        version: '1.0.0',
                        description: 'Notify users about new tests',
                        requiredData: ['testTitle', 'dueDate', 'testUrl'],
                        optionalData: [
                            'testDescription',
                            'duration',
                            'instructorName',
                        ],
                    },
                },
                {
                    name: 'results-summary',
                    type: EmailType.RESULTS_SUMMARY,
                    htmlFile: 'results-summary.hbs',
                    textFile: 'results-summary.txt.hbs',
                    metadata: {
                        name: 'Results Summary',
                        type: EmailType.RESULTS_SUMMARY,
                        version: '1.0.0',
                        description: 'Test results summary',
                        requiredData: [
                            'testTitle',
                            'score',
                            'totalQuestions',
                            'correctAnswers',
                            'percentage',
                            'completionTime',
                            'resultsUrl',
                        ],
                        optionalData: ['feedback'],
                    },
                },
                {
                    name: 'course-enrollment',
                    type: EmailType.COURSE_ENROLLMENT,
                    htmlFile: 'course-enrollment.hbs',
                    textFile: 'course-enrollment.txt.hbs',
                    metadata: {
                        name: 'Course Enrollment',
                        type: EmailType.COURSE_ENROLLMENT,
                        version: '1.0.0',
                        description: 'Course enrollment confirmation',
                        requiredData: ['courseName', 'courseUrl'],
                        optionalData: [
                            'courseDescription',
                            'instructorName',
                            'startDate',
                            'endDate',
                        ],
                    },
                },
                {
                    name: 'course-created',
                    type: EmailType.COURSE_CREATED,
                    htmlFile: 'course-created.hbs',
                    textFile: 'course-created.txt.hbs',
                    metadata: {
                        name: 'Course Created',
                        type: EmailType.COURSE_CREATED,
                        version: '1.0.0',
                        description:
                            'Course creation confirmation for creators',
                        requiredData: [
                            'title',
                            'description',
                            'creatorFirstName',
                            'creatorLastName',
                            'courseUrl',
                            'dashboardUrl',
                        ],
                        optionalData: ['organizationName', 'branchName'],
                    },
                },
                {
                    name: 'user-deactivated',
                    type: EmailType.USER_DEACTIVATED,
                    htmlFile: 'user-deactivated.hbs',
                    textFile: 'user-deactivated.txt.hbs',
                    metadata: {
                        name: 'User Deactivated',
                        type: EmailType.USER_DEACTIVATED,
                        version: '1.0.0',
                        description: 'User account deactivation notification',
                        requiredData: ['firstName', 'lastName', 'userEmail'],
                        optionalData: [
                            'organizationName',
                            'branchName',
                            'reason',
                            'deactivatedBy',
                        ],
                    },
                },
                {
                    name: 'user-restored',
                    type: EmailType.USER_RESTORED,
                    htmlFile: 'user-restored.hbs',
                    textFile: 'user-restored.txt.hbs',
                    metadata: {
                        name: 'User Restored',
                        type: EmailType.USER_RESTORED,
                        version: '1.0.0',
                        description: 'User account restoration notification',
                        requiredData: [
                            'firstName',
                            'lastName',
                            'userEmail',
                            'dashboardUrl',
                        ],
                        optionalData: [
                            'organizationName',
                            'branchName',
                            'restoredBy',
                        ],
                    },
                },
                {
                    name: 'system-alert',
                    type: EmailType.SYSTEM_ALERT,
                    htmlFile: 'system-alert.hbs',
                    textFile: 'system-alert.txt.hbs',
                    metadata: {
                        name: 'System Alert',
                        type: EmailType.SYSTEM_ALERT,
                        version: '1.0.0',
                        description: 'System notifications and alerts',
                        requiredData: [
                            'alertType',
                            'alertTitle',
                            'alertMessage',
                            'timestamp',
                        ],
                        optionalData: ['actionUrl', 'actionText'],
                    },
                },
                {
                    name: 'custom',
                    type: EmailType.CUSTOM,
                    htmlFile: 'custom.hbs',
                    textFile: 'custom.txt.hbs',
                    metadata: {
                        name: 'Custom Email',
                        type: EmailType.CUSTOM,
                        version: '1.0.0',
                        description: 'Flexible custom email template',
                        requiredData: ['title', 'message'],
                        optionalData: [],
                    },
                },
            ];

            // Store configurations
            configs.forEach(config => {
                this.templateConfigs.set(config.type, config);
            });

            this.logger.log(`Loaded ${configs.length} template configurations`);
        } catch (error) {
            this.logger.error('Failed to load template configurations', error);
            throw error;
        }
    }

    private async preloadTemplates(): Promise<void> {
        try {
            for (const [type, config] of this.templateConfigs) {
                await this.loadTemplate(config.htmlFile);
                if (config.textFile) {
                    await this.loadTemplate(config.textFile);
                }
            }
            this.logger.log('✅ Email Templates');
        } catch (error) {
            this.logger.warn('Some templates failed to preload', error);
            // Don't throw - templates can be loaded on demand
        }
    }

    private async loadTemplate(
        templateFile: string,
    ): Promise<Handlebars.TemplateDelegate> {
        const cacheKey = templateFile;

        // Check cache first
        if (this.templateCache.has(cacheKey)) {
            return this.templateCache.get(cacheKey)!;
        }

        try {
            const templatePath = path.join(this.templatesPath, templateFile);
            const templateContent = await fs.readFile(templatePath, 'utf-8');
            const compiledTemplate = Handlebars.compile(templateContent);

            // Cache the compiled template
            this.templateCache.set(cacheKey, compiledTemplate);

            this.logger.debug(`Template loaded and cached: ${templateFile}`);
            return compiledTemplate;
        } catch (error) {
            this.logger.error(
                `Failed to load template: ${templateFile}`,
                error,
            );
            throw new NotFoundException(`Template not found: ${templateFile}`);
        }
    }

    async renderTemplate(
        options: TemplateRenderOptions,
    ): Promise<TemplateRenderResult> {
        const { template, data, format = 'both' } = options;

        try {
            const result: TemplateRenderResult = {
                subject: this.generateSubject(template, data),
            };

            if (format === 'html' || format === 'both') {
                const htmlTemplate = await this.loadTemplate(`${template}.hbs`);
                result.html = htmlTemplate(data);
            }

            if (format === 'text' || format === 'both') {
                try {
                    const textTemplate = await this.loadTemplate(
                        `${template}.txt.hbs`,
                    );
                    result.text = textTemplate(data);
                } catch (error) {
                    // If text template doesn't exist, generate from HTML
                    if (result.html) {
                        result.text = this.stripHtml(result.html);
                    }
                }
            }

            return result;
        } catch (error) {
            this.logger.error(`Failed to render template: ${template}`, error);
            throw error;
        }
    }

    async renderByType(
        type: EmailType,
        data: TemplateData,
        format?: 'html' | 'text' | 'both',
    ): Promise<TemplateRenderResult> {
        const config = this.templateConfigs.get(type);
        if (!config) {
            throw new NotFoundException(
                `Template configuration not found for type: ${type}`,
            );
        }

        // Validate required data
        const validation = this.validateTemplateData(type, data);
        if (!validation.isValid) {
            throw new Error(
                `Template validation failed: ${validation.errors.join(', ')}`,
            );
        }

        return this.renderTemplate({
            template: config.name,
            data,
            format,
        });
    }

    validateTemplateData(
        type: EmailType,
        data: TemplateData,
    ): TemplateValidationResult {
        const config = this.templateConfigs.get(type);
        if (!config) {
            return {
                isValid: false,
                errors: [`Template configuration not found for type: ${type}`],
            };
        }

        const errors: string[] = [];
        const warnings: string[] = [];
        const missingRequired: string[] = [];

        // Check required fields
        config.metadata.requiredData.forEach(field => {
            if (!data[field] && data[field] !== 0 && data[field] !== false) {
                missingRequired.push(field);
                errors.push(`Required field missing: ${field}`);
            }
        });

        // Check email format if present
        if (
            data.recipientEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.recipientEmail)
        ) {
            errors.push('Invalid email format for recipientEmail');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            missingRequired,
        };
    }

    private generateSubject(templateName: string, data: TemplateData): string {
        // Subject templates based on email type
        const subjectTemplates: Record<string, string> = {
            welcome: 'Welcome to {{companyName}} - Get Started!',
            'welcome-organization':
                'Welcome {{organizationName}} to {{companyName}}!',
            'welcome-branch':
                'Welcome {{branchName}} - {{organizationName}} Branch Setup Complete!',
            'welcome-user':
                'Welcome {{firstName}}! Your {{companyName}} Account is Ready',
            'password-reset': 'Password Reset Request',
            'password-changed': 'Password Changed Successfully',
            'test-notification': 'New Test Available: {{testTitle}}',
            'results-summary': 'Test Results: {{testTitle}}',
            'course-enrollment': 'Enrolled in {{courseName}}',
            'system-alert': '{{alertTitle}}',
            custom: '{{title}}',
        };

        const subjectTemplate = subjectTemplates[templateName] || '{{title}}';
        const compiledSubject = Handlebars.compile(subjectTemplate);

        // Provide default company name if not provided
        const subjectData = {
            companyName: 'trainpro Platform',
            ...data,
        };

        return compiledSubject(subjectData);
    }

    private stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }

    getTemplateConfig(type: EmailType): TemplateConfig | undefined {
        return this.templateConfigs.get(type);
    }

    getAllTemplateConfigs(): TemplateConfig[] {
        return Array.from(this.templateConfigs.values());
    }

    clearCache(): void {
        this.templateCache.clear();
        this.logger.log('Template cache cleared');
    }

    async reloadTemplate(templateFile: string): Promise<void> {
        this.templateCache.delete(templateFile);
        await this.loadTemplate(templateFile);
        this.logger.log(`Template reloaded: ${templateFile}`);
    }
}
