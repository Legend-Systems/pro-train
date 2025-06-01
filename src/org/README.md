# 🏢 Organization Management Module

## Overview

The Organization Management Module is the enterprise foundation of the trainpro platform, providing comprehensive multi-tenant organization management, administrative controls, subscription handling, and organizational hierarchy management. This module handles organization creation, configuration, user management, billing integration, and enterprise-grade features for educational institutions and corporate training programs.

## 🏗️ Architecture

```
org/
├── org.controller.ts           # REST API endpoints for organization operations
├── org.service.ts             # Core business logic and organization management
├── org.module.ts              # Module configuration & dependencies
├── entities/                  # Database entities
│   └── organization.entity.ts # Organization entity with relationships
├── dto/                      # Data Transfer Objects
│   ├── create-org.dto.ts     # Organization creation validation
│   ├── update-org.dto.ts     # Organization modification validation
│   └── org-response.dto.ts   # API response formats
├── interfaces/               # TypeScript interfaces
│   ├── org-settings.interface.ts     # Organization settings
│   ├── billing.interface.ts          # Billing configuration
│   └── subscription.interface.ts     # Subscription management
└── org.controller.spec.ts     # API endpoint tests
└── org.service.spec.ts        # Service layer tests
```

## 🎯 Core Features

### Organization Management
- **Multi-Tenant Architecture** with complete data isolation
- **Hierarchical Organization Structure** supporting complex enterprise setups
- **Domain Management** with custom subdomain and DNS configuration
- **Branding Customization** with logos, themes, and white-label options
- **Settings Management** with granular configuration controls

### User & Access Management
- **User Provisioning** with automated account creation and management
- **Role-Based Access Control** with customizable permission systems
- **Single Sign-On (SSO)** integration with enterprise identity providers
- **User Directory** with LDAP/Active Directory synchronization
- **Audit Logging** for compliance and security monitoring

### Billing & Subscriptions
- **Subscription Management** with flexible pricing models
- **Usage Tracking** with detailed analytics and reporting
- **Billing Integration** with popular payment processors
- **License Management** for user seats and feature access
- **Cost Centers** for departmental billing allocation

### Enterprise Features
- **API Access** with rate limiting and usage monitoring
- **Data Export/Import** with bulk operations and migration tools
- **Compliance Tools** for GDPR, FERPA, and other regulations
- **Security Controls** with advanced authentication and encryption
- **Performance Monitoring** with real-time metrics and alerts

## 📊 Database Schema

### Organization Entity
```typescript
@Entity('organizations')
export class Organization {
    @PrimaryGeneratedColumn()
    orgId: number;

    @Column({ unique: true })
    @Index()
    slug: string;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    description?: string;

    @Column({ nullable: true })
    domain?: string;

    @Column({ nullable: true })
    subdomain?: string;

    @Column({ nullable: true })
    logoUrl?: string;

    @Column({ nullable: true })
    website?: string;

    @Column({ nullable: true })
    industry?: string;

    @Column({ default: 'small' })
    size: string; // small, medium, large, enterprise

    @Column({ default: 'trial' })
    subscriptionStatus: string;

    @Column({ nullable: true })
    subscriptionPlan?: string;

    @Column({ nullable: true })
    subscriptionExpiry?: Date;

    @Column({ type: 'json', nullable: true })
    settings?: OrganizationSettings;

    @Column({ type: 'json', nullable: true })
    billingInfo?: BillingInfo;

    @Column({ type: 'json', nullable: true })
    features?: string[];

    @Column({ default: 0 })
    userLimit: number;

    @Column({ default: 0 })
    currentUserCount: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ nullable: true })
    parentOrgId?: number;

    @Column('simple-array', { nullable: true })
    allowedDomains?: string[];

    @Column({ type: 'json', nullable: true })
    ssoConfig?: SSOConfig;

    @Column({ type: 'json', nullable: true })
    apiKeys?: ApiKeyConfig[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relationships
    @ManyToOne(() => Organization, { nullable: true })
    parentOrg?: Organization;

    @OneToMany(() => Organization, 'parentOrg')
    childOrgs: Organization[];

    @OneToMany(() => Branch, 'org')
    branches: Branch[];

    @OneToMany(() => User, 'org')
    users: User[];

    @OneToMany(() => Course, 'org')
    courses: Course[];
}
```

