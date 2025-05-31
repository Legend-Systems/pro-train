export interface EmailConfig {
    smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
        pool: boolean;
        maxConnections: number;
        maxMessages: number;
        rateDelta: number;
        rateLimit: number;
    };
    defaults: {
        from: {
            name: string;
            address: string;
        };
        replyTo?: string;
    };
    retries: {
        maxAttempts: number;
        backoffFactor: number;
        initialDelay: number;
        maxDelay: number;
    };
    templates: {
        baseUrl: string;
        defaultTemplate: string;
    };
}

export interface EmailSendOptions {
    to: string | string[];
    from?: string;
    subject: string;
    html?: string;
    text?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
    priority?: 'high' | 'normal' | 'low';
    headers?: Record<string, string>;
}

export interface TemplateData {
    [key: string]: any;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
    response?: string;
} 