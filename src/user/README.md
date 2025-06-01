# 👤 User Management Module

## Overview

The User Management Module is the core user operations center of the trainpro platform, handling comprehensive user profile management, organization/branch assignments, avatar management, caching strategies, and user lifecycle operations. This module provides robust user CRUD operations with enterprise-grade features including soft deletes, caching, and multi-tenant organization support.

## 🏗️ Architecture

```
user/
├── user.controller.ts          # REST API endpoints for user operations
├── user.service.ts            # Core business logic with caching
├── user.module.ts             # Module configuration & dependencies
├── entities/                  # Database entities
│   └── user.entity.ts        # User entity with relationships
├── dto/                      # Data Transfer Objects
│   ├── create-user.dto.ts    # User creation validation
│   ├── update-user.dto.ts    # User update validation
│   ├── sign-in.dto.ts        # Authentication credentials
│   ├── change-password.dto.ts # Password change validation
│   ├── verify-email.dto.ts   # Email verification
│   ├── refresh-token.dto.ts  # Token refresh
│   ├── resend-verification.dto.ts # Verification resend
│   ├── assign-org-branch.dto.ts # Organization assignment
│   └── session-response.dto.ts # API response formats
└── interfaces/               # TypeScript interfaces
    └── user-response.interface.ts
```

## 🎯 Core Features

### User Profile Management

- **Complete CRUD Operations** with validation and security
- **Avatar Management** with multiple image variants
- **Profile Updates** with real-time cache invalidation
- **Password Management** with secure hashing and history
- **Email Verification** with automated workflows

### Organization & Multi-Tenancy

- **Organization Assignment** with automatic scoping
- **Branch Management** for departmental structures
- **Role-Based Access** with hierarchical permissions
- **Invitation-Based Onboarding** with pre-assignments
- **Data Isolation** by organization and branch

### Performance & Caching

- **Redis-Based Caching** for frequently accessed user data
- **Cache Invalidation** strategies for data consistency
- **Optimized Queries** with selective loading and relationships
- **Bulk Operations** for administrative tasks
- **Event-Driven Updates** for real-time synchronization

### Data Security & Compliance

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

## 📚 API Endpoints

### User Profile Operations

#### `GET /users/profile` 🔒 Protected

**Get Current User Profile**

```typescript
// Response
{
  "success": true,
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
  }
}
```

#### `PUT /users/profile` 🔒 Protected

**Update User Profile**

```typescript
// Request
{
  "firstName": "John",
  "lastName": "Smith",
  "avatar": 456
}

// Response
{
  "success": true,
  "data": { /* Updated user profile */ },
  "message": "Profile updated successfully"
}
```

#### `POST /users/change-password` 🔒 Protected

**Change User Password**

```typescript
// Request
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}

// Response
{
  "success": true,
  "message": "Password changed successfully"
}
```

### User Management (Admin Operations)

#### `GET /users` 🔒 Admin Only

**List All Users with Filtering**

```typescript
// Query Parameters
?page=1&limit=20&search=john&role=user&status=active&orgId=org-123

// Response
{
  "success": true,
  "data": {
    "users": [
      { /* User objects */ }
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

#### `POST /users` 🔒 Admin Only

**Create New User**

```typescript
// Request
{
  "email": "newuser@example.com",
  "password": "TempPass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "user",
  "orgId": "org-uuid",
  "branchId": "branch-uuid"
}