### Organization Settings Interface
```typescript
export interface OrganizationSettings {
    branding: {
        primaryColor: string;
        secondaryColor: string;
        logoUrl?: string;
        faviconUrl?: string;
        customCss?: string;
    };
    features: {
        enableReports: boolean;
        enableAnalytics: boolean;
        enableIntegrations: boolean;
        enableSSO: boolean;
        enableAPI: boolean;
    };
    security: {
        passwordPolicy: PasswordPolicy;
        sessionTimeout: number;
        twoFactorRequired: boolean;
        ipWhitelist?: string[];
    };
    notifications: {
        emailNotifications: boolean;
        smsNotifications: boolean;
        webhookUrl?: string;
    };
    content: {
        allowedFileTypes: string[];
        maxFileSize: number;
        storageLimit: number;
    };
}
```

## 📚 API Endpoints

### Organization Management

#### `POST /organizations` 🔒 Super Admin
**Create Organization**
```typescript
// Request
{
  "name": "Acme University",
  "slug": "acme-university",
  "description": "Leading institution in technology education",
  "domain": "acme.edu",
  "subdomain": "acme",
  "industry": "education",
  "size": "large",
  "subscriptionPlan": "enterprise",
  "userLimit": 5000,
  "allowedDomains": ["acme.edu", "students.acme.edu"],
  "settings": {
    "branding": {
      "primaryColor": "#1e40af",
      "secondaryColor": "#3b82f6"
    },
    "features": {
      "enableReports": true,
      "enableAnalytics": true,
      "enableSSO": true
    }
  }
}

// Response
{
  "success": true,
  "data": {
    "organization": {
      "orgId": 1,
      "name": "Acme University",
      "slug": "acme-university",
      "description": "Leading institution in technology education",
      "domain": "acme.edu",
      "subdomain": "acme",
      "industry": "education",
      "size": "large",
      "subscriptionStatus": "active",
      "subscriptionPlan": "enterprise",
      "userLimit": 5000,
      "currentUserCount": 0,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "settings": {
        "branding": {
          "primaryColor": "#1e40af",
          "secondaryColor": "#3b82f6"
        }
      },
      "features": [
        "reports", "analytics", "sso", "api", "unlimited_courses"
      ]
    }
  },
  "message": "Organization created successfully"
}
```

#### `GET /organizations` 🔒 Super Admin
**List Organizations**
```typescript
// Query Parameters
?page=1&limit=20&status=active&size=large&search=university

// Response
{
  "success": true,
  "data": {
    "organizations": [
      {
        "orgId": 1,
        "name": "Acme University",
        "slug": "acme-university",
        "domain": "acme.edu",
        "industry": "education",
        "size": "large",
        "subscriptionStatus": "active",
        "subscriptionPlan": "enterprise",
        "userLimit": 5000,
        "currentUserCount": 2485,
        "utilizationRate": 49.7,
        "isActive": true,
        "createdAt": "2024-01-15T10:00:00Z",
        "lastActivity": "2024-01-20T14:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 8,
      "totalOrgs": 156,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalOrganizations": 156,
      "activeOrganizations": 142,
      "trialOrganizations": 28,
      "paidOrganizations": 114,
      "totalUsers": 45678,
      "averageUtilization": 67.3
    }
  }
}
```

