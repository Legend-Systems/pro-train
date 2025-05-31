import { EmailType } from '../entities/communication.entity';

export interface TemplateData {
    [key: string]: any;
}

// Base template data that all templates should include
export interface BaseTemplateData extends TemplateData {
    recipientName?: string;
    recipientEmail: string;
    companyName?: string;
    companyUrl?: string;
    unsubscribeUrl?: string;
    supportEmail?: string;
}

// Welcome email template data
export interface WelcomeTemplateData extends BaseTemplateData {
    loginUrl: string;
    dashboardUrl: string;
    profileUrl: string;
    activationToken?: string;
}

// Password reset template data
export interface PasswordResetTemplateData extends BaseTemplateData {
    resetUrl: string;
    resetToken: string;
    expiryTime: string;
    ipAddress?: string;
}

// Test notification template data
export interface TestNotificationTemplateData extends BaseTemplateData {
    testTitle: string;
    testDescription?: string;
    dueDate: string;
    testUrl: string;
    duration?: string;
    instructorName?: string;
}

// Results summary template data
export interface ResultsSummaryTemplateData extends BaseTemplateData {
    testTitle: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    percentage: number;
    completionTime: string;
    resultsUrl: string;
    feedback?: string;
}

// Course enrollment template data
export interface CourseEnrollmentTemplateData extends BaseTemplateData {
    courseName: string;
    courseDescription?: string;
    courseUrl: string;
    instructorName?: string;
    startDate?: string;
    endDate?: string;
}

// System alert template data
export interface SystemAlertTemplateData extends BaseTemplateData {
    alertType: 'info' | 'warning' | 'error' | 'success';
    alertTitle: string;
    alertMessage: string;
    actionUrl?: string;
    actionText?: string;
    timestamp: string;
}

// Custom template data (flexible)
export interface CustomTemplateData extends BaseTemplateData {
    title?: string;
    message?: string;
    [key: string]: any;
}

// Template metadata
export interface TemplateMetadata {
    name: string;
    type: EmailType;
    version: string;
    description?: string;
    requiredData: string[];
    optionalData?: string[];
    supportedLanguages?: string[];
}

// Template configuration
export interface TemplateConfig {
    name: string;
    type: EmailType;
    htmlFile: string;
    textFile?: string;
    metadata: TemplateMetadata;
    defaultData?: Partial<TemplateData>;
}

// Template rendering options
export interface TemplateRenderOptions {
    template: string;
    data: TemplateData;
    language?: string;
    format?: 'html' | 'text' | 'both';
}

// Template rendering result
export interface TemplateRenderResult {
    html?: string;
    text?: string;
    subject: string;
    metadata?: TemplateMetadata;
}

// Template validation result
export interface TemplateValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
    missingRequired?: string[];
}