// Response
{
  "success": true,
  "data": { /* Created user */ },
  "message": "User created successfully"
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

#### User CRUD Operations

```typescript
// Create user
async create(createUserDto: CreateUserDto): Promise<User>

// Find user by email with caching
async findByEmail(email: string): Promise<User | null>

// Find user by ID with optional relations
async findById(id: string, withRelations?: boolean): Promise<User | null>

// Update user profile with cache invalidation
async updateProfile(id: string, updateData: UpdateUserDto): Promise<User>

// Change password with security validation
async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void>

// Soft delete user
async softDelete(id: string): Promise<void>
```

#### Advanced User Operations

```typescript
// Find with full org/branch details
async findByEmailWithFullDetails(email: string): Promise<User | null>

// Assign organization and branch
async assignOrgAndBranch(userId: string, orgId?: string, branchId?: string): Promise<User>

// Bulk user operations
async bulkCreate(users: CreateUserDto[]): Promise<User[]>
async bulkUpdate(updates: Array<{id: string, data: UpdateUserDto}>): Promise<User[]>

// User search and filtering
async searchUsers(criteria: UserSearchCriteria): Promise<PaginatedUsers>

// Email verification
async verifyEmail(userId: string): Promise<void>
async updatePassword(userId: string, hashedPassword: string): Promise<void>
```

### Caching Strategy

#### Cache Keys Structure

```typescript
// User cache keys
USER_CACHE_KEY = 'user:email:${email}';
USER_ID_CACHE_KEY = 'user:id:${id}';
USER_STATS_CACHE_KEY = 'user:stats:${id}';

// Cache TTL (Time To Live)
USER_CACHE_TTL = 300; // 5 minutes
STATS_CACHE_TTL = 600; // 10 minutes
```

#### Cache Operations

```typescript
// Cache user data
async cacheUser(user: User): Promise<void>

// Get cached user
async getCachedUser(email: string): Promise<User | null>

// Invalidate user cache
async invalidateUserCache(userId: string, email: string): Promise<void>

// Batch cache operations
async batchCacheUsers(users: User[]): Promise<void>
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

### Avatar Variants

```typescript
export interface AvatarResponse {
    id: number;
    originalName?: string;
    url: string; // Primary URL
    thumbnail: string; // Small variant (150x150)
    medium: string; // Medium variant (300x300)
    original: string; // Full size
}
```

### Avatar Upload Process

1. **Upload to MediaManager**: File uploaded and processed
2. **Generate Variants**: Thumbnail and medium sizes created
3. **Update User Record**: Avatar ID assigned to user
4. **Cache Invalidation**: User cache cleared
5. **Response**: New avatar URLs returned

## 🔄 Data Relationships

### User Relationships

```typescript
// User → Organization (Many-to-One)
user.orgId → Organization

// User → Branch (Many-to-One)
user.branchId → Branch

// User → MediaFile (Many-to-One)
user.avatar → MediaFile

// User → Courses (One-to-Many)
user.createdCourses → Course[]

// User → Test Attempts (One-to-Many)
user.testAttempts → TestAttempt[]

// User → Results (One-to-Many)
user.results → Result[]
```

### Query Optimization

```typescript
// Efficient user loading with selective relations
const user = await userRepository.findOne({
    where: { id: userId },
    relations: ['avatar', 'avatar.variants', 'orgId', 'branchId'],
    select: {
        // Exclude password from selection
        password: false,
    },
});
```

## 📊 Performance Optimizations

### Database Indexes

```sql
-- Performance optimization indexes
CREATE INDEX IDX_USER_EMAIL ON users(email);
CREATE INDEX IDX_USER_STATUS ON users(status);
CREATE INDEX IDX_USER_ORG ON users(orgId);
CREATE INDEX IDX_USER_BRANCH ON users(branchId);
CREATE INDEX IDX_USER_CREATED_AT ON users(createdAt);
CREATE INDEX IDX_USER_NAME_SEARCH ON users(firstName, lastName);
```

### Caching Strategy

- **User Profile Cache**: 5-minute TTL for frequently accessed profiles
- **Statistics Cache**: 10-minute TTL for user performance data
- **Search Results Cache**: 2-minute TTL for user search queries
- **Organization Lists Cache**: 15-minute TTL for org/branch user lists

### Query Optimizations

- **Selective Loading**: Only load required relations
- **Pagination**: Efficient pagination with cursor-based loading
- **Bulk Operations**: Batch database operations for efficiency
- **Connection Pooling**: Optimized database connection management

## 🔗 Dependencies

### Internal Dependencies

- **AuthModule**: Authentication integration
- **MediaManagerModule**: Avatar and file management
- **OrganizationModule**: Organization data
- **BranchModule**: Branch data
- **LeaderboardModule**: User statistics

### External Dependencies

- **TypeORM**: Database ORM and entity management
- **class-validator**: Input validation
- **class-transformer**: Data transformation
- **bcrypt**: Password hashing
- **cache-manager**: Caching implementation

## 🚀 Usage Examples

### Basic User Operations

```typescript
// Create new user
const user = await userService.create({
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
});

// Find user with caching
const foundUser = await userService.findByEmail('user@example.com');

// Update user profile
const updatedUser = await userService.updateProfile(user.id, {
    firstName: 'Jonathan',
    avatar: 456,
});

// Change password
await userService.changePassword(user.id, 'SecurePass123!', 'NewPassword456!');
```

### Organization Assignment

```typescript
// Assign user to organization and branch
const assignedUser = await userService.assignOrgAndBranch(
    user.id,
    'org-uuid',
    'branch-uuid',
);

// Get users by organization
const orgUsers = await userService.findByOrganization('org-uuid');

// Get users by branch
const branchUsers = await userService.findByBranch('branch-uuid');
```

### Advanced Search and Filtering

```typescript
// Search users with criteria
const searchResults = await userService.searchUsers({
  search: 'john',
  role: UserRole.USER,
  status: UserStatus.ACTIVE,
  orgId: 'org-uuid',
  page: 1,
  limit: 20
});

// Bulk operations
const newUsers = await userService.bulkCreate([
  { email: 'user1@example.com', ... },
  { email: 'user2@example.com', ... }
]);
```

## 🧪 Testing Strategy

### Unit Tests

- **Service Method Testing**: All CRUD operations
- **Validation Testing**: DTO validation rules
- **Caching Testing**: Cache operations and invalidation
- **Security Testing**: Password handling and authentication

### Integration Tests

- **API Endpoint Testing**: All controller endpoints
- **Database Integration**: Entity relationships and constraints
- **Cache Integration**: Redis cache operations
- **Event System**: Event emission and handling

### Performance Tests

- **Load Testing**: High-volume user operations
- **Cache Performance**: Cache hit/miss ratios
- **Database Performance**: Query optimization verification
- **Memory Usage**: Memory efficiency testing

## 🔮 Future Enhancements

### Planned Features

1. **User Preferences**: Customizable user settings and preferences
2. **Profile Completion**: Progress tracking for profile setup
3. **Activity Logging**: Comprehensive user activity tracking
4. **Social Features**: User connections and following
5. **Advanced Search**: Elasticsearch integration for complex queries

### Scalability Improvements

- **Database Sharding**: User data distribution across databases
- **Read Replicas**: Separate read/write database connections
- **Microservice Architecture**: User service decomposition
- **Advanced Caching**: Multi-layer caching with Redis Cluster

### Security Enhancements

- **Multi-Factor Authentication**: Additional security layers
- **Session Management**: Advanced session control
- **Audit Logging**: Comprehensive security audit trails
- **Data Encryption**: Enhanced data protection

---

This User module provides comprehensive user management capabilities with enterprise-grade features including caching, multi-tenancy, security, and performance optimizations, serving as the foundation for all user-related operations in the trainpro platform.
