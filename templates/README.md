# Email Templates

This directory contains warm, engaging Handlebars templates for the trainpro Platform email communications system. Each template is designed with empathy, clarity, and value-focused messaging that explains not just what is happening, but why it matters to both users and organizations.

## Design Philosophy

Our email templates follow these core principles:
- **Human-first communication**: Every email sounds like it's from a real person who cares
- **Value-driven messaging**: Clear explanations of how the platform helps users and organizations succeed
- **Growth-oriented language**: Focuses on potential, progress, and positive outcomes
- **Contextual relevance**: Each template addresses the specific situation and emotions involved
- **Actionable guidance**: Provides clear next steps and practical advice

## Available Templates

### 1. Invitation Email (`invitation.hbs`)
- **Purpose**: Warm, personal invitations that explain who is inviting, why they were chosen, and the value for both user and organization
- **Key Features**: Highlights the inviter's belief in the recipient, explains platform benefits, shows organizational value
- **Required Data**: `inviterName`, `inviterEmail`, `invitationUrl`, `expiryTime`
- **Optional Data**: `customMessage`, `organizationId`, `branchId`

### 2. Welcome Email (`welcome.hbs`)
- **Purpose**: Enthusiastic welcome that positions the platform as a gateway to potential and growth
- **Key Features**: Focuses on transformation, personal empowerment, and learning superpowers
- **Required Data**: `recipientName`, `loginUrl`, `dashboardUrl`
- **Optional Data**: `activationToken`, `profileUrl`

### 3. Course Enrollment (`course-enrollment.hbs`)
- **Purpose**: Celebrates enrollment as the beginning of transformation and provides success strategies
- **Key Features**: Emphasizes course value, provides practical success tips, builds excitement for learning
- **Required Data**: `courseName`, `courseUrl`
- **Optional Data**: `courseDescription`, `instructorName`, `startDate`, `endDate`

### 4. Test Notification (`test-notification.hbs`)
- **Purpose**: Frames tests as opportunities to showcase growth rather than just assessments
- **Key Features**: Builds confidence, explains test value, provides success strategies
- **Required Data**: `testTitle`, `dueDate`, `testUrl`
- **Optional Data**: `testDescription`, `duration`, `instructorName`

### 5. Results Summary (`results-summary.hbs`)
- **Purpose**: Celebrates progress regardless of score and provides encouraging, growth-focused feedback
- **Key Features**: Adaptive messaging based on performance, focuses on growth over grades
- **Required Data**: `testTitle`, `percentage`, `correctAnswers`, `totalQuestions`, `resultsUrl`
- **Optional Data**: `feedback`, `completionTime`

### 6. Password Reset (`password-reset.hbs`)
- **Purpose**: Empathetic, non-judgmental password reset with security education
- **Key Features**: Normalizes password issues, provides security education, maintains user confidence
- **Required Data**: `resetUrl`, `resetToken`, `expiryTime`
- **Optional Data**: `ipAddress`

### 7. System Alert (`system-alert.hbs`)
- **Purpose**: Transparent, empathetic system communications that respect user time and emotions
- **Key Features**: Tone adapts to alert type, explains impact, shows care for user experience
- **Required Data**: `alertTitle`, `alertMessage`, `alertType`, `timestamp`
- **Optional Data**: `actionUrl`, `actionText`

### 8. Organization Welcome (`welcome-organization.hbs`)
- **Purpose**: Celebrates organizational commitment to learning and explains business value
- **Key Features**: Focuses on transformation, ROI, competitive advantage through learning
- **Required Data**: `organizationName`, `dashboardUrl`
- **Optional Data**: `logoUrl`, `website`

### 9. Branch Welcome (`welcome-branch.hbs`)
- **Purpose**: Welcomes branch setup with focus on local impact and team development
- **Key Features**: Emphasizes local leadership, team building, organizational alignment
- **Required Data**: `branchName`, `organizationName`, `dashboardUrl`
- **Optional Data**: `address`, `contactNumber`, `managerName`

### 10. User Welcome (`welcome-user.hbs`)
- **Purpose**: Personal welcome for individual users with role-specific messaging
- **Key Features**: Personalizes experience, explains user benefits, builds community connection
- **Required Data**: `firstName`, `lastName`, `dashboardUrl`
- **Optional Data**: `avatar`, `organizationName`, `branchName`

### 11. Custom Template (`custom.hbs`)
- **Purpose**: Flexible template for custom communications with consistent warmth and professionalism
- **Key Features**: Maintains brand voice, adaptable content sections, professional yet personal
- **Required Data**: `title`, `message`
- **Optional Data**: `customSections` array with title/content pairs

## Template Naming Convention

- HTML templates: `{template-name}.hbs`
- Text templates: `{template-name}.txt.hbs`

## Handlebars Helpers

The following custom helpers are available in all templates:

- `{{eq a b}}` - Equality comparison
- `{{ne a b}}` - Not equal comparison
- `{{gt a b}}` - Greater than
- `{{lt a b}}` - Less than
- `{{formatDate date 'short|long'}}` - Date formatting
- `{{percentage value total}}` - Calculate percentage
- `{{capitalize str}}` - Capitalize first letter

## Common Template Data

All templates have access to these base variables:

- `recipientName` - Recipient's display name
- `recipientEmail` - Recipient's email address
- `companyName` - Platform name (default: "trainpro Platform")
- `companyUrl` - Platform URL
- `supportEmail` - Support contact email
- `unsubscribeUrl` - Unsubscribe link

## Usage

Templates are rendered using the `EmailTemplateService`:

```typescript
// Render by email type
const result = await emailTemplateService.renderByType(
  EmailType.WELCOME,
  templateData
);

// Render by template name
const result = await emailTemplateService.renderTemplate({
  template: 'welcome',
  data: templateData,
  format: 'html' // or 'text' or 'both'
});
```

## Testing

Use the `TemplateTestingService` to test templates:

```typescript
// Test a specific template
const testResult = await templateTestingService.testTemplate(EmailType.WELCOME);

// Test all templates
const allResults = await templateTestingService.testAllTemplates();

// Generate test report
const report = await templateTestingService.generateTestReport();
```

## Development

1. Create new `.hbs` files in this directory
2. Add corresponding configuration in `EmailTemplateService`
3. Update template data interfaces in `template.interface.ts`
4. Test templates using `TemplateTestingService`

## Best Practices

1. Always provide both HTML and text versions
2. Use responsive design for HTML templates
3. Include fallback content for optional data
4. Test templates with various data combinations
5. Keep templates accessible and readable 