# Email Logging System Architecture

## Overview

The Exxam platform implements a comprehensive email logging and tracking system that monitors every email sent through the application. This system provides complete visibility into email delivery, failures, and performance metrics.

## Core Components

### 1. **Communication Entity** (`server/src/communications/entities/communication.entity.ts`)

The central database table that stores all email logs:

```typescript
@Entity('communications')
export class Communication {
    id: string;                    // Unique identifier for each email
    recipientEmail: string;        // Email recipient
    recipientName?: string;        // Recipient's display name
    senderEmail: string;           // Sender's email address
    senderName?: string;           // Sender's display name
    subject: string;               // Email subject line
    body: string;                  // HTML email content
    plainTextBody?: string;        // Plain text version
    emailType: EmailType;          // Type of email (welcome, alert, etc.)
    templateUsed?: string;         // Template identifier
    status: EmailStatus;           // Current delivery status
    sentAt?: Date;                 // When email was sent
    deliveredAt?: Date;            // When email was delivered
    errorMessage?: string;         // Error details if failed
    metadata?: Record<string, any>; // Additional contextual data
    retryCount: number;            // Number of retry attempts
    nextRetryAt?: Date;            // Next retry timestamp
    externalMessageId?: string;    // SMTP service message ID
    createdAt: Date;               // Record creation time
    updatedAt: Date;               // Last update time
    orgId: Organization;           // Associated organization
    branchId?: Branch;             // Associated branch (optional)
}
```

### 2. **Email Status Tracking**

The system tracks emails through multiple states:

```typescript
export enum EmailStatus {
    PENDING = 'pending',           // Email created, awaiting processing
    QUEUED = 'queued',            // Email queued for sending
    SENDING = 'sending',          // Currently being sent via SMTP
    SENT = 'sent',                // Successfully sent to SMTP server
    FAILED = 'failed',            // Send attempt failed
    BOUNCED = 'bounced',          // Email bounced back
    DELIVERED = 'delivered',      // Successfully delivered to recipient
    RETRY = 'retry',              // Marked for retry
}
```

### 3. **Email Type Classification**

Emails are categorized by purpose for better organization:

```typescript
export enum EmailType {
    WELCOME = 'welcome',                        // General welcome emails
    WELCOME_ORGANIZATION = 'welcome_organization', // Organization onboarding
    WELCOME_BRANCH = 'welcome_branch',          // Branch onboarding
    WELCOME_USER = 'welcome_user',              // User registration
    PASSWORD_RESET = 'password_reset',          // Password changes/resets
    TEST_NOTIFICATION = 'test_notification',    // Test-related alerts
    RESULTS_SUMMARY = 'results_summary',        // Test result notifications
    COURSE_ENROLLMENT = 'course_enrollment',    // Course enrollment confirmations
    SYSTEM_ALERT = 'system_alert',              // System notifications
    CUSTOM = 'custom',                          // Custom emails
}
```

## Email Logging Flow

### 1. **Email Creation and Initial Logging**

When an email is triggered by user events:

```typescript
// 1. Event is emitted (e.g., user.created)
this.eventEmitter.emit('user.created', new UserCreatedEvent(...));

// 2. EmailListener handles the event
@OnEvent('user.created')
async handleUserCreated(event: UserCreatedEvent) {
    await this.communicationsService.sendWelcomeUserEmail(...);
}

// 3. CommunicationsService creates initial log entry
const communication = this.communicationRepository.create({
    recipientEmail: userEmail,
    recipientName: `${firstName} ${lastName}`,
    senderEmail: 'noreply@exxam.com',
    senderName: 'Exxam Platform',
    subject: rendered.subject,
    body: rendered.html,
    plainTextBody: rendered.text,
    emailType: EmailType.WELCOME_USER,
    templateUsed: 'welcome-user',
    status: EmailStatus.PENDING,        // Initial status
    metadata: {
        userId,
        firstName,
        lastName,
        organizationId,
        organizationName
    }
});

// 4. Save to database immediately
await this.communicationRepository.save(communication);
```

### 2. **Queue Processing and Status Updates**

The email queue service manages delivery and updates status:

```typescript
// 1. Email added to queue
await this.emailQueueService.queueEmail({
    to: userEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text
});

// 2. Queue processor updates status
job.status = 'processing';              // Update to processing
const result = await this.emailSMTPService.sendEmail(job.emailOptions);

// 3. Update based on result
if (result.success) {
    job.status = 'completed';           // Mark as completed
    // Update database record with sentAt timestamp
} else {
    await this.handleJobFailure(job, result.error);
}
```

### 3. **Failure Handling and Retry Logic**

Failed emails are automatically retried with exponential backoff:

