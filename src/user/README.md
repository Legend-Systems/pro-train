# 👤 User Management Module

## Overview

The User Management Module is the core user operations center of the trainpro platform, handling comprehensive user profile management, organization/branch assignments, avatar management, caching strategies, and user lifecycle operations. This module provides robust user CRUD operations with enterprise-grade features including soft deletes, **organization-scoped caching**, **standardized API responses**, **database retry mechanisms**, and multi-tenant organization support.

## 🔄 Recent Compliance Updates (2025)

### ✅ Module Standards Compliance

Following the comprehensive compliance review, this module has been updated to meet all platform standards:

#### **Enhanced Caching Strategy**

- **Organization/Branch Scoped Cache Keys**: All cache keys now include organization and branch context
- **Comprehensive Cache Coverage**: User profiles, lists, details, and avatar variants
- **Intelligent Cache Invalidation**: Automatic invalidation based on scope and data relationships
- **Performance Optimized**: Different TTL values for different data types

#### **Standardized API Responses**

- **Consistent Response Format**: All endpoints now use `StandardApiResponse` and `StandardOperationResponse`
- **Enhanced Error Handling**: Proper HTTP status codes and error messages
- **Comprehensive Documentation**: Swagger documentation with examples and detailed descriptions
- **Type-Safe Responses**: TypeScript interfaces for all response formats

#### **Database Resilience**

- **Retry Service Integration**: All database operations wrapped with retry logic
- **Error Recovery**: Automatic retry on transient database failures
- **Consistent Logging**: Structured logging throughout all operations

#### **Role-Based Access Control**

- **OrgRoleGuard Integration**: Organization-scoped role-based access control
- **Convenient Decorators**: `@AdminOnly()`, `@OwnerOrAdmin()`, `@BrandonOnly()`, `@AnyRole()`
- **Cross-Organization Access**: Configurable admin permissions across organizations
- **Business Logic Compliance**: Owners have full access within their organization

#### **Organization & Branch Scoping**

- **Scope-Aware Operations**: All user operations respect organization/branch boundaries
- **Access Control**: Users can only access data within their scope
- **Data Isolation**: Complete separation of data by organization and branch
- **🆕 Admin Visibility**: Brandon and Admin roles can view deleted users in addition to active users

## 🏗️ Architecture

```
user/
├── user.controller.ts          # REST API endpoints with scoped operations
├── user.service.ts            # Core business logic with enhanced caching & retry
├── user.module.ts             # Module configuration & dependencies
├── entities/                  # Database entities
│   └── user.entity.ts        # User entity with relationships
├── dto/                      # Data Transfer Objects
│   ├── create-user.dto.ts    # User creation validation
│   ├── update-user.dto.ts    # User update validation
│   ├── user-filter.dto.ts    # Advanced filtering options
│   ├── common-response.dto.ts # 🆕 Standardized response types
│   ├── sign-in.dto.ts        # Authentication credentials
│   ├── change-password.dto.ts # Password change validation
│   ├── verify-email.dto.ts   # Email verification
│   ├── refresh-token.dto.ts  # Token refresh
│   ├── resend-verification.dto.ts # Verification resend
│   └── assign-org-branch.dto.ts # Organization assignment
└── interfaces/               # TypeScript interfaces
    └── user-response.interface.ts
```

## 🎯 Core Features

### User Profile Management

- **Complete CRUD Operations** with validation, security, and **automatic retry**
- **Avatar Management** with multiple image variants and **scoped caching**
- **Profile Updates** with real-time cache invalidation across scopes
- **Password Management** with secure hashing and history
- **Email Verification** with automated workflows

### Organization & Multi-Tenancy

- **🆕 Scoped Operations** with automatic organization/branch context
- **🆕 Access Control Enforcement** via `@OrgBranchScope()` decorator
- **Organization Assignment** with automatic scoping
- **Branch Management** for departmental structures
- **Role-Based Access** with hierarchical permissions
- **Invitation-Based Onboarding** with pre-assignments
- **Data Isolation** by organization and branch

