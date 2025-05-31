import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailConfig } from '../interfaces/email-config.interface';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailConfigService {
    private readonly logger = new Logger(EmailConfigService.name);
    private config: EmailConfig;

    constructor(private readonly configService: ConfigService) {
        this.config = this.loadConfiguration();
        this.validateConfiguration();
    }

    private loadConfiguration(): EmailConfig {
        return {
            smtp: {
                host: this.configService.get<string>(
                    'SMTP_HOST',
                    'smtp.gmail.com',
                ),
                port: this.configService.get<number>('SMTP_PORT', 587),
                secure: this.configService.get<boolean>('SMTP_SECURE', false),
                auth: {
                    user: this.configService.get<string>('SMTP_USER') || '',
                    pass: this.configService.get<string>('SMTP_PASSWORD') || '',
                },
                pool: this.configService.get<boolean>('SMTP_POOL', true),
                maxConnections: this.configService.get<number>(
                    'SMTP_MAX_CONNECTIONS',
                    5,
                ),
                maxMessages: this.configService.get<number>(
                    'SMTP_MAX_MESSAGES',
                    100,
                ),
                rateDelta: this.configService.get<number>(
                    'SMTP_RATE_DELTA',
                    1000,
                ),
                rateLimit: this.configService.get<number>(
                    'SMTP_RATE_LIMIT',
                    14,
                ),
            },
            defaults: {
                from: {
                    name: this.configService.get<string>(
                        'EMAIL_FROM_NAME',
                        'Exxam Platform',
                    ),
                    address:
                        this.configService.get<string>('EMAIL_FROM_ADDRESS') ||
                        '',
                },
                replyTo: this.configService.get<string>('EMAIL_REPLY_TO'),
            },
            retries: {
                maxAttempts: this.configService.get<number>(
                    'EMAIL_MAX_RETRIES',
                    3,
                ),
                backoffFactor: this.configService.get<number>(
                    'EMAIL_BACKOFF_FACTOR',
                    2,
                ),
                initialDelay: this.configService.get<number>(
                    'EMAIL_INITIAL_DELAY',
                    1000,
                ),
                maxDelay: this.configService.get<number>(
                    'EMAIL_MAX_DELAY',
                    30000,
                ),
            },
            templates: {
                baseUrl: this.configService.get<string>(
                    'EMAIL_TEMPLATES_PATH',
                    './templates',
                ),
                defaultTemplate: this.configService.get<string>(
                    'EMAIL_DEFAULT_TEMPLATE',
                    'default',
                ),
            },
        };
    }

    private validateConfiguration(): void {
        const requiredFields = [
            'SMTP_USER',
            'SMTP_PASSWORD',
            'EMAIL_FROM_ADDRESS',
        ];

        const missingFields = requiredFields.filter(
            field => !this.configService.get(field),
        );

        if (missingFields.length > 0) {
            const error = `Missing required email configuration: ${missingFields.join(', ')}`;
            this.logger.error(error);
            throw new Error(error);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const fromAddress = this.config.defaults.from.address;

        if (!emailRegex.test(fromAddress)) {
            const error = `Invalid email format for EMAIL_FROM_ADDRESS: ${fromAddress}`;
            this.logger.error(error);
            throw new Error(error);
        }

        this.logger.log('Email configuration validation successful');
    }

    getConfig(): EmailConfig {
        return this.config;
    }

    getSMTPConfig(): EmailConfig['smtp'] {
        return this.config.smtp;
    }

    getDefaults(): EmailConfig['defaults'] {
        return this.config.defaults;
    }

    getRetryConfig(): EmailConfig['retries'] {
        return this.config.retries;
    }

    getTemplateConfig(): EmailConfig['templates'] {
        return this.config.templates;
    }

    async testConnection(): Promise<boolean> {
        try {
            const transporter = nodemailer.createTransport({
                host: this.config.smtp.host,
                port: this.config.smtp.port,
                secure: this.config.smtp.secure,
                auth: {
                    user: this.config.smtp.auth.user,
                    pass: this.config.smtp.auth.pass,
                },
            });

            await transporter.verify();
            this.logger.log('SMTP connection test successful');
            return true;
        } catch (error) {
            this.logger.error('SMTP connection test failed:', error.message);
            return false;
        }
    }

    getConnectionInfo(): object {
        return {
            host: this.config.smtp.host,
            port: this.config.smtp.port,
            secure: this.config.smtp.secure,
            user: this.config.smtp.auth.user,
            pool: this.config.smtp.pool,
            maxConnections: this.config.smtp.maxConnections,
            maxMessages: this.config.smtp.maxMessages,
            rateLimit: this.config.smtp.rateLimit,
        };
    }
}
