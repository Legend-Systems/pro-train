# Event-Driven Email System

This document explains how the event-driven email system works in the Exxam platform.

## Overview

The email system is designed to automatically send welcome emails when new organizations, branches, or users are created. It uses an event-driven architecture where services emit events when entities are created, and email listeners respond to these events by sending appropriate welcome emails.

## Architecture

### Components

1. **Event Classes** (`src/common/events/`)

    - `OrganizationCreatedEvent`
    - `BranchCreatedEvent`
    - `UserCreatedEvent`

2. **Event Listeners** (`src/communications/listeners/`)

    - `EmailListener` - Handles all email-related events

3. **Email Services** (`src/communications/services/`)

    - `EmailTemplateService` - Manages email templates
    - `EmailSMTPService` - Handles email sending
    - `EmailQueueService` - Manages email queue
    - `CommunicationsService` - Main service for email operations

4. **Templates** (`templates/`)
    - `welcome-organization.hbs`
    - `welcome-branch.hbs`
    - `welcome-user.hbs`

## How It Works

### 1. Entity Creation

When a new organization, branch, or user is created:

```typescript
// In OrgService.createOrganization()
const savedOrganization = await this.organizationRepository.save(organization);

// Emit event
this.eventEmitter.emit(
    'organization.created',
    new OrganizationCreatedEvent(
        savedOrganization.id,
        savedOrganization.name,
        savedOrganization.email || '',
        savedOrganization.logoUrl,
        savedOrganization.website,
    ),
);
```

### 2. Event Handling

The `EmailListener` listens for these events:

```typescript
@OnEvent('organization.created')
async handleOrganizationCreated(event: OrganizationCreatedEvent) {
    await this.communicationsService.sendWelcomeOrganizationEmail(
        event.organizationId,
        event.organizationName,
        event.organizationEmail,
        event.logoUrl,
        event.website,
    );
}
```

### 3. Email Generation

The `CommunicationsService` generates and sends emails:

```typescript
async sendWelcomeOrganizationEmail(...) {
    // Prepare template data
    const templateData: WelcomeOrganizationTemplateData = {
        recipientName: organizationName,
        recipientEmail: organizationEmail,
        organizationName,
        organizationId,
        dashboardUrl: `${this.configService.get('CLIENT_URL')}/dashboard`,
        // ... other data
    };

    // Render template
    const rendered = await this.emailTemplateService.renderByType(
        EmailType.WELCOME_ORGANIZATION,
        templateData,
    );

    // Save communication record
    const communication = this.communicationRepository.create({...});
    await this.communicationRepository.save(communication);

    // Queue email for sending
    await this.emailQueueService.addEmail({
        to: organizationEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
    });
}
```

## Email Types

### Organization Welcome Email

- **Event**: `organization.created`
- **Template**: `welcome-organization.hbs`
- **Data**: Organization details, dashboard links, setup guide
- **Subject**: "Welcome {organizationName} to {companyName}!"

### Branch Welcome Email

- **Event**: `branch.created`
- **Template**: `welcome-branch.hbs`
- **Data**: Branch details, organization info, contact details
- **Subject**: "Welcome {branchName} - {organizationName} Branch Setup Complete!"

### User Welcome Email

- **Event**: `user.created`
- **Template**: `welcome-user.hbs`
- **Data**: User details, organization/branch info, profile links
- **Subject**: "Welcome {firstName}! Your {companyName} Account is Ready"

## Template System

### Template Data Interfaces

Each email type has a corresponding TypeScript interface:

```typescript
export interface WelcomeOrganizationTemplateData extends BaseTemplateData {
    organizationName: string;
    organizationId: string;
    dashboardUrl: string;
    loginUrl: string;
    logoUrl?: string;
    website?: string;
    setupGuideUrl?: string;
}
```

### Template Features

- **Handlebars templating** with helpers for dates, percentages, etc.
- **Conditional content** using `{{#if}}` blocks
- **Dynamic subjects** based on template data
- **HTML and text versions** for better compatibility
- **Responsive design** for mobile devices

## Configuration

### Environment Variables

```env
# Email Configuration
EMAIL_FROM_ADDRESS=noreply@exxam.com
EMAIL_FROM_NAME=Exxam Platform
SUPPORT_EMAIL=support@exxam.com

# Client URLs
CLIENT_URL=http://localhost:3000

# SMTP Configuration (for sending emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### Template Path

Templates are stored in the `templates/` directory at the project root.

## Usage Examples

### Creating an Organization (triggers email)

```typescript
const organization = await orgService.createOrganization({
    name: 'Acme Corp',
    email: 'admin@acme.com',
    website: 'https://acme.com',
});
// Email automatically sent via event system
```

### Creating a Branch (triggers email)

```typescript
const branch = await orgService.createBranch(organizationId, {
    name: 'Downtown Branch',
    email: 'downtown@acme.com',
    address: '123 Main St',
    managerName: 'John Doe',
});
// Email automatically sent via event system
```

### Creating a User (triggers email)

```typescript
const user = await userService.create({
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@acme.com',
    orgId: organizationId,
    branchId: branchId,
});
// Email automatically sent via event system
```

## Benefits

1. **Decoupled Architecture**: Services don't need to know about email sending
2. **Automatic Emails**: No manual intervention required
3. **Consistent Branding**: All emails use the same templates and styling
4. **Audit Trail**: All emails are logged in the database
5. **Reliable Delivery**: Email queue ensures delivery even if SMTP is temporarily unavailable
6. **Template Management**: Easy to update email content without code changes

## Extending the System

### Adding New Email Types

1. Add new email type to `EmailType` enum
2. Create template data interface
3. Add template configuration to `EmailTemplateService`
4. Create HTML template file
5. Add method to `CommunicationsService`
6. Create event class and emit from appropriate service

### Customizing Templates

Templates use Handlebars syntax and support:

- Variables: `{{variableName}}`
- Conditionals: `{{#if condition}}...{{/if}}`
- Loops: `{{#each items}}...{{/each}}`
- Helpers: `{{formatDate date 'short'}}`

## Troubleshooting

### Common Issues

1. **Templates not found**: Check `EMAIL_TEMPLATES_PATH` configuration
2. **SMTP errors**: Verify SMTP credentials and settings
3. **Events not firing**: Ensure EventEmitterModule is imported in AppModule
4. **Missing data**: Check template data interfaces match actual data

### Debugging

- Check application logs for email sending status
- Review `communications` table for email records
- Test templates using the `TemplateTestingService`
- Verify event emission in service methods