#### `GET /organizations/:orgId` 🔒 Org Admin/Super Admin
**Get Organization Details**
```typescript
// Response
{
  "success": true,
  "data": {
    "organization": {
      "orgId": 1,
      "name": "Acme University",
      "slug": "acme-university",
      "description": "Leading institution in technology education",
      "domain": "acme.edu",
      "subdomain": "acme",
      "logoUrl": "https://cdn.trainpro.com/orgs/acme/logo.png",
      "website": "https://acme.edu",
      "industry": "education",
      "size": "large",
      "subscriptionStatus": "active",
      "subscriptionPlan": "enterprise",
      "subscriptionExpiry": "2024-12-31T23:59:59Z",
      "userLimit": 5000,
      "currentUserCount": 2485,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "settings": {
        "branding": {
          "primaryColor": "#1e40af",
          "secondaryColor": "#3b82f6",
          "logoUrl": "https://cdn.trainpro.com/orgs/acme/logo.png"
        },
        "features": {
          "enableReports": true,
          "enableAnalytics": true,
          "enableSSO": true,
          "enableAPI": true
        },
        "security": {
          "passwordPolicy": {
            "minLength": 12,
            "requireUppercase": true,
            "requireSpecialChars": true
          },
          "sessionTimeout": 8,
          "twoFactorRequired": true
        }
      },
      "features": [
        "reports", "analytics", "sso", "api", "unlimited_courses", 
        "priority_support", "custom_branding"
      ]
    },
    "statistics": {
      "totalUsers": 2485,
      "activeUsers": 1892,
      "totalCourses": 156,
      "totalTests": 1247,
      "totalAttempts": 89562,
      "storageUsed": "47.2 GB",
      "storageLimit": "500 GB"
    },
    "billing": {
      "currentPlan": "enterprise",
      "monthlyFee": 2500.00,
      "nextBillingDate": "2024-02-15T00:00:00Z",
      "paymentMethod": "credit_card",
      "billingContact": {
        "name": "Sarah Johnson",
        "email": "billing@acme.edu"
      }
    }
  }
}
```

#### `PUT /organizations/:orgId` 🔒 Org Admin/Super Admin
**Update Organization**
```typescript
// Request
{
  "name": "Acme University - Updated",
  "description": "Updated description with new programs",
  "logoUrl": "https://cdn.trainpro.com/orgs/acme/new-logo.png",
  "settings": {
    "branding": {
      "primaryColor": "#1e40af",
      "secondaryColor": "#3b82f6"
    },
    "features": {
      "enableReports": true,
      "enableAnalytics": true,
      "enableSSO": true,
      "enableAPI": true
    }
  }
}

// Response
{
  "success": true,
  "data": {
    "organization": { /* Updated organization details */ }
  },
  "message": "Organization updated successfully"
}
```

### Organization Analytics

#### `GET /organizations/:orgId/analytics` 🔒 Org Admin/Super Admin
**Get Organization Analytics**
```typescript
// Query Parameters
?timeframe=30days&includeUserActivity=true&includeCourseStats=true

// Response
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 2485,
      "activeUsers": 1892,
      "newUsersThisMonth": 156,
      "userGrowthRate": 6.7,
      "totalCourses": 156,
      "activeCourses": 134,
      "totalTestAttempts": 89562,
      "averageTestScore": 78.4
    },
    "userAnalytics": {
      "registrationTrend": [
        { "date": "2024-01-01", "newUsers": 45 },
        { "date": "2024-01-02", "newUsers": 52 },
        { "date": "2024-01-03", "newUsers": 38 }
      ],
      "activityMetrics": {
        "dailyActiveUsers": 847,
        "weeklyActiveUsers": 1456,
        "monthlyActiveUsers": 1892,
        "averageSessionDuration": "24 minutes"
      },
      "engagementMetrics": {
        "coursesPerUser": 3.2,
        "testsPerUser": 12.5,
        "completionRate": 73.8,
        "retentionRate": 82.4
      }
    },
    "courseAnalytics": {
      "totalEnrollments": 7956,
      "completionRate": 68.9,
      "averageRating": 4.3,
      "popularCourses": [
        {
          "courseId": 15,
          "title": "JavaScript Fundamentals",
          "enrollments": 456,
          "completionRate": 78.2
        }
      ]
    },
    "performanceMetrics": {
      "systemUptime": 99.97,
      "averageLoadTime": "1.2s",
      "errorRate": 0.03,
      "supportTickets": 23,
      "userSatisfaction": 4.6
    }
  }
}
```

#### `GET /organizations/:orgId/usage` 🔒 Org Admin/Super Admin
**Get Usage Statistics**
```typescript
// Response
{
  "success": true,
  "data": {
    "currentUsage": {
      "users": {
        "current": 2485,
        "limit": 5000,
        "utilization": 49.7,
        "warning": false
      },
      "storage": {
        "used": "47.2 GB",
        "limit": "500 GB",
        "utilization": 9.4,
        "warning": false
      },
      "apiCalls": {
        "thisMonth": 125847,
        "limit": 1000000,
        "utilization": 12.6,
        "warning": false
      },
      "bandwidth": {
        "thisMonth": "2.3 TB",
        "limit": "10 TB",
        "utilization": 23.0,
        "warning": false
      }
    },
    "historicalUsage": [
      {
        "month": "2024-01",
        "users": 2485,
        "storage": 47.2,
        "apiCalls": 125847,
        "bandwidth": 2.3
      }
    ],
    "projectedUsage": {
      "users": {
        "nextMonth": 2687,
        "nextQuarter": 3045,
        "willExceedLimit": false
      },
      "storage": {
        "nextMonth": 52.1,
        "nextQuarter": 63.8,
        "willExceedLimit": false
      }
    },
    "recommendations": [
      "Consider upgrading storage plan in 6 months",
      "API usage is well within limits",
      "User growth trending positively"
    ]
  }
}
```

