# 📧 Communications Management Module

## Overview

The Communications Management Module is the messaging and notification engine of the trainpro platform, providing comprehensive email management, automated notifications, template systems, and communication analytics. This module handles email delivery, notification workflows, template management, event-driven communications, and detailed messaging insights with enterprise-grade features for educational institutions and corporate training programs.

## 🏗️ Architecture

```
communications/
├── communications.controller.ts    # REST API endpoints for communication operations
├── communications.service.ts      # Core business logic and communication orchestration
├── communications.module.ts       # Module configuration & dependencies
├── entities/                     # Database entities
│   └── communication.entity.ts   # Communication entity with relationships
├── dto/                         # Data Transfer Objects
│   ├── send-email.dto.ts        # Email sending validation
│   ├── create-template.dto.ts   # Template creation validation
│   └── notification.dto.ts      # Notification management
├── interfaces/                  # TypeScript interfaces
│   ├── email-provider.interface.ts     # Email service abstraction
│   ├── template.interface.ts           # Template data structures
│   └── notification.interface.ts       # Notification configurations
├── services/                    # Service components
│   ├── email-template.service.ts       # Template management
│   ├── email-queue.service.ts          # Queue and delivery management
│   ├── notification.service.ts         # Notification orchestration
│   └── email-analytics.service.ts      # Email performance tracking
├── listeners/                   # Event listeners
│   ├── user-events.listener.ts         # User lifecycle events
│   ├── test-events.listener.ts         # Test completion events
│   └── course-events.listener.ts       # Course enrollment events
└── communications.controller.spec.ts    # API endpoint tests
└── communications.service.spec.ts       # Service layer tests
```

## 🎯 Core Features

### Email Management

- **Multi-Provider Support** with fallback capabilities (SendGrid, Mailgun, AWS SES)
- **Template Engine** with Handlebars and MJML for responsive emails
- **Queue Management** with priority handling and retry mechanisms
- **Delivery Tracking** with open rates, click tracking, and bounce handling
- **Bulk Email Operations** with rate limiting and batch processing

### Notification System

- **Event-Driven Notifications** triggered by platform activities
- **Multi-Channel Delivery** supporting email, SMS, and push notifications
- **User Preferences** with granular notification control
- **Notification Scheduling** for delayed and recurring messages
- **Template Personalization** with dynamic content and variables

### Template Management

- **Rich Template Editor** with WYSIWYG and code editing capabilities
- **Version Control** for template revisions and rollback
- **A/B Testing** for email performance optimization
- **Multi-Language Support** with localization capabilities
- **Brand Customization** with organization-specific styling

### Analytics & Insights

- **Delivery Analytics** with comprehensive performance metrics
- **Engagement Tracking** including opens, clicks, and conversions
- **Campaign Performance** with ROI and effectiveness analysis
- **User Behavior Analysis** for communication optimization
- **Real-time Monitoring** with alerts and performance dashboards

## 📊 Database Schema

### Communication Entity

```typescript
@Entity('communications')
export class Communication {
    @PrimaryGeneratedColumn('uuid')
    communicationId: string;

    @Column({
        type: 'enum',
        enum: CommunicationType,
        default: CommunicationType.EMAIL,
    })
    type: CommunicationType;

    @Column({
        type: 'enum',
        enum: EmailType,
    })
    emailType: EmailType;

    @Column()
    @Index()
    recipientEmail: string;

    @Column()
    @Index()
    recipientUserId: string;

    @Column()
    subject: string;

    @Column('text')
    content: string;

    @Column('text', { nullable: true })
    htmlContent?: string;

    @Column({
        type: 'enum',
        enum: CommunicationStatus,
        default: CommunicationStatus.QUEUED,
    })
    status: CommunicationStatus;

    @Column({ nullable: true })
    templateId?: string;

    @Column({ type: 'json', nullable: true })
    templateData?: any;

    @Column({ nullable: true })
    scheduledAt?: Date;

    @Column({ nullable: true })
    sentAt?: Date;

    @Column({ nullable: true })
    deliveredAt?: Date;

    @Column({ nullable: true })
    openedAt?: Date;

    @Column({ nullable: true })
    clickedAt?: Date;

    @Column({ default: 0 })
    retryCount: number;

    @Column({ default: 3 })
    maxRetries: number;

    @Column({ nullable: true })
    errorMessage?: string;

    @Column({ type: 'json', nullable: true })
    metadata?: any;

    @Column({ nullable: true })
    provider?: string;

    @Column({ nullable: true })
    providerMessageId?: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @ManyToOne(() => Organization)
    orgId: Organization;

    @ManyToOne(() => Branch)
    branchId?: Branch;

    // Relationships
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    recipient: User;
}
```