### Performance & Caching

- **🆕 Organization-Scoped Redis Caching** for data isolation
- **🆕 Enhanced Cache Key Structure** with org/branch context
- **Intelligent Cache Invalidation** strategies for data consistency
- **Optimized Queries** with selective loading and relationships
- **Bulk Operations** for administrative tasks
- **Event-Driven Updates** for real-time synchronization

### Data Security & Compliance

- **🆕 Database Retry Mechanisms** for improved reliability
- **🆕 Standardized Error Responses** with proper HTTP codes
- **Soft Delete** functionality for audit trails
- **Password Security** with bcrypt hashing
- **Data Validation** with comprehensive DTO validation
- **Privacy Protection** with password exclusion
- **Audit Logging** for user activities

## 📊 Database Schema

### User Entity

```typescript
@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    @Exclude({ toPlainOnly: true })
    password: string;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @ManyToOne(() => MediaFile)
    avatar?: MediaFile;

    @Column({ default: UserRole.USER })
    role?: UserRole;

    @Column({ default: false })
    emailVerified: boolean;

    @Column({ default: UserStatus.ACTIVE })
    status: UserStatus;

    @ManyToOne(() => Organization)
    orgId?: Organization;

    @ManyToOne(() => Branch)
    branchId?: Branch;

    // Relationships
    @OneToMany(() => Course, 'creator')
    createdCourses: Course[];

    @OneToMany(() => TestAttempt, 'user')
    testAttempts: TestAttempt[];

    @OneToMany(() => Result, 'user')
    results: Result[];
}
```

### User Roles

```typescript
export enum UserRole {
    BRANDON = 'brandon', // Super admin access
    OWNER = 'owner', // Organization owner
    ADMIN = 'admin', // Organization admin
    USER = 'user', // Regular user
}
```

### User Status

```typescript
export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    DELETED = 'deleted',
    SUSPENDED = 'suspended',
}
```

## �� API Endpoints

### 🆕 Standardized Response Format

All endpoints now return consistent `StandardResponse<T>` format:

```typescript
// Standard Response Format (used across all endpoints)
{
  "success": boolean,
  "message": string,
  "data": T
}

// Examples:
// User Creation Response
{
  "success": true,
  "message": "User created successfully",
  "data": { "email": "user@example.com" }
}

// User List Response
{
  "success": true,
  "message": "Users retrieved successfully", 
  "data": {
    "users": [...],
    "pagination": { "currentPage": 1, "totalPages": 5, "totalUsers": 95, "hasNext": true, "hasPrev": false }
  }
}

// User Profile Response
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": { /* UserProfile object */ }
}
```

### User Profile Operations

#### `GET /user/profile` 🔒 Protected

**Get Current User Profile with Enhanced Caching**

```typescript
// Response with standardized format
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "uid": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": {
      "id": 123,
      "url": "https://cdn.example.com/avatar.jpg",
      "thumbnail": "https://cdn.example.com/avatar_thumb.jpg",
      "medium": "https://cdn.example.com/avatar_medium.jpg"
    },
    "role": "user",
    "emailVerified": true,
    "status": "active",
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "meta": {
    "timestamp": "2025-01-16T12:00:00Z"
  }
}
```

#### `PUT /user/profile` 🔒 Protected

**Update User Profile with Scoped Cache Invalidation**

```typescript
// Request
{
  "firstName": "John",
  "lastName": "Smith",
  "avatar": 456
}

// Standardized Response
{
  "message": "Profile updated successfully",
  "status": "success",
  "code": 200
}
```

### 🆕 Organization-Scoped User Management

#### `GET /user` 🔒 Protected with Scope

**List Users with Organization/Branch Filtering**

