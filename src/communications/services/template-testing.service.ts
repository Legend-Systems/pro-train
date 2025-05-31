import { Injectable, Logger } from '@nestjs/common';
import { EmailTemplateService } from './email-template.service';
import { EmailType } from '../entities/communication.entity';
import {
    TemplateData,
    WelcomeTemplateData,
    PasswordResetTemplateData,
    TestNotificationTemplateData,
    ResultsSummaryTemplateData,
    CourseEnrollmentTemplateData,
    SystemAlertTemplateData,
    CustomTemplateData,
} from '../interfaces/template.interface';

@Injectable()
export class TemplateTestingService {
    private readonly logger = new Logger(TemplateTestingService.name);

    constructor(private readonly emailTemplateService: EmailTemplateService) {}

    /**
     * Generate sample data for testing templates
     */
    generateSampleData(type: EmailType): TemplateData {
        const baseData = {
            recipientName: 'John Doe',
            recipientEmail: 'john.doe@example.com',
            companyName: 'Exxam Platform',
            companyUrl: 'https://exxam.com',
            supportEmail: 'support@exxam.com',
            unsubscribeUrl: 'https://exxam.com/unsubscribe?token=sample',
        };

        switch (type) {
            case EmailType.WELCOME:
                return {
                    ...baseData,
                    loginUrl: 'https://exxam.com/login',
                    dashboardUrl: 'https://exxam.com/dashboard',
                    profileUrl: 'https://exxam.com/profile',
                    activationToken: 'sample-activation-token',
                } as WelcomeTemplateData;

            case EmailType.PASSWORD_RESET:
                return {
                    ...baseData,
                    resetUrl:
                        'https://exxam.com/reset-password?token=sample-reset-token',
                    resetToken: 'sample-reset-token',
                    expiryTime: '15 minutes',
                    ipAddress: '192.168.1.100',
                } as PasswordResetTemplateData;

            case EmailType.TEST_NOTIFICATION:
                return {
                    ...baseData,
                    testTitle: 'JavaScript Fundamentals Quiz',
                    testDescription:
                        'Test your knowledge of JavaScript basics including variables, functions, and DOM manipulation.',
                    dueDate: new Date(
                        Date.now() + 7 * 24 * 60 * 60 * 1000,
                    ).toISOString(), // 7 days from now
                    testUrl: 'https://exxam.com/tests/javascript-fundamentals',
                    duration: '45 minutes',
                    instructorName: 'Dr. Sarah Wilson',
                } as TestNotificationTemplateData;

            case EmailType.RESULTS_SUMMARY:
                return {
                    ...baseData,
                    testTitle: 'JavaScript Fundamentals Quiz',
                    score: 85,
                    totalQuestions: 20,
                    correctAnswers: 17,
                    percentage: 85,
                    completionTime: '32 minutes',
                    resultsUrl:
                        'https://exxam.com/results/javascript-fundamentals-123',
                    feedback:
                        'Great job! You have a solid understanding of JavaScript fundamentals. Consider reviewing array methods for improvement.',
                } as ResultsSummaryTemplateData;

            case EmailType.COURSE_ENROLLMENT:
                return {
                    ...baseData,
                    courseName: 'Full Stack Web Development',
                    courseDescription:
                        'Learn to build modern web applications using React, Node.js, and databases.',
                    courseUrl: 'https://exxam.com/courses/full-stack-web-dev',
                    instructorName: 'Prof. Michael Chen',
                    startDate: new Date(
                        Date.now() + 3 * 24 * 60 * 60 * 1000,
                    ).toISOString(), // 3 days from now
                    endDate: new Date(
                        Date.now() + 90 * 24 * 60 * 60 * 1000,
                    ).toISOString(), // 90 days from now
                } as CourseEnrollmentTemplateData;

            case EmailType.SYSTEM_ALERT:
                return {
                    ...baseData,
                    alertType: 'info' as const,
                    alertTitle: 'Scheduled Maintenance Notice',
                    alertMessage:
                        'We will be performing scheduled maintenance on our servers this Sunday from 2:00 AM to 4:00 AM EST. During this time, the platform may be temporarily unavailable.',
                    actionUrl: 'https://exxam.com/status',
                    actionText: 'Check Status',
                    timestamp: new Date().toISOString(),
                } as SystemAlertTemplateData;

            case EmailType.CUSTOM:
            default:
                return {
                    ...baseData,
                    title: 'Important Update',
                    message:
                        'This is a sample custom email message for testing purposes.',
                } as CustomTemplateData;
        }
    }

