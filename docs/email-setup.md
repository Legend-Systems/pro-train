# Email Configuration Setup Guide

## Google SMTP Setup with App Password

### Prerequisites
1. Gmail account with 2-factor authentication enabled
2. Google App Password generated

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification if not already enabled

### Step 2: Generate App Password
1. Go to Google Account Security settings
2. Under "Signing in to Google", select "App passwords"
3. Select "Mail" as the app and "Other" as the device
4. Enter "Exxam Platform" as the device name
5. Copy the generated 16-character password

### Step 3: Environment Variables
Add the following variables to your `.env` file:

```env
# Email Configuration (Google SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-character-app-password
SMTP_POOL=true
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
SMTP_RATE_DELTA=1000
SMTP_RATE_LIMIT=14

# Email Defaults
EMAIL_FROM_NAME=Exxam Platform
EMAIL_FROM_ADDRESS=your-email@gmail.com
EMAIL_REPLY_TO=noreply@exxam.com

# Email Retry Configuration
EMAIL_MAX_RETRIES=3
EMAIL_BACKOFF_FACTOR=2
EMAIL_INITIAL_DELAY=1000
EMAIL_MAX_DELAY=30000

# Email Templates
EMAIL_TEMPLATES_PATH=./templates
EMAIL_DEFAULT_TEMPLATE=default
```

### Step 4: Test Connection
The system will automatically validate the email configuration on startup. You can also test the connection using the health check endpoint once implemented.

## Security Notes
- Never commit your App Password to version control
- Use environment variables for all sensitive configuration
- The App Password should be treated as securely as your main password
- Consider rotating App Passwords periodically

## Rate Limiting
Google SMTP has the following limits:
- 500 emails per day for free accounts
- 2000 emails per day for Google Workspace accounts
- 100 recipients per message
- Rate limit of 14 messages per second

Our configuration respects these limits with:
- `SMTP_RATE_LIMIT=14` (messages per second)
- `SMTP_RATE_DELTA=1000` (time window in ms)
- Connection pooling to optimize performance

## Troubleshooting

### Common Issues
1. **Authentication Error**: Verify App Password is correct and 2FA is enabled
2. **Connection Timeout**: Check firewall settings and network connectivity
3. **Rate Limit Exceeded**: Reduce sending rate or implement queuing
4. **Invalid Recipient**: Verify email addresses are valid format

### Error Codes
- `535 Authentication failed`: Wrong username or App Password
- `554 Message rejected`: Content or recipient issues
- `421 Service not available`: Rate limiting or temporary issues 