```typescript
// Query Parameters with scope awareness
?page=1&limit=20&search=john&role=user&status=active

// Enhanced Response with scope context
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      { /* User objects with scope-aware data */ }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 95,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "meta": {
    "scope": {
      "orgId": "org-123",
      "branchId": "branch-456"
    },
    "timestamp": "2025-01-16T12:00:00Z"
  }
}
```

#### `POST /user` 🔒 Admin Only with Scope

**Create New User with Automatic Scope Assignment**

```typescript
// Request (organization/branch automatically assigned from scope)
{
  "email": "newuser@example.com",
  "password": "TempPass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "user"
}

// Standardized Response
{
  "message": "User created successfully",
  "status": "success",
  "code": 201
}
```

### 🔐 Role-Protected User Management

#### `POST /user` 🔒 @AdminOnly() - Same Organization, Cross-Branch Access

**Create New User with Organization Scope**

Creates users in the same organization with automatic scope assignment. Supports cross-branch user creation for admins and owners.

```typescript
// Request (organization/branch automatically assigned from admin's scope)
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "user"
}

// StandardResponse
{
  "success": true,
  "message": "User created successfully",
  "data": { "email": "newuser@example.com" }
}
```

**Access Control:**
- **Brandon**: Can create users in any organization/branch
- **Admin**: Can create users within their organization (any branch)
- **Owner**: Can create users within their organization (any branch)
- **User**: Cannot create users

#### `GET /user/admin/all` 🔒 @AdminOnly(true) - Cross-Organization Access

**List All Users with Advanced Filtering**

Provides comprehensive user listing with role-based visibility. Deleted users are visible to Brandon and Admin roles only.

```typescript
// Query Parameters  
?page=1&limit=20&search=john&role=user&status=active

// StandardResponse with Pagination
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      { /* User objects with organization/branch context */ }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalUsers": 95,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Visibility Rules:**
- **Brandon**: Can see all users across all organizations (including deleted)
- **Admin**: Can see all users across all organizations (including deleted)
- **Owner**: Can see users within their organization only
- **User**: Can see active users within their organization only

#### `GET /user/admin/:id` 🔒 @OwnerOrAdmin(true) - Cross-Organization Access

**Get Specific User Details**

Retrieves detailed user information with organization/branch context.

```typescript
// StandardResponse
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "status": "active",
    "organization": { /* Organization details */ },
    "branch": { /* Branch details */ },
    "createdAt": "2025-01-01T00:00:00Z"
  }
}
```

**Access Control:**
- **Brandon**: Can view any user globally
- **Admin**: Can view any user globally
- **Owner**: Can view users within their organization
- **User**: Cannot access this endpoint

#### `PUT /user/admin/:id` 🔒 @OwnerOrAdmin() - Same Organization Only

**Update User Details**

Updates user information within organizational boundaries with cross-branch support.

```typescript
// Request
{
  "firstName": "Jane", 
  "lastName": "Smith",
  "role": "admin"
}