    /**
     * Test a specific template with sample data
     */
    async testTemplate(type: EmailType): Promise<{
        success: boolean;
        html?: string;
        text?: string;
        subject?: string;
        error?: string;
    }> {
        try {
            const sampleData = this.generateSampleData(type);
            const result = await this.emailTemplateService.renderByType(
                type,
                sampleData,
            );

            this.logger.log(`Template test successful for type: ${type}`);
            return {
                success: true,
                html: result.html,
                text: result.text,
                subject: result.subject,
            };
        } catch (error) {
            this.logger.error(`Template test failed for type: ${type}`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Test all templates
     */
    async testAllTemplates(): Promise<
        Record<
            EmailType,
            {
                success: boolean;
                html?: string;
                text?: string;
                subject?: string;
                error?: string;
            }
        >
    > {
        const results: Record<string, any> = {};
        const emailTypes = Object.values(EmailType);

        for (const type of emailTypes) {
            results[type] = await this.testTemplate(type);
        }

        return results as Record<EmailType, any>;
    }

    /**
     * Validate template data against template requirements
     */
    validateTemplateData(
        type: EmailType,
        data: TemplateData,
    ): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const result = this.emailTemplateService.validateTemplateData(
            type,
            data,
        );
        return {
            isValid: result.isValid,
            errors: result.errors,
            warnings: result.warnings || [],
        };
    }

    /**
     * Generate test report for all templates
     */
    async generateTestReport(): Promise<{
        summary: {
            total: number;
            passed: number;
            failed: number;
        };
        details: Record<
            EmailType,
            {
                status: 'passed' | 'failed';
                error?: string;
            }
        >;
    }> {
        const testResults = await this.testAllTemplates();

        let passed = 0;
        let failed = 0;
        const details: Record<string, any> = {};

        Object.entries(testResults).forEach(([type, result]) => {
            if (result.success) {
                passed++;
                details[type] = { status: 'passed' };
            } else {
                failed++;
                details[type] = { status: 'failed', error: result.error };
            }
        });

        return {
            summary: {
                total: Object.keys(testResults).length,
                passed,
                failed,
            },
            details: details as Record<EmailType, any>,
        };
    }

    /**
     * Validate all template configurations
     */
    validateAllTemplateConfigs(): {
        isValid: boolean;
        errors: string[];
        templateStatus: Record<string, boolean>;
    } {
        const configs = this.emailTemplateService.getAllTemplateConfigs();
        const errors: string[] = [];
        const templateStatus: Record<string, boolean> = {};

        configs.forEach(config => {
            try {
                // Basic validation
                if (!config.name) {
                    errors.push(`Template missing name: ${config.type}`);
                    templateStatus[config.type] = false;
                    return;
                }

                if (!config.htmlFile) {
                    errors.push(`Template missing HTML file: ${config.type}`);
                    templateStatus[config.type] = false;
                    return;
                }

                if (
                    !config.metadata.requiredData ||
                    config.metadata.requiredData.length === 0
                ) {
                    errors.push(
                        `Template missing required data specification: ${config.type}`,
                    );
                    templateStatus[config.type] = false;
                    return;
                }

                templateStatus[config.type] = true;
            } catch (error) {
                errors.push(
                    `Template validation error for ${config.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                );
                templateStatus[config.type] = false;
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            templateStatus,
        };
    }

    /**
     * Get template preview data for development/testing
     */
    getTemplatePreviewData(): Record<EmailType, TemplateData> {
        const previewData: Record<string, any> = {};
        const emailTypes = Object.values(EmailType);

        emailTypes.forEach(type => {
            previewData[type] = this.generateSampleData(type);
        });

        return previewData as Record<EmailType, TemplateData>;
    }
}