### Communication Types & Enums

```typescript
export enum CommunicationType {
    EMAIL = 'email',
    SMS = 'sms',
    PUSH = 'push',
    IN_APP = 'in_app',
}

export enum EmailType {
    WELCOME = 'welcome',
    PASSWORD_RESET = 'password_reset',
    EMAIL_VERIFICATION = 'email_verification',
    TEST_COMPLETED = 'test_completed',
    COURSE_ENROLLMENT = 'course_enrollment',
    COURSE_COMPLETION = 'course_completion',
    GRADE_PUBLISHED = 'grade_published',
    INVITATION = 'invitation',
    REMINDER = 'reminder',
    NOTIFICATION = 'notification',
    MARKETING = 'marketing',
}

export enum CommunicationStatus {
    QUEUED = 'queued',
    PROCESSING = 'processing',
    SENT = 'sent',
    DELIVERED = 'delivered',
    OPENED = 'opened',
    CLICKED = 'clicked',
    BOUNCED = 'bounced',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}
```

## 📚 API Endpoints

### Email Management

#### `POST /communications/send-email` 🔒 Protected

**Send Individual Email**

```typescript
// Request
{
  "recipientEmail": "student@example.com",
  "emailType": "test_completed",
  "templateId": "test-completion-template",
  "templateData": {
    "studentName": "John Doe",
    "testTitle": "JavaScript Fundamentals Quiz",
    "score": 85.5,
    "percentage": 85.5,
    "grade": "B+",
    "testDate": "2024-01-15T12:00:00Z",
    "courseName": "Web Development Bootcamp",
    "instructorName": "Dr. Jane Smith"
  },
  "priority": "normal",
  "scheduledAt": null
}

// Response
{
  "success": true,
  "data": {
    "communication": {
      "communicationId": "comm-uuid",
      "type": "email",
      "emailType": "test_completed",
      "recipientEmail": "student@example.com",
      "subject": "Test Results: JavaScript Fundamentals Quiz",
      "status": "queued",
      "templateId": "test-completion-template",
      "scheduledAt": null,
      "createdAt": "2024-01-15T14:30:00Z",
      "estimatedDelivery": "2024-01-15T14:32:00Z"
    }
  },
  "message": "Email queued for delivery"
}
```

#### `POST /communications/send-bulk` 🔒 Admin/Instructor

**Send Bulk Emails**

```typescript
// Request
{
  "recipients": [
    {
      "email": "student1@example.com",
      "userId": "user-uuid-1",
      "templateData": {
        "studentName": "John Doe",
        "score": 85.5
      }
    },
    {
      "email": "student2@example.com",
      "userId": "user-uuid-2",
      "templateData": {
        "studentName": "Jane Smith",
        "score": 92.0
      }
    }
  ],
  "emailType": "grade_published",
  "templateId": "grade-notification-template",
  "subject": "Your Test Results Are Now Available",
  "priority": "high",
  "scheduledAt": "2024-01-15T16:00:00Z"
}

// Response
{
  "success": true,
  "data": {
    "batchId": "batch-uuid",
    "totalRecipients": 2,
    "queuedCount": 2,
    "failedCount": 0,
    "estimatedCompletion": "2024-01-15T16:05:00Z",
    "communications": [
      {
        "communicationId": "comm-uuid-1",
        "recipientEmail": "student1@example.com",
        "status": "queued"
      },
      {
        "communicationId": "comm-uuid-2",
        "recipientEmail": "student2@example.com",
        "status": "queued"
      }
    ]
  },
  "message": "2 emails queued for bulk delivery"
}
```

#### `GET /communications/:communicationId` 🔒 Protected

**Get Communication Details**

```typescript
// Response
{
  "success": true,
  "data": {
    "communication": {
      "communicationId": "comm-uuid",
      "type": "email",
      "emailType": "test_completed",
      "recipientEmail": "student@example.com",
      "recipientUserId": "user-uuid",
      "subject": "Test Results: JavaScript Fundamentals Quiz",
      "content": "Dear John Doe, your test results are ready...",
      "htmlContent": "<html><body><h1>Test Results</h1>...</body></html>",
      "status": "delivered",
      "templateId": "test-completion-template",
      "sentAt": "2024-01-15T14:32:15Z",
      "deliveredAt": "2024-01-15T14:32:18Z",
      "openedAt": "2024-01-15T15:45:22Z",
      "clickedAt": null,
      "retryCount": 0,
      "provider": "sendgrid",
      "providerMessageId": "sg_message_12345",
      "createdAt": "2024-01-15T14:30:00Z"
    },
    "analytics": {
      "deliveryTime": "3 seconds",
      "timeToOpen": "1h 13m",
      "isOpened": true,
      "isClicked": false,
      "deviceType": "desktop",
      "userAgent": "Mozilla/5.0..."
    }
  }
}
```