// StandardResponse
{
  "success": true,
  "message": "User updated successfully",
  "data": { "id": "user-uuid", "email": "user@example.com" }
}
```

**Access Control:**
- **Brandon**: Can edit any user globally
- **Admin**: Can edit users within their organization (cross-branch)
- **Owner**: Can edit users within their organization (cross-branch)

#### `DELETE /user/admin/:id` 🔒 @AdminOnly() - Same Organization Only

**Soft Delete User**

Performs soft deletion maintaining audit trail with scope enforcement.

```typescript
// StandardResponse
{
  "success": true,
  "message": "User deleted successfully", 
  "data": { "id": "user-uuid", "deletedBy": "admin-uuid" }
}
```

**Access Control:**
- **Brandon**: Can delete any user globally
- **Admin**: Can delete users within their organization (cross-branch)
- **Owner**: Cannot delete users (unless also admin)

#### `GET /user/admin/deleted` 🔒 @AdminOnly(true) - Cross-Organization Access

**Get Deleted Users**

Retrieves soft-deleted users for audit and restoration purposes.

```typescript
// StandardResponse
{
  "success": true,
  "message": "Deleted users retrieved successfully",
  "data": {
    "users": [
      { /* Deleted user objects with deletion metadata */ }
    ],
    "count": 5
  }
}
```

**Access Control:**
- **Brandon**: Can view deleted users globally
- **Admin**: Can view deleted users globally
- **Owner/User**: Cannot access deleted users

#### `PATCH /user/admin/restore/:userId` 🔒 @AdminOnly(true) - Cross-Organization Access

**Restore Deleted User**

Restores soft-deleted user accounts with audit logging.

```typescript
// StandardResponse
{
  "success": true,
  "message": "User account restored successfully",
  "data": { "id": "user-uuid", "restoredBy": "admin-uuid" }
}
```

**Access Control:**
- **Brandon**: Can restore any deleted user globally
- **Admin**: Can restore any deleted user globally
- **Owner/User**: Cannot restore users

#### `GET /users/:id` 🔒 Admin Only

**Get Specific User Details**

```typescript
// Response
{
  "success": true,
  "data": {
    "user": { /* Full user details */ },
    "organization": { /* Org info if assigned */ },
    "branch": { /* Branch info if assigned */ },
    "statistics": {
      "coursesEnrolled": 5,
      "testsCompleted": 23,
      "averageScore": 87.5,
      "lastActivity": "2025-01-15T10:30:00Z"
    }
  }
}
```

#### `PUT /users/:id` 🔒 Admin Only

**Update User Details**

```typescript
// Request
{
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "admin",
  "status": "active"
}
```

#### `DELETE /users/:id` 🔒 Admin Only

**Soft Delete User**

```typescript
// Response
{
  "success": true,
  "message": "User deactivated successfully"
}
```

### Organization & Branch Management

#### `POST /users/:id/assign-org-branch` 🔒 Admin Only

**Assign User to Organization/Branch**

```typescript
// Request
{
  "organizationId": "org-uuid",
  "branchId": "branch-uuid"
}

// Response
{
  "success": true,
  "data": {
    "user": { /* Updated user */ },
    "organization": { /* Org details */ },
    "branch": { /* Branch details */ }
  },
  "message": "Organization and branch assigned successfully"
}
```

#### `GET /users/by-organization/:orgId` 🔒 Admin Only

**Get Users by Organization**

```typescript
// Response
{
  "success": true,
  "data": {
    "users": [
      { /* Users in organization */ }
    ],
    "organization": { /* Org details */ },
    "totalUsers": 15
  }
}
```

#### `GET /users/by-branch/:branchId` 🔒 Admin Only

**Get Users by Branch**

```typescript
// Response
{
  "success": true,
  "data": {
    "users": [
      { /* Users in branch */ }
    ],
    "branch": { /* Branch details */ },
    "totalUsers": 8
  }
}
```

### Email & Verification

#### `POST /users/verify-email`

**Verify Email Address**

```typescript
// Request
{
  "token": "verification-token"
}

// Response
{
  "success": true,
  "message": "Email verified successfully"
}
```

#### `POST /users/resend-verification`

**Resend Verification Email**

```typescript
// Request
{
  "email": "user@example.com"
}

// Response
{
  "success": true,
  "message": "Verification email sent"
}
```

### User Statistics & Analytics

#### `GET /users/:id/statistics` 🔒 Protected

**Get User Performance Statistics**

```typescript
// Response
{
  "success": true,
  "data": {
    "coursesEnrolled": 5,
    "coursesCompleted": 3,
    "testsCompleted": 23,
    "totalScore": 1250.5,
    "averageScore": 87.5,
    "bestScore": 98.5,
    "timeSpentLearning": "45h 30m",
    "achievements": [
      {
        "name": "Top Performer",
        "description": "Scored above 90% in 5 tests",
        "earnedAt": "2025-01-10T12:00:00Z"
      }
    ],
    "recentActivity": [
      {
        "type": "test_completed",
        "courseTitle": "JavaScript Fundamentals",
        "score": 95,
        "completedAt": "2025-01-15T10:30:00Z"
      }
    ]
  }
}
```

## 🔧 Service Layer

### UserService Core Methods

#### Enhanced CRUD Operations with Retry Logic

```typescript
// Create user with automatic retry and scope handling
async create(
    createUserDto: CreateUserDto,
    scope?: { orgId?: string; branchId?: string; userId: string },
): Promise<StandardOperationResponse>

