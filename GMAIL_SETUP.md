# Gmail SMTP Setup Guide

## Quick Fix for SSL Connection Error

The SSL error you're experiencing is due to incorrect SMTP configuration. Follow these steps to resolve it:

### 1. Environment Variables Setup

Create or update your `.env` file with these **exact** values:

```env
# Gmail SMTP Configuration (Use EXACTLY these values)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-character-app-password

# Email Settings
EMAIL_FROM_ADDRESS=your-email@gmail.com
EMAIL_FROM_NAME="Exxam Platform"

# Debug (optional - set to true for troubleshooting)
SMTP_DEBUG=false
```

### 2. Gmail App Password Setup

**CRITICAL**: You MUST use an App Password, not your regular Gmail password.

#### Steps to create Gmail App Password:

1. **Enable 2-Factor Authentication**:
   - Go to your Google Account settings
   - Navigate to Security > 2-Step Verification
   - Enable it if not already enabled

2. **Generate App Password**:
   - In Google Account settings, go to Security
   - Under "Signing in to Google", click "2-Step Verification"
   - At the bottom, click "App passwords"
   - Select "Mail" and "Other (Custom name)"
   - Enter "Exxam Platform" as the name
   - Click "Generate"

3. **Copy the 16-character password**:
   - Google will show a 16-character password like: `abcd efgh ijkl mnop`
   - Remove the spaces: `abcdefghijklmnop`
   - Use this as your `SMTP_PASSWORD`

### 3. Configuration Options

Choose ONE of these configurations:

#### Option A: Port 587 with STARTTLS (Recommended)
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

#### Option B: Port 465 with SSL/TLS
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### 4. Common Issues & Solutions

#### "wrong version number" SSL Error
- **Cause**: Using SSL on a STARTTLS port or vice versa
- **Solution**: Use Option A above (port 587 with SMTP_SECURE=false)

#### "Authentication failed" Error
- **Cause**: Using regular Gmail password instead of App Password
- **Solution**: Follow step 2 above to create an App Password

#### "Connection timeout" Error
- **Cause**: Firewall or network restrictions
- **Solution**: Ensure port 587 (or 465) is open

### 5. Testing the Configuration

After updating your `.env` file:

1. Restart your NestJS server
2. The service will automatically test the connection on startup
3. Check the logs for "SMTP connection verified successfully"

### 6. Security Notes

- **Never commit** your `.env` file to version control
- Use different credentials for different environments
- Consider rotating App Passwords periodically
- For production, use proper secret management services

### 7. Troubleshooting Commands

If you're still having issues, enable debug mode:

```env
SMTP_DEBUG=true
```

This will show detailed connection logs to help identify the problem.

## Updated Code Changes

The `EmailSMTPService` has been updated to:
- ✅ Properly handle SSL/TLS configuration based on port
- ✅ Fix TypeScript type safety issues
- ✅ Improve error handling and retry logic
- ✅ Add proper connection verification

The service will now automatically:
- Use STARTTLS for port 587
- Use SSL/TLS for port 465
- Handle connection errors gracefully
- Provide better error messages 