import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { SentMessageInfo } from 'nodemailer/lib/smtp-transport';

export interface EmailSendOptions {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
}

export interface EmailSendResult {
    success: boolean;
    messageId?: string;
    error?: string;
    retryCount?: number;
    sentAt?: Date;
}

@Injectable()
export class EmailSMTPService {
    private readonly logger = new Logger(EmailSMTPService.name);
    private transporter: Transporter;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000; // 1 second base delay

    constructor(private configService: ConfigService) {
        this.initializeTransporter();
    }

    private initializeTransporter(): void {
        const port = this.configService.get<number>('SMTP_PORT', 587);
        const isSecurePort = port === 465;

        const smtpConfig: any = {
            host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
            port: port,
            secure: isSecurePort, // true for 465, false for other ports like 587
            auth: {
                user: this.configService.get<string>('SMTP_USER'),
                pass:
                    this.configService.get<string>('SMTP_PASSWORD') ||
                    this.configService.get<string>('SMTP_PASS'),
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
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2',
            },
        };

        // Add rate limiting if configured
        const rateLimit = this.configService.get<number>('SMTP_RATE_LIMIT');
        if (rateLimit) {
            smtpConfig.rateLimit = rateLimit;
            smtpConfig.rateDelta = this.configService.get<number>(
                'SMTP_RATE_DELTA',
                1000,
            );
        }

        // Add debug logging if enabled
        if (this.configService.get<boolean>('SMTP_DEBUG', false)) {
            smtpConfig.debug = true;
            smtpConfig.logger = true;
        }

        this.transporter = nodemailer.createTransport(smtpConfig);

        // Verify connection configuration
        this.verifyConnection();
    }

    private async verifyConnection(): Promise<void> {
        try {
            await this.transporter.verify();
            this.logger.log('✅ SMTP');
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            this.logger.error('SMTP connection verification failed:', error);
            throw new Error(`SMTP configuration error: ${errorMessage}`);
        }
    }

    async sendEmail(
        options: EmailSendOptions,
        retryCount = 0,
        senderInfo?: { email: string; name: string },
    ): Promise<EmailSendResult> {
        const startTime = Date.now();

        try {
            // Use organization sender info if provided, otherwise use default config
            let fromString: string;
            if (senderInfo) {
                fromString = `"${senderInfo.name}" <${senderInfo.email}>`;
            } else {
                const fromEmail =
                    this.configService.get<string>('EMAIL_FROM_ADDRESS') ||
                    this.configService.get<string>('SMTP_FROM') ||
                    this.configService.get<string>('SMTP_USER') ||
                    '';

                const fromName = this.configService.get<string>(
                    'EMAIL_FROM_NAME',
                    'trainpro Platform',
                );
                fromString = fromName
                    ? `"${fromName}" <${fromEmail}>`
                    : fromEmail;
            }

            const mailOptions = {
                from: fromString,
                to: Array.isArray(options.to)
                    ? options.to.join(', ')
                    : options.to,
                cc: options.cc
                    ? Array.isArray(options.cc)
                        ? options.cc.join(', ')
                        : options.cc
                    : undefined,
                bcc: options.bcc
                    ? Array.isArray(options.bcc)
                        ? options.bcc.join(', ')
                        : options.bcc
                    : undefined,
                subject: options.subject,
                text: options.text,
                html: options.html,
                attachments: options.attachments,
            };

            const result = (await this.transporter.sendMail(
                mailOptions,
            )) as SentMessageInfo;

            const duration = Date.now() - startTime;
            this.logger.log(
                `Email sent successfully in ${duration}ms - MessageID: ${result.messageId}`,
            );

            return {
                success: true,
                messageId: result.messageId,
                retryCount,
                sentAt: new Date(),
            };
        } catch (error: unknown) {
            const duration = Date.now() - startTime;
            const errorMessage = this.getErrorMessage(error);
            this.logger.error(
                `Email send failed after ${duration}ms (attempt ${retryCount + 1}/${this.maxRetries + 1}):`,
                error,
            );

            // Check if we should retry
            if (retryCount < this.maxRetries && this.shouldRetry(error)) {
                const delay = this.calculateRetryDelay(retryCount);
                this.logger.log(`Retrying email send in ${delay}ms...`);

                await this.delay(delay);
                return this.sendEmail(options, retryCount + 1);
            }

            return {
                success: false,
                error: errorMessage,
                retryCount,
            };
        }
    }

    async sendBulkEmails(
        emails: EmailSendOptions[],
    ): Promise<EmailSendResult[]> {
        this.logger.log(`Starting bulk email send for ${emails.length} emails`);

        const results: EmailSendResult[] = [];
        const batchSize = 10; // Process in batches to avoid overwhelming the SMTP server

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            const batchPromises = batch.map(email => this.sendEmail(email));

            const batchResults = await Promise.allSettled(batchPromises);

            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                } else {
                    const errorMessage = this.getErrorMessage(result.reason);
                    results.push({
                        success: false,
                        error: errorMessage,
                        retryCount: 0,
                    });
                }
            });

            // Add delay between batches to respect rate limits
            if (i + batchSize < emails.length) {
                await this.delay(100);
            }
        }

        const successCount = results.filter(r => r.success).length;
        this.logger.log(
            `Bulk email send completed: ${successCount}/${emails.length} successful`,
        );

        return results;
    }

    async testConnection(): Promise<{ connected: boolean; error?: string }> {
        try {
            await this.transporter.verify();
            return { connected: true };
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            this.logger.error('SMTP connection test failed:', error);
            return {
                connected: false,
                error: errorMessage,
            };
        }
    }

    getConnectionInfo(): {
        host: string;
        port: number;
        secure: boolean;
        poolSize: number;
        authenticated: boolean;
    } {
        const options = this.transporter.options as {
            host?: string;
            port?: number;
            secure?: boolean;
            maxConnections?: number;
            auth?: { user?: string };
        };

        return {
            host: options.host ?? 'unknown',
            port: options.port ?? 0,
            secure: options.secure ?? false,
            poolSize: options.maxConnections ?? 1,
            authenticated: !!options.auth?.user,
        };
    }

    private shouldRetry(error: unknown): boolean {
        // Retry on temporary failures, but not on authentication or permanent errors
        const retryableErrors = [
            'ETIMEDOUT',
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'EMFILE',
        ];

        const errorCode = this.getErrorCode(error);
        const errorMessage = this.getErrorMessage(error).toLowerCase();

        // Don't retry on authentication errors
        if (
            errorMessage.includes('authentication') ||
            errorMessage.includes('invalid login')
        ) {
            return false;
        }

        // Don't retry on invalid recipient errors
        if (
            errorMessage.includes('recipient') ||
            errorMessage.includes('invalid')
        ) {
            return false;
        }

        return (
            retryableErrors.includes(errorCode) ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('connection')
        );
    }

    private calculateRetryDelay(retryCount: number): number {
        // Exponential backoff: 1s, 2s, 4s
        return this.retryDelay * Math.pow(2, retryCount);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error && typeof error === 'object' && 'message' in error) {
            return String((error as { message: unknown }).message);
        }
        return 'Unknown error';
    }

    private getErrorCode(error: unknown): string {
        if (error && typeof error === 'object') {
            const errorObj = error as { code?: string; errno?: string };
            return errorObj.code || errorObj.errno || '';
        }
        return '';
    }

    close(): void {
        if (this.transporter) {
            this.transporter.close();
            this.logger.log('SMTP transporter closed');
        }
    }
}