// Find user by email with scoped caching
async findByEmail(
    email: string,
    scope?: { orgId?: string; branchId?: string },
): Promise<User | null>

// Find user by ID with optional relations and caching
async findById(id: string): Promise<User | null>

// Update user profile with scoped cache invalidation
async updateProfile(id: string, updateData: UpdateUserDto): Promise<StandardOperationResponse>

// Change password with security validation and retry
async changePassword(id: string, currentPassword: string, newPassword: string): Promise<StandardOperationResponse>

// Soft delete with scope-aware cache invalidation
async softDelete(userId: string, deactivatedBy?: string): Promise<StandardOperationResponse>
```

#### 🆕 Enhanced Organization & Cross-Branch Operations

```typescript
// Find with full org/branch details and scoped caching
async findByEmailWithFullDetails(email: string): Promise<User | null>

// Assign organization and branch with scope validation
async assignOrgAndBranch(userId: string, orgId?: string, branchId?: string): Promise<StandardOperationResponse>

// 🆕 Cross-branch user search with organization filtering and role-based visibility
async findAllWithFilters(
    filters: UserFilterDto,
    scope?: { 
        orgId?: string; 
        branchId?: string; // Optional - when omitted enables cross-branch access
        userId: string; 
        userRole?: string; // Enables deleted user visibility for brandon/admin
    },
): Promise<{ users: User[]; total: number; totalPages: number }>

// Organization-scoped user retrieval (all branches within org)
async findByOrganization(orgId: string): Promise<User[]>