### Template Management

#### `POST /communications/templates` 🔒 Admin/Instructor

**Create Email Template**

```typescript
// Request
{
  "name": "Course Completion Certificate",
  "description": "Template for course completion notifications with certificate",
  "emailType": "course_completion",
  "subject": "Congratulations! You've completed {{courseName}}",
  "htmlContent": "<!DOCTYPE html>...",
  "textContent": "Congratulations {{studentName}}! You have successfully completed...",
  "variables": [
    {
      "name": "studentName",
      "type": "string",
      "required": true,
      "description": "Student's full name"
    },
    {
      "name": "courseName",
      "type": "string",
      "required": true,
      "description": "Name of the completed course"
    },
    {
      "name": "completionDate",
      "type": "date",
      "required": true,
      "description": "Date of course completion"
    },
    {
      "name": "certificateUrl",
      "type": "url",
      "required": false,
      "description": "Link to downloadable certificate"
    }
  ],
  "isActive": true
}

// Response
{
  "success": true,
  "data": {
    "template": {
      "templateId": "template-uuid",
      "name": "Course Completion Certificate",
      "description": "Template for course completion notifications with certificate",
      "emailType": "course_completion",
      "subject": "Congratulations! You've completed {{courseName}}",
      "variables": [ /* Variable definitions */ ],
      "isActive": true,
      "version": 1,
      "createdAt": "2024-01-15T10:00:00Z",
      "previewUrl": "https://trainpro.com/templates/preview/template-uuid"
    }
  },
  "message": "Email template created successfully"
}
```

#### `GET /communications/templates` 🔒 Admin/Instructor

**List Email Templates**

```typescript
// Query Parameters
?page=1&limit=20&emailType=course_completion&isActive=true&search=certificate

// Response
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "template-uuid",
        "name": "Course Completion Certificate",
        "description": "Template for course completion notifications",
        "emailType": "course_completion",
        "subject": "Congratulations! You've completed {{courseName}}",
        "isActive": true,
        "version": 1,
        "usageCount": 145,
        "lastUsed": "2024-01-15T12:30:00Z",
        "createdAt": "2024-01-10T09:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalTemplates": 28,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalTemplates": 28,
      "activeTemplates": 25,
      "draftTemplates": 3,
      "totalUsage": 2567
    }
  }
}
```

### Analytics & Reporting

#### `GET /communications/analytics/overview` 🔒 Admin/Instructor

**Communication Analytics Overview**

```typescript
// Query Parameters
?timeframe=30days&emailType=all&includeClickTracking=true

// Response
{
  "success": true,
  "data": {
    "overview": {
      "totalSent": 12567,
      "deliveryRate": 98.7,
      "openRate": 45.2,
      "clickRate": 12.8,
      "bounceRate": 1.3,
      "unsubscribeRate": 0.2
    },
    "emailTypeBreakdown": [
      {
        "emailType": "test_completed",
        "sent": 4256,
        "delivered": 4198,
        "opened": 2134,
        "clicked": 567,
        "deliveryRate": 98.6,
        "openRate": 50.8,
        "clickRate": 13.5
      },
      {
        "emailType": "course_enrollment",
        "sent": 2890,
        "delivered": 2856,
        "opened": 1245,
        "clicked": 289,
        "deliveryRate": 98.8,
        "openRate": 43.6,
        "clickRate": 10.0
      }
    ],
    "temporalAnalysis": {
      "dailyStats": [
        {
          "date": "2024-01-10",
          "sent": 456,
          "delivered": 449,
          "opened": 203,
          "clicked": 56
        },
        {
          "date": "2024-01-11",
          "sent": 523,
          "delivered": 518,
          "opened": 234,
          "clicked": 67
        }
      ],
      "hourlyOptimal": {
        "bestSendTime": "10:00 AM",
        "bestOpenTime": "2:00 PM",
        "bestClickTime": "3:30 PM"
      }
    },
    "providerPerformance": [
      {
        "provider": "sendgrid",
        "sent": 8432,
        "deliveryRate": 99.1,
        "avgDeliveryTime": "2.3 seconds"
      },
      {
        "provider": "mailgun",
        "sent": 4135,
        "deliveryRate": 98.2,
        "avgDeliveryTime": "3.1 seconds"
      }
    ]
  }
}
```