### Organization Settings

#### `PUT /organizations/:orgId/settings` 🔒 Org Admin
**Update Organization Settings**
```typescript
// Request
{
  "branding": {
    "primaryColor": "#2563eb",
    "secondaryColor": "#3b82f6",
    "logoUrl": "https://cdn.trainpro.com/orgs/acme/logo-updated.png"
  },
  "features": {
    "enableReports": true,
    "enableAnalytics": true,
    "enableSSO": true,
    "enableAPI": true
  },
  "security": {
    "passwordPolicy": {
      "minLength": 14,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSpecialChars": true
    },
    "sessionTimeout": 6,
    "twoFactorRequired": true
  }
}

// Response
{
  "success": true,
  "data": {
    "settings": { /* Updated settings */ }
  },
  "message": "Organization settings updated successfully"
}
```

#### `POST /organizations/:orgId/sso` 🔒 Org Admin
**Configure SSO**
```typescript
// Request
{
  "provider": "saml",
  "entityId": "acme-university",
  "ssoUrl": "https://sso.acme.edu/saml/login",
  "x509Certificate": "-----BEGIN CERTIFICATE-----...",
  "attributeMapping": {
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
  },
  "isEnabled": true
}

// Response
{
  "success": true,
  "data": {
    "ssoConfig": {
      "provider": "saml",
      "entityId": "acme-university",
      "isEnabled": true,
      "testUrl": "https://trainpro.com/sso/test/acme-university"
    }
  },
  "message": "SSO configuration updated successfully"
}
```

### Organization Operations

#### `POST /organizations/:orgId/activate` 🔒 Super Admin
**Activate Organization**
```typescript
// Response
{
  "success": true,
  "data": {
    "organization": {
      "orgId": 1,
      "isActive": true,
      "activatedAt": "2024-01-15T16:30:00Z"
    }
  },
  "message": "Organization activated successfully"
}
```

#### `POST /organizations/:orgId/deactivate` 🔒 Super Admin
**Deactivate Organization**
```typescript
// Request
{
  "reason": "Non-payment",
  "gracePeriodDays": 7,
  "notifyUsers": true
}

// Response
{
  "success": true,
  "data": {
    "organization": {
      "orgId": 1,
      "isActive": false,
      "deactivatedAt": "2024-01-15T16:30:00Z",
      "gracePeriodEnds": "2024-01-22T16:30:00Z"
    }
  },
  "message": "Organization deactivated successfully"
}
```

## 🔧 Service Layer

### OrganizationService Core Methods

#### Organization CRUD Operations
```typescript
// Create organization
async createOrganization(createOrgDto: CreateOrganizationDto): Promise<Organization>

// Find organization by ID
async findById(orgId: number): Promise<Organization | null>

// Find organization by slug
async findBySlug(slug: string): Promise<Organization | null>

// Update organization
async updateOrganization(orgId: number, updateOrgDto: UpdateOrganizationDto): Promise<Organization>

// Delete organization
async deleteOrganization(orgId: number): Promise<void>

// List organizations with filtering
async findAll(filters: OrganizationFilterDto): Promise<PaginatedOrganizations>
```

#### Organization Management
```typescript
// Activate organization
async activateOrganization(orgId: number): Promise<Organization>

// Deactivate organization
async deactivateOrganization(orgId: number, reason: string): Promise<Organization>

// Update subscription
async updateSubscription(orgId: number, subscriptionData: SubscriptionDto): Promise<Organization>

// Check feature access
async hasFeature(orgId: number, feature: string): Promise<boolean>

// Get organization limits
async getOrganizationLimits(orgId: number): Promise<OrganizationLimits>
```

