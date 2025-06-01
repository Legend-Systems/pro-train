import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    EmailSMTPService,
    EmailSendOptions,
    EmailSendResult,
} from './email-smtp.service';

export interface EmailJobData {
    id: string;
    emailOptions: EmailSendOptions;
    priority?: number;
    templateType?: string;
    userId?: string;
    organizationId?: string;
    metadata?: Record<string, any>;
    attempts?: number;
    maxAttempts?: number;
    createdAt: Date;
    scheduledFor?: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
}

export interface BulkEmailJobData {
    id: string;
    emails: EmailSendOptions[];
    priority?: number;
    batchSize?: number;
    metadata?: Record<string, any>;
    attempts?: number;
    maxAttempts?: number;
    createdAt: Date;
    scheduledFor?: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';
    progress?: number;
}

export enum EmailJobPriority {
    CRITICAL = 1, // System alerts, password resets
    HIGH = 2, // Welcome emails, urgent notifications
    NORMAL = 3, // Regular notifications
    LOW = 4, // Marketing emails, newsletters
    BULK = 5, // Mass communications
}

@Injectable()
export class EmailQueueService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EmailQueueService.name);
    private emailQueue: EmailJobData[] = [];
    private bulkEmailQueue: BulkEmailJobData[] = [];
    private processing = false;
    private processingInterval: NodeJS.Timeout | null = null;
    private readonly concurrency = 5;
    private readonly rateLimitPerSecond = 10;
    private readonly bulkConcurrency = 2;
    private lastProcessedTime = 0;

    constructor(
        private configService: ConfigService,
        private emailSMTPService: EmailSMTPService,
    ) {}

    onModuleInit(): void {
        this.initializeQueues();
        this.startProcessing();
    }

    onModuleDestroy() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
        this.logger.log('Email queue service destroyed');
    }

    private initializeQueues() {
        this.emailQueue = [];
        this.bulkEmailQueue = [];
        this.logger.log('Email queues initialized successfully');
    }

    private startProcessing() {
        // Process queues every second
        this.processingInterval = setInterval(() => {
            if (!this.processing) {
                this.processing = true;
                this.processQueues()
                    .catch(error => {
                        this.logger.error('Error processing queues:', error);
                    })
                    .finally(() => {
                        this.processing = false;
                    });
            }
        }, 1000);

        this.logger.log('Email workers initialized successfully');
    }

    private async processQueues() {
        const now = Date.now();

        // Rate limiting: ensure we don't exceed rate limits
        if (now - this.lastProcessedTime < 100) {
            return;
        }

        // Process regular email queue
        await this.processEmailQueue();

        // Process bulk email queue
        await this.processBulkEmailQueue();

        this.lastProcessedTime = now;
    }

    private async processEmailQueue() {
        const now = new Date();
        const readyJobs = this.emailQueue
            .filter(
                job =>
                    job.status === 'pending' &&
                    (!job.scheduledFor || job.scheduledFor <= now),
            )
            .sort((a, b) => (a.priority || 3) - (b.priority || 3))
            .slice(0, this.concurrency);

        for (const job of readyJobs) {
            try {
                job.status = 'processing';
                this.logger.log(`Processing email job ${job.id}...`);

                const result = await this.emailSMTPService.sendEmail(
                    job.emailOptions,
                );

                if (result.success) {
                    job.status = 'completed';
                    this.logger.log(
                        `Email job ${job.id} completed successfully`,
                    );
                    // Remove completed jobs after a delay
                    setTimeout(() => this.removeCompletedJob(job.id), 5000);
                } else {
                    this.handleJobFailure(job, result.error || 'Unknown error');
                }
            } catch (error) {
                this.handleJobFailure(job, error?.message || 'Unknown error');
            }
        }
    }

    private async processBulkEmailQueue() {
        const now = new Date();
        const readyJobs = this.bulkEmailQueue
            .filter(
                job =>
                    job.status === 'pending' &&
                    (!job.scheduledFor || job.scheduledFor <= now),
            )
            .sort((a, b) => (a.priority || 5) - (b.priority || 5))
            .slice(0, this.bulkConcurrency);

        for (const job of readyJobs) {
            try {
                job.status = 'processing';
                job.progress = 0;
                this.logger.log(
                    `Processing bulk email job ${job.id} with ${job.emails.length} emails...`,
                );

                const results = await this.processBulkEmailJobData(job);

                const successCount = results.filter(r => r.success).length;
                const failureCount = results.length - successCount;

                job.status = 'completed';
                job.progress = 100;
                this.logger.log(
                    `Bulk email job ${job.id} completed: ${successCount} successful, ${failureCount} failed`,
                );

                // Remove completed jobs after a delay
                setTimeout(() => this.removeBulkCompletedJob(job.id), 10000);
            } catch (error) {
                await this.handleBulkJobFailure(job, error.message);
            }
        }
    }

    private async processBulkEmailJobData(
        job: BulkEmailJobData,
    ): Promise<EmailSendResult[]> {
        const { emails, batchSize = 10 } = job;
        const results: EmailSendResult[] = [];

        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            const batchResults =
                await this.emailSMTPService.sendBulkEmails(batch);
            results.push(...batchResults);

            // Update job progress
            const progress = Math.round(
                ((i + batchSize) / emails.length) * 100,
            );
            job.progress = Math.min(progress, 100);

            // Brief pause between batches
            if (i + batchSize < emails.length) {
                await this.delay(100);
            }
        }

        return results;
    }

    private handleJobFailure(job: EmailJobData, error: string) {
        job.attempts = (job.attempts || 0) + 1;
        job.maxAttempts = job.maxAttempts || 3;

        if (job.attempts < job.maxAttempts) {
            job.status = 'retrying';
            // Exponential backoff: delay = 2^attempts seconds
            job.scheduledFor = new Date(
                Date.now() + Math.pow(2, job.attempts) * 1000,
            );
            this.logger.warn(
                `Email job ${job.id} failed, retrying in ${Math.pow(2, job.attempts)} seconds`,
            );
        } else {
            job.status = 'failed';
            this.logger.error(`Email job ${job.id} failed permanently:`, error);
            // Remove failed jobs after a longer delay
            setTimeout(() => this.removeCompletedJob(job.id), 30000);
        }
    }

    private async handleBulkJobFailure(job: BulkEmailJobData, error: string) {
        job.attempts = (job.attempts || 0) + 1;
        job.maxAttempts = job.maxAttempts || 2;

        if (job.attempts < job.maxAttempts) {
            job.status = 'retrying';
            job.scheduledFor = new Date(
                Date.now() + Math.pow(2, job.attempts) * 2000,
            );
            this.logger.warn(
                `Bulk email job ${job.id} failed, retrying in ${Math.pow(2, job.attempts) * 2} seconds`,
            );
        } else {
            job.status = 'failed';
            this.logger.error(
                `Bulk email job ${job.id} failed permanently:`,
                error,
            );
            setTimeout(() => this.removeBulkCompletedJob(job.id), 60000);
        }
    }

    async queueEmail(
        emailOptions: EmailSendOptions,
        priority: EmailJobPriority = EmailJobPriority.NORMAL,
        delay?: number,
        metadata?: Record<string, any>,
    ): Promise<string> {
        const jobId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const jobData: EmailJobData = {
            id: jobId,
            emailOptions,
            priority,
            metadata,
            attempts: 0,
            maxAttempts: 3,
            createdAt: new Date(),
            scheduledFor: delay ? new Date(Date.now() + delay) : undefined,
            status: 'pending',
        };

        this.emailQueue.push(jobData);

        this.logger.log(
            `Email queued with ID: ${jobId}, Priority: ${priority}`,
        );
        return jobId;
    }

    async queueBulkEmails(
        emails: EmailSendOptions[],
        priority: EmailJobPriority = EmailJobPriority.BULK,
        batchSize: number = 10,
        delay?: number,
        metadata?: Record<string, any>,
    ): Promise<string> {
        const jobId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const jobData: BulkEmailJobData = {
            id: jobId,
            emails,
            priority,
            batchSize,
            metadata,
            attempts: 0,
            maxAttempts: 2,
            createdAt: new Date(),
            scheduledFor: delay ? new Date(Date.now() + delay) : undefined,
            status: 'pending',
            progress: 0,
        };

        this.bulkEmailQueue.push(jobData);

        this.logger.log(
            `Bulk email job queued with ID: ${jobId}, ${emails.length} emails`,
        );
        return jobId;
    }

    async getJobStatus(
        jobId: string,
    ): Promise<EmailJobData | BulkEmailJobData | null> {
        const emailJob = this.emailQueue.find(job => job.id === jobId);
        if (emailJob) return emailJob;

        const bulkJob = this.bulkEmailQueue.find(job => job.id === jobId);
        return bulkJob || null;
    }

    async getQueueStats() {
        const emailStats = {
            pending: this.emailQueue.filter(job => job.status === 'pending')
                .length,
            processing: this.emailQueue.filter(
                job => job.status === 'processing',
            ).length,
            completed: this.emailQueue.filter(job => job.status === 'completed')
                .length,
            failed: this.emailQueue.filter(job => job.status === 'failed')
                .length,
            retrying: this.emailQueue.filter(job => job.status === 'retrying')
                .length,
        };

        const bulkEmailStats = {
            pending: this.bulkEmailQueue.filter(job => job.status === 'pending')
                .length,
            processing: this.bulkEmailQueue.filter(
                job => job.status === 'processing',
            ).length,
            completed: this.bulkEmailQueue.filter(
                job => job.status === 'completed',
            ).length,
            failed: this.bulkEmailQueue.filter(job => job.status === 'failed')
                .length,
            retrying: this.bulkEmailQueue.filter(
                job => job.status === 'retrying',
            ).length,
        };

        return {
            emailQueue: emailStats,
            bulkEmailQueue: bulkEmailStats,
            timestamp: new Date(),
        };
    }

    async pauseQueues(): Promise<void> {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        this.logger.log('Email queues paused');
    }

    async resumeQueues(): Promise<void> {
        if (!this.processingInterval) {
            await this.startProcessing();
        }
        this.logger.log('Email queues resumed');
    }

    async retryFailedJobs(limit: number = 10): Promise<number> {
        const failedEmailJobs = this.emailQueue
            .filter(job => job.status === 'failed')
            .slice(0, limit);

        const failedBulkJobs = this.bulkEmailQueue
            .filter(job => job.status === 'failed')
            .slice(0, limit - failedEmailJobs.length);

        let retriedCount = 0;

        for (const job of failedEmailJobs) {
            job.status = 'pending';
            job.attempts = 0;
            job.scheduledFor = undefined;
            retriedCount++;
        }

        for (const job of failedBulkJobs) {
            job.status = 'pending';
            job.attempts = 0;
            job.scheduledFor = undefined;
            job.progress = 0;
            retriedCount++;
        }

        this.logger.log(`Retried ${retriedCount} failed jobs`);
        return retriedCount;
    }

    async clearCompletedJobs(): Promise<number> {
        const emailCompleted = this.emailQueue.filter(
            job => job.status === 'completed',
        ).length;
        const bulkCompleted = this.bulkEmailQueue.filter(
            job => job.status === 'completed',
        ).length;

        this.emailQueue = this.emailQueue.filter(
            job => job.status !== 'completed',
        );
        this.bulkEmailQueue = this.bulkEmailQueue.filter(
            job => job.status !== 'completed',
        );

        const totalCleared = emailCompleted + bulkCompleted;
        this.logger.log(`Cleared ${totalCleared} completed jobs`);
        return totalCleared;
    }

    private removeCompletedJob(jobId: string): void {
        this.emailQueue = this.emailQueue.filter(job => job.id !== jobId);
    }

    private removeBulkCompletedJob(jobId: string): void {
        this.bulkEmailQueue = this.bulkEmailQueue.filter(
            job => job.id !== jobId,
        );
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