#### `GET /communications/analytics/campaign/:campaignId` 🔒 Admin/Instructor

**Campaign Performance Analytics**

```typescript
// Response
{
  "success": true,
  "data": {
    "campaign": {
      "campaignId": "campaign-uuid",
      "name": "Final Exam Results Notification",
      "emailType": "grade_published",
      "templateId": "grade-notification-template",
      "sentAt": "2024-01-15T16:00:00Z",
      "totalRecipients": 345
    },
    "performance": {
      "sent": 345,
      "delivered": 342,
      "bounced": 3,
      "opened": 156,
      "clicked": 43,
      "unsubscribed": 1,
      "deliveryRate": 99.1,
      "openRate": 45.6,
      "clickRate": 12.6,
      "unsubscribeRate": 0.3
    },
    "timeline": {
      "deliveryComplete": "2024-01-15T16:05:23Z",
      "firstOpen": "2024-01-15T16:02:45Z",
      "firstClick": "2024-01-15T16:08:12Z",
      "peakActivity": "2024-01-15T17:30:00Z"
    },
    "engagement": {
      "avgTimeToOpen": "2h 15m",
      "avgTimeToClick": "3h 42m",
      "topClickedLinks": [
        {
          "url": "https://trainpro.com/results/view",
          "clicks": 28,
          "percentage": 65.1
        },
        {
          "url": "https://trainpro.com/courses/retake",
          "clicks": 15,
          "percentage": 34.9
        }
      ]
    },
    "recipientAnalysis": {
      "byRole": [
        { "role": "student", "count": 298, "openRate": 47.3 },
        { "role": "instructor", "count": 47, "openRate": 38.3 }
      ],
      "byDevice": [
        { "device": "mobile", "count": 87, "percentage": 55.8 },
        { "device": "desktop", "count": 69, "percentage": 44.2 }
      ]
    }
  }
}
```

### Notification Management

#### `POST /communications/notifications/send` 🔒 Admin/Instructor

**Send System Notification**

```typescript
// Request
{
  "type": "system_announcement",
  "title": "Scheduled Maintenance Notice",
  "message": "The system will be undergoing scheduled maintenance on January 20th from 2:00 AM to 4:00 AM EST.",
  "recipients": {
    "type": "all_users",
    "filters": {
      "organizationId": 1,
      "roles": ["student", "instructor", "admin"],
      "isActive": true
    }
  },
  "channels": ["email", "in_app"],
  "priority": "high",
  "scheduledAt": "2024-01-18T10:00:00Z",
  "expiresAt": "2024-01-21T00:00:00Z"
}

// Response
{
  "success": true,
  "data": {
    "notification": {
      "notificationId": "notification-uuid",
      "type": "system_announcement",
      "title": "Scheduled Maintenance Notice",
      "status": "scheduled",
      "estimatedRecipients": 2485,
      "channels": ["email", "in_app"],
      "scheduledAt": "2024-01-18T10:00:00Z",
      "createdAt": "2024-01-15T14:30:00Z"
    }
  },
  "message": "System notification scheduled successfully"
}
```

### Communication Settings

#### `GET /communications/settings` 🔒 Admin

**Get Communication Settings**

```typescript
// Response
{
  "success": true,
  "data": {
    "emailSettings": {
      "primaryProvider": "sendgrid",
      "fallbackProvider": "mailgun",
      "senderName": "TrainPro Platform",
      "senderEmail": "noreply@trainpro.com",
      "replyToEmail": "support@trainpro.com",
      "rateLimits": {
        "perMinute": 100,
        "perHour": 5000,
        "perDay": 50000
      }
    },
    "notificationDefaults": {
      "testCompleted": {
        "enabled": true,
        "template": "test-completion-template",
        "delay": 0
      },
      "courseEnrollment": {
        "enabled": true,
        "template": "enrollment-welcome-template",
        "delay": 300
      },
      "gradePublished": {
        "enabled": true,
        "template": "grade-notification-template",
        "delay": 0
      }
    },
    "userPreferences": {
      "allowOptOut": true,
      "defaultOptIn": true,
      "categories": [
        "academic_updates",
        "administrative_notices",
        "marketing_communications"
      ]
    }
  }
}
```

## 🔧 Service Layer

### CommunicationsService Core Methods

#### Email Operations

