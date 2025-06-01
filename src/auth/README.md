# 🔐 Authentication Module

## Overview

The Authentication Module is the security backbone of the trainpro platform, providing comprehensive user authentication, authorization, token management, and secure email communication flows. This module handles user registration, login, password management, email verification, and invitation systems with enterprise-grade security features.

## 🏗️ Architecture

```
auth/
├── auth.controller.ts          # REST API endpoints
├── auth.service.ts            # Business logic & email integration
├── auth.module.ts             # Module configuration
├── jwt.strategy.ts            # Passport JWT authentication strategy
├── jwt-auth.guard.ts          # Route protection guard
├── token-manager.service.ts   # Token generation & validation
├── decorators/                # Custom decorators
│   ├── get-user.decorator.ts
│   └── org-branch-scope.decorator.ts
├── dto/                       # Data Transfer Objects
│   ├── forgot-password.dto.ts
│   ├── reset-password.dto.ts
│   ├── send-invitation.dto.ts
│   └── validate-invitation.dto.ts
├── interfaces/               # TypeScript interfaces
│   └── authenticated-request.interface.ts
├── services/                 # Additional services
│   └── org-branch-scoping.service.ts
└── validators/              # Custom validation rules
    └── password.validator.ts
```

## 🔑 Core Features

### Authentication & Authorization

- **JWT-based Authentication** with access and refresh tokens
- **Role-based Access Control** (BRANDON, OWNER, ADMIN, USER)
- **Organization & Branch Scoping** for multi-tenant support
- **Secure Password Hashing** using bcrypt with 12 salt rounds
- **Rate Limiting** protection against brute force attacks

### User Registration & Onboarding

- **Self-Registration** with email verification
- **Invitation-based Registration** for organizations
- **Welcome Email Automation** with customizable templates
- **Organization/Branch Auto-assignment** via invitations

### Password Management

- **Secure Password Reset** via email tokens
- **Password Strength Validation** with custom validators
- **Token-based Password Recovery** with time expiration
- **Password History Protection** (implemented in UserService)

### Email Integration

- **Transactional Email System** with template rendering
- **Email Queue Management** with priority levels
- **Multi-template Support** (welcome, reset, verification, invitation)
- **Responsive Email Templates** with MJML/Handlebars

## 📚 API Endpoints

### Authentication Endpoints

#### `POST /auth/signup`

**User Registration**

```typescript
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "avatar": 123,
  "invitationToken": "optional-token"
}

// Response
{
  "success": true,
  "data": {
    "user": { /* UserResponseDto */ },
    "organization": { /* OrgInfo */ },
    "branch": { /* BranchInfo */ }
  },
  "message": "Account created successfully"
}
```

#### `POST /auth/signin`

**User Authentication**

```typescript
// Request
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

// Response
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "expiresIn": 3600,
    "user": { /* UserResponseDto */ },
    "leaderboard": { /* UserStatsResponseDto */ },
    "organization": { /* OrgInfo */ },
    "branch": { /* BranchInfo */ }
  }
}
```

#### `POST /auth/refresh`

**Token Refresh**

```typescript
// Request
{
  "refreshToken": "refresh-token"
}

// Response
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-token",
    "refreshToken": "new-refresh-token",
    "expiresIn": 3600
  }
}
```

### Password Management Endpoints

#### `POST /auth/forgot-password`

**Password Reset Request**

```typescript
// Request
{
  "email": "user@example.com"
}

// Response (Security: same response for valid/invalid emails)
{
  "success": true,
  "message": "If an account exists, reset instructions have been sent"
}
```

#### `POST /auth/reset-password`

**Password Reset Completion**

```typescript
// Request
{
  "token": "reset-token",
  "password": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}

// Response
{
  "success": true,
  "message": "Password has been successfully reset"
}
```

### Email Verification Endpoints

#### `POST /auth/verify-email`

**Email Address Verification**

```typescript
// Request
{
  "token": "verification-token"
}

// Response
{
  "success": true,
  "message": "Email address verified successfully"
}
```

#### `POST /auth/resend-verification`

**Resend Verification Email**

```typescript
// Request
{
  "email": "user@example.com"
}
```

### Invitation System Endpoints

#### `POST /auth/send-invitation` 🔒 Protected

**Send User Invitation**

```typescript
// Request
{
  "email": "newuser@example.com",
  "message": "Join our team!",
  "organizationId": "org-uuid",
  "branchId": "branch-uuid"
}

// Response
{
  "success": true,
  "message": "Invitation sent successfully"
}
```

#### `POST /auth/validate-invitation`

**Validate Invitation Token**

```typescript
// Request
{
  "token": "invitation-token"
}

// Response
{
  "success": true,
  "data": {
    "email": "newuser@example.com",
    "inviterName": "John Doe",
    "organizationId": "org-uuid",
    "branchId": "branch-uuid"
  }
}
```

