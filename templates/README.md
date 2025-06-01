# Email Templates

This directory contains Handlebars templates for the trainpro Platform email communications system.

## Available Templates

### 1. Welcome Email (`welcome.hbs`)
- **Purpose**: Welcome new users to the platform
- **Required Data**: `recipientName`, `loginUrl`, `dashboardUrl`
- **Optional Data**: `activationToken`, `profileUrl`

### 2. Password Reset (`password-reset.hbs`)
- **Purpose**: Send password reset instructions
- **Required Data**: `resetUrl`, `resetToken`, `expiryTime`
- **Optional Data**: `ipAddress`

### 3. Test Notification (`test-notification.hbs`)
- **Purpose**: Notify users about new test assignments
- **Required Data**: `testTitle`, `dueDate`, `testUrl`
- **Optional Data**: `testDescription`, `duration`, `instructorName`

### 4. Custom Template (`custom.hbs`)
- **Purpose**: Flexible template for custom communications
- **Required Data**: `title`, `message`
- **Optional Data**: Any additional data needed

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