```typescript
// Send individual email
async sendEmail(emailData: SendEmailDto, scope: OrgBranchScope): Promise<Communication>

// Send bulk emails
async sendBulkEmails(bulkEmailData: BulkEmailDto, scope: OrgBranchScope): Promise<BulkEmailResult>

// Schedule email
async scheduleEmail(emailData: ScheduleEmailDto, scope: OrgBranchScope): Promise<Communication>

// Cancel scheduled email
async cancelScheduledEmail(communicationId: string): Promise<void>

// Resend failed email
async resendEmail(communicationId: string): Promise<Communication>
```

#### Template Management

```typescript
// Create template
async createTemplate(templateData: CreateTemplateDto, scope: OrgBranchScope): Promise<EmailTemplate>

// Update template
async updateTemplate(templateId: string, updateData: UpdateTemplateDto): Promise<EmailTemplate>

// Get template by ID
async getTemplate(templateId: string): Promise<EmailTemplate>

// List templates
async listTemplates(filters: TemplateFilterDto, scope: OrgBranchScope): Promise<EmailTemplate[]>

// Render template
async renderTemplate(templateId: string, data: any): Promise<RenderedTemplate>
```

#### Analytics & Tracking

```typescript
// Get communication analytics
async getCommunicationAnalytics(filters: AnalyticsFilterDto, scope: OrgBranchScope): Promise<CommunicationAnalytics>

// Track email open
async trackEmailOpen(communicationId: string, trackingData: TrackingData): Promise<void>

// Track email click
async trackEmailClick(communicationId: string, clickData: ClickData): Promise<void>

// Get delivery status
async getDeliveryStatus(communicationId: string): Promise<DeliveryStatus>
```

#### Event-Driven Communications

```typescript
// Handle user registration
async handleUserRegistration(userId: string, userData: UserData): Promise<void>

// Handle test completion
async handleTestCompletion(attemptId: string, resultData: ResultData): Promise<void>

// Handle course enrollment
async handleCourseEnrollment(enrollmentData: EnrollmentData): Promise<void>

// Handle grade publication
async handleGradePublication(resultId: string, gradeData: GradeData): Promise<void>
```

## 🔄 Integration Points

### User Module Integration

```typescript
// Send welcome email to new users
async sendWelcomeEmail(userId: string, userData: UserData): Promise<void>

// Send password reset email
async sendPasswordResetEmail(userId: string, resetToken: string): Promise<void>

// Send email verification
async sendEmailVerification(userId: string, verificationToken: string): Promise<void>

// Handle user role changes
async notifyRoleChange(userId: string, oldRole: string, newRole: string): Promise<void>
```

### Test & Results Integration

```typescript
// Notify test completion
async notifyTestCompletion(attemptId: string, resultData: TestResult): Promise<void>

// Send grade notifications
async sendGradeNotification(resultId: string, gradeData: GradeData): Promise<void>

// Send result summaries
async sendResultSummary(userId: string, resultSummary: ResultSummary): Promise<void>
```

### Course Integration

```typescript
// Send enrollment confirmations
async sendEnrollmentConfirmation(enrollmentData: EnrollmentData): Promise<void>

// Notify course completion
async notifyCourseCompletion(completionData: CompletionData): Promise<void>

// Send course reminders
async sendCourseReminders(courseId: number, reminderType: string): Promise<void>
```

## 🔒 Access Control & Permissions

### Communication Permissions

```typescript
export enum CommunicationPermission {
    SEND_EMAIL = 'comm:send_email',
    SEND_BULK = 'comm:send_bulk',
    MANAGE_TEMPLATES = 'comm:manage_templates',
    VIEW_ANALYTICS = 'comm:view_analytics',
    MANAGE_SETTINGS = 'comm:manage_settings',
    SEND_NOTIFICATIONS = 'comm:send_notifications',
}
```

## 🔮 Future Enhancements

### Planned Features

1. **Advanced Personalization**: AI-powered content personalization
2. **Multi-Channel Integration**: SMS, push notifications, and chat platforms
3. **Advanced Analytics**: Predictive email performance modeling
4. **Template Marketplace**: Shared template library and marketplace
5. **Automation Workflows**: Complex triggered email sequences

### Scalability Improvements

- **Microservices Architecture**: Distributed communication processing
- **Advanced Queue Management**: Multi-tier queue with priority routing
- **Real-time Analytics**: Live communication performance dashboards
- **Global Delivery**: Multi-region email delivery optimization

---

This Communications module provides comprehensive messaging capabilities with enterprise-grade features including automated workflows, advanced analytics, template management, and optimization tools for effective educational communication.