#### `POST /auth/re-invite-all` 🔒 Protected

**Send Re-engagement Campaign to All Users**

```typescript
// Request
{} // No body required

// Response
{
  "success": true,
  "message": "Re-engagement emails sent successfully. 25 emails queued, 0 failed.",
  "data": {
    "totalUsers": 25,
    "successCount": 25,
    "failedCount": 0,
    "failedEmails": []
  }
}
```

**Purpose**: Organizational re-engagement campaign to encourage existing users to actively start using the platform.

**Features**:
- Fetches all users from the system
- Sends personalized re-engagement emails
- Encourages platform adoption and learning
- Provides detailed success/failure reporting
- Implements anti-spam measures with randomized delays

**Rate Limiting**: 1 attempt per hour per user to prevent abuse

**Email Content**:
- Personalized greeting with user's name
- Organizational invitation using the user's actual organization name
- Highlights of available features and learning opportunities
- Clear call-to-action to login and begin learning
- Professional tone from the user's organization
- Quick access links to courses, tests, leaderboard, and support
- Fallback to "Your Organization" for users without organization links

**Use Cases**:
- User re-engagement campaigns
- Platform adoption initiatives
- Learning program launch announcements
- Organizational onboarding communication
- Course enrollment campaigns

### Utility Endpoints

#### `GET /auth/token-info` 🔒 Protected

**Get Token Information**

```typescript
// Response
{
  "success": true,
  "data": {
    "user": { /* Full user info */ },
    "organization": { /* Org details */ },
    "branch": { /* Branch details */ }
  }
}
```

## 🎫 Token Management

### JWT Access Tokens

- **Expiration**: 1 hour
- **Payload**: User ID, email, name, org/branch IDs
- **Usage**: Bearer token in Authorization header
- **Security**: RS256 signature with configurable secret

### Refresh Tokens

- **Expiration**: 7 days
- **Storage**: In-memory with automatic cleanup
- **Purpose**: Seamless token renewal
- **Security**: Cryptographically secure random generation

### Special Purpose Tokens

| Token Type         | Expiration | Purpose            | Storage   |
| ------------------ | ---------- | ------------------ | --------- |
| Password Reset     | 15 minutes | Password recovery  | In-memory |
| Email Verification | 24 hours   | Email confirmation | In-memory |
| Invitation         | 7 days     | User onboarding    | In-memory |

## 📧 Email System Integration

### Email Types

1. **Welcome Email** - User registration confirmation
2. **Password Reset** - Security recovery instructions
3. **Email Verification** - Account activation
4. **Invitation Email** - Team onboarding
5. **Re-engagement Email** - Organizational campaign to encourage platform usage

### Email Configuration

```typescript
// Environment Variables
CLIENT_URL=http://localhost:3000
APP_NAME=trainpro Platform
SUPPORT_EMAIL=support@trainpro.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

### Email Priority Levels

- **CRITICAL**: Password reset (immediate delivery)
- **HIGH**: Welcome, verification, invitations
- **NORMAL**: General notifications
- **LOW**: Marketing communications

## 🔒 Security Features

### Password Security

- **Minimum Requirements**: 8+ characters with mixed case, numbers, symbols
- **Hashing Algorithm**: bcrypt with 12 salt rounds
- **Validation**: Custom password strength validator
- **Protection**: No password exposure in API responses

### Rate Limiting

```typescript
// Endpoint-specific limits
@Throttle({ default: { limit: 3, ttl: 60000 } })    // Signup: 3/min
@Throttle({ default: { limit: 5, ttl: 60000 } })    // Signin: 5/min
@Throttle({ default: { limit: 3, ttl: 300000 } })   // Password reset: 3/5min
@Throttle({ default: { limit: 10, ttl: 300000 } })  // Invitations: 10/5min
@Throttle({ default: { limit: 1, ttl: 3600000 } })  // Re-engagement: 1/hour
```

### Security Headers

- **JWT Secret**: Configurable via environment
- **CORS Protection**: Configurable origins
- **Helmet Integration**: Security headers
- **Input Validation**: DTO validation with class-validator

## 🛡️ Guards & Decorators

### Authentication Guard

```typescript
@UseGuards(JwtAuthGuard)
// Protects routes requiring authentication
```

### Custom Decorators

```typescript
@GetUser() user: AuthenticatedUser
@GetUserId() userId: string
@OrgBranchScope() scope: OrgBranchScope
@GetOrgId() orgId: string
@GetBranchId() branchId: string
```

## 🔧 Services

### AuthService

**Primary service handling all authentication logic**

- User registration and login
- Password management
- Email sending coordination
- Token validation

### TokenManagerService

**Manages all token operations**

- JWT token generation and validation
- Refresh token management
- Special token lifecycle (reset, verification, invitation)
- Token revocation and cleanup

### OrgBranchScopingService

**Multi-tenant data scoping**

- Organization-level data filtering
- Branch-level access control
- Scoped repository creation
- Query builder enhancements

## 🔗 Dependencies

### Internal Dependencies

- **UserModule**: User management operations
- **LeaderboardModule**: User statistics on login
- **CommunicationsModule**: Email template and queue services

### External Dependencies

- **@nestjs/jwt**: JWT token handling
- **@nestjs/passport**: Authentication strategies
- **bcrypt**: Password hashing
- **class-validator**: Input validation
- **@nestjs/throttler**: Rate limiting

## 🚀 Usage Examples

### Basic Authentication Flow

```typescript
// 1. Register new user
const registerResponse = await authService.signUp({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
});