// Branch-specific user retrieval (single branch only)
async findByBranch(branchId: string): Promise<User[]>
```

**Scope-Based Access Control:**
- **Same Organization, Cross-Branch**: Admins and Owners can access users across all branches within their organization
- **Branch-Specific**: When branchId is provided in scope, access is restricted to that specific branch
- **Global Access**: Brandon role bypasses all scope restrictions
- **Deleted User Visibility**: Only Brandon and Admin roles can see soft-deleted users

### 🆕 Enhanced Caching Strategy

#### Scope-Aware Cache Keys Structure

```typescript
// Organization and branch scoped cache keys
private readonly CACHE_KEYS = {
    USER_BY_ID: (id: string, orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:id:${id}`,
    USER_BY_EMAIL: (email: string, orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:email:${email}`,
    USERS_LIST: (filters: string, orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:users:list:${filters}`,
    USERS_BY_ORG: (orgId: string, filters: string, branchId?: string) =>
        `org:${orgId}:branch:${branchId || 'global'}:users:org:${filters}`,
    USERS_BY_BRANCH: (branchId: string, filters: string, orgId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId}:users:branch:${filters}`,
    USER_AVATAR_VARIANTS: (avatarId: number, orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:avatar:${avatarId}`,
    ALL_USERS: (orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:users:all`,
    USER_DETAIL: (id: string, orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:detail:${id}`,
};

// Optimized Cache TTL (Time To Live)
private readonly CACHE_TTL = {
    USER: 300, // 5 minutes
    USER_LIST: 180, // 3 minutes
    USER_DETAIL: 300, // 5 minutes
    AVATAR_VARIANTS: 600, // 10 minutes
    USERS_ALL: 900, // 15 minutes
};
```

#### 🆕 Intelligent Cache Operations

```typescript
// Scope-aware cache invalidation
private async invalidateUserCache(
    userId: string,
    email?: string,
    orgId?: string,
    branchId?: string,
): Promise<void>

// List cache invalidation with scope
private async invalidateUserListCaches(
    orgId?: string,
    branchId?: string,
): Promise<void>

// Dynamic cache key generation
private generateCacheKeyForUsers(
    filters?: UserFilterDto,
    prefix: string = 'list',
    orgId?: string,
    branchId?: string,
): string

// 🆕 Helper method to determine admin visibility for deleted users
private shouldIncludeDeleted(userRole?: string): boolean {
    return userRole === UserRole.BRANDON || userRole === UserRole.ADMIN;
}
```

### 🆕 Database Retry Integration

All database operations now use the `RetryService` for improved reliability:

```typescript
// Example usage in create operation
return this.retryService.executeDatabase(async () => {
    const user = this.userRepository.create(userToCreate);
    const savedUser = await this.userRepository.save(user);

    // Invalidate list caches since a new user was created
    await this.invalidateUserListCaches(scope?.orgId, scope?.branchId);

    return savedUser;
});
```

### Event System

#### User Events

```typescript
// Events emitted by UserService
USER_CREATED = 'user.created';
USER_UPDATED = 'user.updated';
USER_DELETED = 'user.deleted';
USER_EMAIL_VERIFIED = 'user.email.verified';
USER_PASSWORD_CHANGED = 'user.password.changed';
USER_ORG_ASSIGNED = 'user.organization.assigned';
```

#### Event Listeners

```typescript
// Example event handlers
@OnEvent('user.created')
async handleUserCreated(payload: { user: User }) {
  // Send welcome email
  // Create user statistics record
  // Initialize user preferences
}

@OnEvent('user.org.assigned')
async handleOrgAssignment(payload: { user: User, organization: Organization }) {
  // Update user permissions
  // Send org welcome email
  // Sync with external systems
}
```

## 🔒 Security & Validation

### 🆕 Organization/Branch Scope Validation

#### OrgBranchScope Decorator Integration

```typescript
// Automatic scope injection in controllers
async createUser(
    @Body() createUserDto: CreateUserDto,
    @OrgBranchScope() scope: { orgId?: string; branchId?: string; userId: string },
): Promise<StandardOperationResponse>

// Scope validation in service layer
async findAllWithFilters(
    filters: UserFilterDto,
    scope?: { orgId?: string; branchId?: string; userId: string },
): Promise<{ users: User[]; total: number; totalPages: number }>
```

#### Enhanced Access Control

- **Automatic Scope Enforcement**: Users can only access data within their organization/branch
- **Data Isolation**: Complete separation of cached and retrieved data by scope
- **Permission Validation**: Access control enforced at both controller and service levels

### Input Validation

#### CreateUserDto Validation

```typescript
export class CreateUserDto {
    @IsEmail()
    @MaxLength(255)
    email: string;

    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
    password: string;

    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName: string;

    @IsString()
    @MinLength(2)
    @MaxLength(50)
    lastName: string;

    @IsOptional()
    @IsNumber()
    avatar?: number;

    @IsOptional()
    @IsString()
    invitationToken?: string;
}
```

#### UpdateUserDto Validation

```typescript
export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    firstName?: string;

    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    lastName?: string;

    @IsOptional()
    @IsNumber()
    avatar?: number;
}
```

### Password Security

#### Password Change Validation

```typescript
export class ChangePasswordDto {
    @IsString()
    @MinLength(1)
    currentPassword: string;

    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/)
    newPassword: string;

    @IsString()
    @MinLength(8)
    confirmPassword: string;
}
```

#### Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **Password History**: Prevent reuse of recent passwords
- **Strong Password Policy**: Minimum complexity requirements
- **Current Password Verification**: Required for password changes
- **Password Exclusion**: Never included in API responses

## 🎭 Avatar Management

### 🆕 Scoped Avatar Caching

```typescript
export interface AvatarResponse {
    id: number;
    originalName?: string;
    url: string; // Primary URL
    thumbnail: string; // Small variant (150x150)
    medium: string; // Medium variant (300x300)
    original: string; // Full size
}

// Avatar cache with organization scope
private readonly CACHE_KEYS = {
    USER_AVATAR_VARIANTS: (avatarId: number, orgId?: string, branchId?: string) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:user:avatar:${avatarId}`,
};
```

### Avatar Upload Process

1. **Upload to MediaManager**: File uploaded and processed
2. **Generate Variants**: Thumbnail and medium sizes created
3. **Update User Record**: Avatar ID assigned to user
4. **Cache Invalidation**: User cache cleared
5. **Response**: New avatar URLs returned

## 📊 Performance Optimizations

### 🆕 Enhanced Database Indexes with Scope

```sql
-- Performance optimization indexes with scope support
CREATE INDEX IDX_USER_EMAIL ON users(email);
CREATE INDEX IDX_USER_STATUS ON users(status);
CREATE INDEX IDX_USER_ORG ON users(orgId);
CREATE INDEX IDX_USER_BRANCH ON users(branchId);
CREATE INDEX IDX_USER_ORG_BRANCH ON users(orgId, branchId); -- 🆕 Composite index
CREATE INDEX IDX_USER_CREATED_AT ON users(createdAt);
CREATE INDEX IDX_USER_NAME_SEARCH ON users(firstName, lastName);
CREATE INDEX IDX_USER_STATUS_ORG ON users(status, orgId); -- 🆕 Compound filtering
```

### 🆕 Advanced Caching Strategy

- **Scope-Aware Caching**: Organization and branch context in all cache keys
- **Intelligent Invalidation**: Selective cache clearing based on scope changes
- **Performance Tiers**: Different TTL values for different data access patterns
- **Memory Optimization**: Efficient cache key structure to prevent conflicts

### Query Optimizations

- **Scope-Filtered Queries**: Automatic organization/branch filtering
- **Selective Loading**: Only load required relations within scope
- **Pagination**: Efficient pagination with scope-aware cursor-based loading
- **Bulk Operations**: Batch database operations with retry logic
- **Connection Pooling**: Optimized database connection management

## 🔗 Dependencies

### 🆕 Enhanced Internal Dependencies

- **AuthModule**: Authentication integration with scope extraction
- **MediaManagerModule**: Avatar and file management with scoped caching
- **OrganizationModule**: Organization data and scope validation
- **BranchModule**: Branch data and access control
- **🆕 RetryService**: Database operation resilience
- **🆕 CommonModule**: Shared services and response types
- **LeaderboardModule**: User statistics with scope awareness

### External Dependencies

- **TypeORM**: Database ORM and entity management
- **class-validator**: Input validation
- **class-transformer**: Data transformation
- **bcrypt**: Password hashing
- **cache-manager**: Enhanced caching implementation
- **🆕 @nestjs/event-emitter**: Event system for scope-aware operations

## 🚀 Usage Examples

### 🆕 Scoped User Operations

```typescript
// Create user with automatic scope assignment
const scope = { orgId: 'org-123', branchId: 'branch-456', userId: 'admin-id', userRole: 'admin' };
const result = await userService.create(
    {
        email: 'user@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
    },
    scope,
);

// Find user with scope-aware caching
const foundUser = await userService.findByEmail('user@example.com', {
    orgId: 'org-123',
    branchId: 'branch-456',
});

// Scoped user filtering (regular user - only sees active users)
const activeUsers = await userService.findAllWithFilters(
    {
        search: 'john',
        status: 'active',
        page: 1,
        limit: 20,
    },
    { orgId: 'org-123', branchId: 'branch-456', userId: 'user-id', userRole: 'user' },
);

// 🆕 Admin user filtering - can see both active and deleted users
const allUsersForAdmin = await userService.findAllWithFilters(
    {
        search: 'john',
        // No status filter - admin sees both active and deleted
        page: 1,
        limit: 20,
    },
    { orgId: 'org-123', branchId: 'branch-456', userId: 'admin-id', userRole: 'admin' },
);

// 🆕 Admin can specifically query deleted users
const deletedUsersForAdmin = await userService.findAllWithFilters(
    {
        status: 'deleted',
        page: 1,
        limit: 20,
    },
    { orgId: 'org-123', branchId: 'branch-456', userId: 'admin-id', userRole: 'admin' },
);
```

### Basic User Operations with Retry

```typescript
// All operations now include automatic retry logic
const user = await userService.create({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
});

// Enhanced profile update with cache invalidation
const updateResult = await userService.updateProfile(user.id, {
    firstName: 'Jonathan',
    avatar: 456,
});

// Secure password change with retry
const passwordResult = await userService.changePassword(
    user.id,
    'SecurePass123!',
    'NewPassword456!',
);
```

## 🧪 Testing Strategy

### 🆕 Enhanced Testing Coverage

#### Unit Tests

- **Scope-Aware Service Testing**: All CRUD operations with organization/branch context
- **Cache Integration Testing**: Scoped cache operations and invalidation
- **Retry Logic Testing**: Database failure scenarios and recovery
- **Response Format Testing**: Standardized response structure validation

#### Integration Tests

- **Scoped API Endpoint Testing**: All controller endpoints with scope validation
- **Cross-Scope Access Testing**: Verify data isolation between organizations/branches
- **Cache Performance Testing**: Multi-tenant cache efficiency
- **Event System Testing**: Scope-aware event emission and handling

#### Performance Tests

- **Scoped Load Testing**: High-volume operations within organizational contexts
- **Cache Hit Ratio Testing**: Efficiency of scope-aware caching
- **Database Retry Testing**: Resilience under failure conditions
- **Memory Usage Testing**: Scope-aware cache memory efficiency

## 🔮 Future Enhancements

### Planned Features

1. **🆕 Advanced Scope Management**: Hierarchical organization structures
2. **🆕 Cross-Org Collaboration**: Controlled data sharing between organizations
3. **User Preferences**: Customizable user settings and preferences
4. **Profile Completion**: Progress tracking for profile setup
5. **Activity Logging**: Comprehensive user activity tracking with scope context
6. **Social Features**: User connections within organizational boundaries

### Scalability Improvements

- **🆕 Scope-Aware Database Sharding**: User data distribution by organization
- **🆕 Multi-Tenant Read Replicas**: Organization-specific read database connections
- **Microservice Architecture**: User service decomposition with scope preservation
- **Advanced Caching**: Multi-layer caching with Redis Cluster and scope awareness

### Security Enhancements

- **🆕 Enhanced Scope Validation**: Advanced organization/branch access controls
- **Multi-Factor Authentication**: Additional security layers with scope context
- **Session Management**: Advanced session control with organizational boundaries
- **Audit Logging**: Comprehensive security audit trails with scope tracking
- **Data Encryption**: Enhanced data protection with scope-aware encryption

---

## 📋 Compliance Checklist ✅

This module now fully complies with all platform standards:

- ✅ **Scope-Aware Caching**: Organization/branch context in all cache keys
- ✅ **Standardized Responses**: Consistent API response formats across all endpoints
- ✅ **Database Resilience**: Retry service integration for all database operations
- ✅ **Access Control**: Organization/branch scope enforcement with role-based visibility
- ✅ **Error Handling**: Proper HTTP status codes and error messages
- ✅ **Performance Optimization**: Enhanced caching and query strategies
- ✅ **Type Safety**: Comprehensive TypeScript interfaces and DTOs
- ✅ **Documentation**: Complete Swagger documentation with examples
- ✅ **Event System**: Scope-aware event emission for system integration
- ✅ **Security**: Enhanced validation and access control mechanisms

This User module provides comprehensive user management capabilities with enterprise-grade features including **organization-scoped caching**, **database resilience**, **standardized responses**, and **multi-tenant security**, serving as a compliant foundation for all user-related operations in the trainpro platform.