```typescript
private async handleJobFailure(job: EmailJobData, error: string) {
    job.attempts = (job.attempts || 0) + 1;
    const maxAttempts = job.maxAttempts || 3;

    if (job.attempts < maxAttempts) {
        job.status = 'retrying';
        // Exponential backoff: 2^attempts * 60 seconds
        const delayMinutes = Math.pow(2, job.attempts) * 1;
        job.scheduledFor = new Date(Date.now() + delayMinutes * 60 * 1000);
        
        // Update database with retry info
        await this.updateCommunicationStatus(job.id, {
            status: EmailStatus.RETRY,
            retryCount: job.attempts,
            nextRetryAt: job.scheduledFor,
            errorMessage: error
        });
    } else {
        job.status = 'failed';
        // Mark as permanently failed in database
        await this.updateCommunicationStatus(job.id, {
            status: EmailStatus.FAILED,
            errorMessage: `Failed after ${maxAttempts} attempts: ${error}`
        });
    }
}
```

## Database Indexing for Performance

The communications table includes strategic indexes for efficient querying:

```sql
-- Indexes for common query patterns
IDX_COMMUNICATION_RECIPIENT     -- recipientEmail
IDX_COMMUNICATION_SENDER        -- senderEmail  
IDX_COMMUNICATION_STATUS        -- status
IDX_COMMUNICATION_TYPE          -- emailType
IDX_COMMUNICATION_SENT_DATE     -- sentAt
IDX_COMMUNICATION_CREATED_DATE  -- createdAt
```

## Metadata Logging Examples

### User Registration Email
```json
{
    "userId": "user-123",
    "firstName": "John",
    "lastName": "Doe",
    "organizationId": "org-456",
    "organizationName": "Acme Corp",
    "branchId": "branch-789",
    "branchName": "Downtown Branch",
    "registrationSource": "invitation"
}
```

### Profile Update Email
```json
{
    "userId": "user-123",
    "updatedFields": ["firstName", "avatar"],
    "profileUpdate": true,
    "updateTimestamp": "2024-01-15T10:30:00Z"
}
```

### Password Change Email
```json
{
    "userId": "user-123",
    "passwordChange": true,
    "changeTime": "2024-01-15T14:22:30Z",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
}
```

### Organization Assignment Email
```json
{
    "userId": "user-123",
    "organizationAssignment": true,
    "organizationName": "New Corp",
    "branchName": "Main Branch",
    "assignedBy": "admin-456",
    "assignedAt": "2024-01-15T16:45:00Z",
    "previousOrganization": "Old Corp"
}
```

## Monitoring and Analytics

### Real-time Email Status Tracking
```typescript
// Get status of specific email
const emailStatus = await communicationsService.findOne(emailId);

// Get email statistics
const stats = {
    total: await communicationsRepository.count(),
    sent: await communicationsRepository.count({ status: EmailStatus.SENT }),
    failed: await communicationsRepository.count({ status: EmailStatus.FAILED }),
    pending: await communicationsRepository.count({ status: EmailStatus.PENDING })
};
```

### Performance Metrics
```typescript
// Average delivery time
const avgDeliveryTime = await communicationsRepository
    .createQueryBuilder('comm')
    .select('AVG(TIMESTAMPDIFF(SECOND, comm.createdAt, comm.sentAt))', 'avgSeconds')
    .where('comm.status = :status', { status: EmailStatus.SENT })
    .getRawOne();

// Success rate by email type
const successRates = await communicationsRepository
    .createQueryBuilder('comm')
    .select('comm.emailType', 'type')
    .addSelect('COUNT(*)', 'total')
    .addSelect('SUM(CASE WHEN comm.status = "sent" THEN 1 ELSE 0 END)', 'successful')
    .groupBy('comm.emailType')
    .getRawMany();
```

## Event-Driven Architecture

The system uses NestJS Event Emitter for decoupled email triggering:

```typescript
// User events that trigger emails
'user.created'              → Welcome email
'user.profile.updated'      → Profile update notification  
'user.password.changed'     → Security alert
'user.org.branch.assigned'  → Organization welcome

// Organization events
'organization.created'      → Organization welcome
'branch.created'           → Branch welcome

// System events (future)
'test.completed'           → Results notification
'course.enrolled'          → Enrollment confirmation
```

## Error Handling and Recovery

### Graceful Degradation
- Emails failing don't block user operations
- Failed emails are queued for automatic retry
- System continues operating even if email service is down

### Recovery Mechanisms
- Automatic retry with exponential backoff
- Manual retry capabilities for administrators
- Dead letter queue for permanently failed emails
- Health checks for email service connectivity

## Audit Trail and Compliance

Every email interaction is permanently logged with:
- **Who**: Sender and recipient details
- **What**: Email content and type
- **When**: Precise timestamps for all state changes
- **Why**: Event context and metadata
- **How**: Delivery method and status
- **Where**: Organization and branch context

This comprehensive logging ensures:
- Full audit trails for compliance
- Debugging capabilities for delivery issues
- Performance monitoring and optimization
- User communication history tracking
- Analytics for email effectiveness

## Future Enhancements

The logging system is designed to support:
- Email delivery webhooks from external providers
- Real-time delivery status updates
- Advanced analytics and reporting
- Email engagement tracking (opens, clicks)
- A/B testing for email content
- Automated email campaigns with tracking 