// 2. Sign in user
const loginResponse = await authService.signIn({
    email: 'user@example.com',
    password: 'SecurePass123!',
});

// 3. Use access token
const headers = {
    Authorization: `Bearer ${loginResponse.data.accessToken}`,
};
```

### Invitation Flow

```typescript
// 1. Send invitation (requires authentication)
await authService.sendInvitation(
    {
        email: 'newuser@example.com',
        message: 'Join our team!',
        organizationId: 'org-123',
    },
    inviterUserId,
);

// 2. Validate invitation token
const validation = authService.validateInvitation({
    token: 'invitation-token',
});

// 3. Register with invitation
await authService.signUp({
    email: 'newuser@example.com',
    password: 'SecurePass123!',
    firstName: 'Jane',
    lastName: 'Doe',
    invitationToken: 'invitation-token',
});
```

### Re-engagement Campaign Flow

```typescript
// 1. Initiate re-engagement campaign (requires authentication & admin permissions)
const campaignResponse = await authService.sendReInviteToAllUsers();

// Response includes detailed statistics
console.log(campaignResponse.data);
// {
//   totalUsers: 150,
//   successCount: 148,
//   failedCount: 2,
//   failedEmails: ['invalid@domain.com', 'bounced@email.com']
// }

// 2. Monitor campaign success
if (campaignResponse.success) {
    console.log(`✅ Campaign sent to ${campaignResponse.data.successCount} users`);
    if (campaignResponse.data.failedCount > 0) {
        console.log(`⚠️ ${campaignResponse.data.failedCount} emails failed to send`);
    }
}
```

### Protected Route Implementation

```typescript
@Controller('protected')
export class ProtectedController {
    @Get('profile')
    @UseGuards(JwtAuthGuard)
    getUserProfile(@GetUser() user: AuthenticatedUser) {
        return { message: `Hello ${user.firstName}!` };
    }

    @Get('org-data')
    @UseGuards(JwtAuthGuard)
    getOrgData(@OrgBranchScope() scope: OrgBranchScope) {
        // Data automatically scoped to user's org/branch
        return this.dataService.findByScope(scope);
    }
}
```

## 📊 Performance Considerations

### Token Storage

- **In-Memory Storage**: Fast access but not persistent
- **Automatic Cleanup**: Expired tokens removed automatically
- **Memory Efficiency**: Regular cleanup prevents memory leaks

### Email Delivery

- **Queue-Based**: Non-blocking email sending
- **Priority System**: Critical emails sent first
- **Retry Logic**: Handled by email queue service

## 🔧 Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key-32-chars-minimum
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration
CLIENT_URL=http://localhost:3000
APP_NAME=Exxam Learning Platform
SUPPORT_EMAIL=support@exxam.com

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10
```

### Module Configuration

```typescript
@Module({
    imports: [
        UserModule,
        LeaderboardModule,
        CommunicationsModule,
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: '1h' },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtStrategy,
        TokenManagerService,
        OrgBranchScopingService,
    ],
    exports: [AuthService, TokenManagerService, OrgBranchScopingService],
})
export class AuthModule {}
```

## 🧪 Testing

### Unit Tests

- Service method testing
- Token validation testing
- Password security testing
- Email integration testing

### Integration Tests

- API endpoint testing
- Authentication flow testing
- Email delivery testing
- Rate limiting testing

### Security Testing

- Password strength validation
- Token security verification
- Rate limiting effectiveness
- Input validation security

## 🔮 Future Enhancements

### Potential Improvements

1. **Persistent Token Storage**: Redis/Database storage for tokens
2. **OAuth Integration**: Social login providers
3. **Multi-Factor Authentication**: SMS/TOTP support
4. **Session Management**: Advanced session control
5. **Audit Logging**: Comprehensive security logging
6. **Token Rotation**: Advanced refresh token rotation

### Scalability Considerations

- Database token storage for horizontal scaling
- Redis caching for session management
- Event-driven email system
- Microservice architecture preparation

---

This Auth module provides enterprise-grade security with comprehensive user management, secure token handling, and integrated email communication, forming the foundation for the entire trainpro platform's security architecture.