#### Analytics & Reporting
```typescript
// Get organization analytics
async getOrganizationAnalytics(orgId: number, timeframe: string): Promise<OrganizationAnalytics>

// Get usage statistics
async getUsageStatistics(orgId: number): Promise<UsageStatistics>

// Generate usage report
async generateUsageReport(orgId: number, format: string): Promise<ReportData>

// Calculate billing metrics
async calculateBillingMetrics(orgId: number): Promise<BillingMetrics>
```

### Settings & Configuration

#### Settings Management
```typescript
// Update organization settings
async updateSettings(orgId: number, settings: OrganizationSettings): Promise<Organization>

// Configure SSO
async configureSSOSSO(orgId: number, ssoConfig: SSOConfig): Promise<Organization>

// Manage API keys
async generateApiKey(orgId: number, keyName: string): Promise<string>

// Update branding
async updateBranding(orgId: number, branding: BrandingConfig): Promise<Organization>
```

#### User & Access Management
```typescript
// Add user to organization
async addUser(orgId: number, userId: string, role: string): Promise<void>

// Remove user from organization
async removeUser(orgId: number, userId: string): Promise<void>

// Update user role
async updateUserRole(orgId: number, userId: string, role: string): Promise<void>

// Get organization users
async getOrganizationUsers(orgId: number, filters: UserFilterDto): Promise<User[]>
```

## 🔄 Integration Points

### User Module Integration
```typescript
// Validate user organization access
async validateUserAccess(userId: string, orgId: number): Promise<boolean>

// Get user organization permissions
async getUserPermissions(userId: string, orgId: number): Promise<string[]>

// Sync organization users
async syncOrganizationUsers(orgId: number): Promise<void>

// Handle user organization transfer
async transferUser(userId: string, fromOrgId: number, toOrgId: number): Promise<void>
```

### Billing Integration
```typescript
// Process subscription payment
async processSubscriptionPayment(orgId: number, paymentData: PaymentData): Promise<void>

// Update billing information
async updateBillingInfo(orgId: number, billingInfo: BillingInfo): Promise<void>

// Handle subscription expiry
async handleSubscriptionExpiry(orgId: number): Promise<void>

// Generate invoice
async generateInvoice(orgId: number, period: BillingPeriod): Promise<Invoice>
```

### Communications Integration
```typescript
// Send organization notifications
async sendOrganizationNotifications(orgId: number, notification: NotificationData): Promise<void>

// Handle subscription alerts
async handleSubscriptionAlerts(orgId: number, alertType: string): Promise<void>

// Send usage warnings
async sendUsageWarnings(orgId: number, usageType: string): Promise<void>
```

## 🔒 Access Control & Permissions

### Organization Permissions
```typescript
export enum OrganizationPermission {
    VIEW = 'org:view',
    UPDATE = 'org:update',
    DELETE = 'org:delete',
    MANAGE_USERS = 'org:manage_users',
    MANAGE_BILLING = 'org:manage_billing',
    MANAGE_SETTINGS = 'org:manage_settings',
    VIEW_ANALYTICS = 'org:view_analytics',
}
```

### Multi-Tenant Data Isolation
```typescript
// Automatic organization scoping
async findOrganizationData<T>(orgId: number, entityType: string): Promise<T[]> {
    return this.entityRepository.find({
        where: { orgId: { id: orgId } },
        relations: ['org']
    });
}
```

## 🔮 Future Enhancements

### Planned Features
1. **Advanced SSO Integration**: OIDC, OAuth2, and custom providers
2. **Organization Hierarchies**: Complex multi-level organization structures
3. **Advanced Analytics**: AI-powered insights and predictions
4. **Marketplace Integration**: Third-party app and integration management
5. **Advanced Compliance**: Enhanced GDPR, FERPA, and SOC2 compliance tools

### Scalability Improvements
- **Microservices Architecture**: Distributed organization management
- **Event-Driven Updates**: Real-time organization state synchronization
- **Advanced Caching**: Multi-tier organization data caching
- **Auto-scaling**: Dynamic resource allocation based on organization size

---

This Organization module provides comprehensive multi-tenant enterprise management with enterprise-grade features including subscription management, advanced analytics, security controls, and scalability optimizations for effective organizational administration.
