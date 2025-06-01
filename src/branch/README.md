# 🏪 Branch Management Module

## Overview

The Branch Management Module provides comprehensive multi-location support for organizations within the trainpro platform, enabling distributed operations management, location-based access control, and hierarchical organizational structure support. This module handles branch creation, location management, operational settings, and provides the foundational infrastructure for multi-site educational and corporate training deployments.

## 🏗️ Architecture

```
branch/
├── branch.controller.ts        # REST API endpoints for branch operations
├── branch.service.ts          # Core business logic and data management
├── branch.module.ts           # Module configuration & dependencies
├── entities/                  # Database entities
│   └── branch.entity.ts      # Branch entity with organization relationships
├── dto/                      # Data Transfer Objects
│   ├── create-branch.dto.ts  # Branch creation validation
│   └── update-branch.dto.ts  # Branch modification validation
├── branch.controller.spec.ts # API endpoint tests
└── branch.service.spec.ts    # Service layer tests
```

## 🎯 Core Features

### Multi-Location Management
- **Branch Hierarchy** with organization-level scoping and management
- **Location Profiles** with detailed contact and operational information
- **Geographic Distribution** supporting global and regional deployments
- **Operational Hours** with customizable scheduling and availability
- **Manager Assignment** with contact and responsibility management

### Administrative Control
- **Branch Status Management** with activation and deactivation controls
- **Contact Management** with email, phone, and address information
- **Access Control Integration** with location-based permissions
- **Operational Settings** for branch-specific configurations
- **Audit Trails** with comprehensive change tracking

### Organization Integration
- **Multi-Tenant Support** with organization-scoped branch management
- **Hierarchical Structure** supporting complex organizational layouts
- **Cross-Branch Analytics** with centralized reporting and insights
- **Resource Allocation** with branch-specific resource management
- **Compliance Tracking** ensuring consistent standards across locations

## 📊 Database Schema

### Branch Entity
```typescript
@Entity('branches')
export class Branch {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    address?: string;

    @Column({ nullable: false, unique: true })
    email?: string;

    @Column({ nullable: true })
    contactNumber?: string;

    @Column({ default: true })
    isActive: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ nullable: true })
    managerName?: string;

    @Column({ type: 'json', nullable: true })
    operatingHours?: OperatingHours;

    @ManyToOne(() => Organization)
    organization: Organization;
}
```

### Operating Hours Interface
```typescript
export interface OperatingHours {
    opening: string;
    closing: string;
    days: string[];
}
```

## 📚 API Endpoints

### Branch Management

#### `GET /branches` 🔒 Protected
**Get All Branches**
```typescript
// Response
{
  "success": true,
  "message": "All branches retrieved successfully",
  "data": [
    {
      "id": "b1c2d3e4-f5g6-7890-bcde-fg1234567890",
      "name": "Medical Center Campus",
      "address": "450 Medical Plaza Drive, CA 90095",
      "contactNumber": "+1-310-825-9111",
      "email": "medcenter@university.edu",
      "managerName": "Dr. Sarah Johnson",
      "isActive": true,
      "operatingHours": {
        "opening": "08:00",
        "closing": "18:00",
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      },
      "organization": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "Stanford University",
        "isActive": true
      },
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

#### `GET /branches/:id` 🔒 Protected
**Get Branch by ID**
```typescript
// Response
{
  "success": true,
  "message": "Branch retrieved successfully",
  "data": {
    "branch": {
      "id": "b1c2d3e4-f5g6-7890-bcde-fg1234567890",
      "name": "Medical Center Campus",
      "address": "450 Medical Plaza Drive, CA 90095",
      "contactNumber": "+1-310-825-9111",
      "email": "medcenter@university.edu",
      "managerName": "Dr. Sarah Johnson",
      "isActive": true,
      "operatingHours": {
        "opening": "08:00",
        "closing": "18:00",
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      },
      "organization": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "Stanford University",
        "type": "educational",
        "isActive": true,
        "totalBranches": 8
      },
      "createdAt": "2025-01-01T00:00:00.000Z",
      "statistics": {
        "totalUsers": 1250,
        "activeCourses": 45,
        "completedTests": 3420,
        "averageScore": 84.2
      }
    }
  }
}
```

#### `PUT /branches/:id` 🔒 Protected
**Update Branch**
```typescript
// Request
{
  "name": "Updated Medical Center Campus",
  "address": "450 Medical Plaza Drive, Suite 200, CA 90095",
  "contactNumber": "+1-310-825-9111",
  "email": "medcenter@university.edu",
  "managerName": "Dr. Sarah Johnson",
  "isActive": true,
  "operatingHours": {
    "opening": "07:30",
    "closing": "19:00",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  }
}

// Response
{
  "success": true,
  "message": "Branch updated successfully",
  "data": {
    "branch": {
      "id": "b1c2d3e4-f5g6-7890-bcde-fg1234567890",
      "name": "Updated Medical Center Campus",
      "address": "450 Medical Plaza Drive, Suite 200, CA 90095",
      "contactNumber": "+1-310-825-9111",
      "email": "medcenter@university.edu",
      "managerName": "Dr. Sarah Johnson",
      "isActive": true,
      "operatingHours": {
        "opening": "07:30",
        "closing": "19:00",
        "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      },
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    "changes": {
      "modifiedFields": ["name", "address", "operatingHours"],
      "timestamp": "2025-01-15T10:30:00.000Z",
      "modifiedBy": "admin@university.edu"
    }
  }
}
```

#### `DELETE /branches/:id` 🔒 Protected
**Delete Branch**
```typescript
// Response
{
  "success": true,
  "message": "Branch deleted successfully",
  "data": {
    "deletedBranch": {
      "id": "b1c2d3e4-f5g6-7890-bcde-fg1234567890",
      "name": "Medical Center Campus",
      "organization": "Stanford University"
    },
    "deletionInfo": {
      "deletedAt": "2025-01-15T10:30:00.000Z",
      "deletedBy": "admin@university.edu",
      "reason": "Branch consolidation",
      "dataRetention": "90 days"
    },
    "impact": {
      "affectedUsers": 1250,
      "relocatedUsers": 1250,
      "newBranchAssignment": "Main Campus",
      "migratedData": {
        "courses": 45,
        "testResults": 3420,
        "userProgress": 1250
      }
    }
  }
}
```

## 🔧 Service Layer

### BranchService Core Methods

#### Branch CRUD Operations
```typescript
// Find all branches
async findAll(): Promise<Branch[]>

// Find branch by ID
async findOne(id: string): Promise<Branch | null>

// Update branch
async update(id: string, updateBranchDto: UpdateBranchDto): Promise<Branch>

// Remove branch
async remove(id: string): Promise<{ success: boolean; message: string }>

// Find branches by organization
async findByOrganization(organizationId: string): Promise<Branch[]>
```

#### Branch Management Operations
```typescript
// Activate/Deactivate branch
async toggleBranchStatus(id: string, isActive: boolean): Promise<Branch>

// Update operating hours
async updateOperatingHours(id: string, hours: OperatingHours): Promise<Branch>

// Update manager
async updateManager(id: string, managerName: string): Promise<Branch>

// Get branch statistics
async getBranchStatistics(id: string): Promise<BranchStatistics>
```

#### Branch Validation
```typescript
// Validate branch exists
async validateBranchExists(id: string): Promise<boolean>

// Check branch is active
async isBranchActive(id: string): Promise<boolean>

// Validate branch access for user
async validateBranchAccess(branchId: string, userId: string): Promise<boolean>

// Check branch capacity
async checkBranchCapacity(id: string): Promise<CapacityInfo>
```

## 🔄 Integration Points

### Organization Module Integration
```typescript
// Get organization for branch
async getBranchOrganization(branchId: string): Promise<Organization>

// Validate organization ownership
async validateOrganizationOwnership(branchId: string, orgId: string): Promise<boolean>

// Get organization branches
async getOrganizationBranches(orgId: string): Promise<Branch[]>
```

### User Module Integration
```typescript
// Get branch users
async getBranchUsers(branchId: string): Promise<User[]>

// Assign user to branch
async assignUserToBranch(userId: string, branchId: string): Promise<void>

// Transfer user between branches
async transferUserBranch(userId: string, fromBranch: string, toBranch: string): Promise<void>
```

### Course Module Integration
```typescript
// Get branch courses
async getBranchCourses(branchId: string): Promise<Course[]>

// Check course availability for branch
async isCourseAvailableForBranch(courseId: number, branchId: string): Promise<boolean>

// Get branch-specific course settings
async getBranchCourseSettings(branchId: string, courseId: number): Promise<CourseSettings>
```

## 🔒 Access Control & Permissions

### Branch Permissions
```typescript
export enum BranchPermission {
    VIEW = 'branch:view',
    CREATE = 'branch:create',
    UPDATE = 'branch:update',
    DELETE = 'branch:delete',
    MANAGE_USERS = 'branch:manage_users',
    VIEW_ANALYTICS = 'branch:view_analytics',
}
```

### Data Scoping
```typescript
// Automatic scoping based on organization/branch
async findUserAccessibleBranches(userId: string): Promise<Branch[]> {
    const userScope = await this.getUserScope(userId);
    return this.branchRepository.find({
        where: {
            organization: { id: userScope.organizationId },
            isActive: true
        },
        relations: ['organization']
    });
}
```

## 📊 Performance Optimizations

### Database Indexes
```sql
-- Branch performance indexes
CREATE INDEX IDX_BRANCH_NAME ON branches(name);
CREATE INDEX IDX_BRANCH_ACTIVE ON branches(isActive);
CREATE INDEX IDX_BRANCH_ORG ON branches(organization);
CREATE INDEX IDX_BRANCH_CREATED_AT ON branches(createdAt);

-- Compound indexes for common queries
CREATE INDEX IDX_BRANCH_ORG_ACTIVE ON branches(organization, isActive);
CREATE INDEX IDX_BRANCH_NAME_ORG ON branches(name, organization);
```

### Caching Strategy
```typescript
// Cache keys
BRANCH_CACHE_PREFIX = 'branch:'
BRANCH_ORG_CACHE_PREFIX = 'branch_org:'
BRANCH_USERS_CACHE_PREFIX = 'branch_users:'

// Cache operations
async getCachedBranch(id: string): Promise<Branch | null>
async cacheBranchData(branch: Branch): Promise<void>
async invalidateBranchCache(id: string): Promise<void>
```

## 🧪 Testing Strategy

### Unit Tests
- **Service Method Testing**: All CRUD operations and business logic
- **Validation Testing**: Input validation and business rules
- **Integration Testing**: Organization and user relationships
- **Performance Testing**: Query optimization and caching

### Integration Tests
- **API Endpoint Testing**: All controller endpoints
- **Database Integration**: Entity relationships and constraints
- **Organization Integration**: Multi-tenant data isolation
- **Permission Testing**: Access control and authorization

## 🔗 Dependencies

### Internal Dependencies
- **OrganizationModule**: Parent organization management
- **UserModule**: User assignment and management
- **AuthModule**: Authentication and authorization
- **CommonModule**: Shared utilities and services

### External Dependencies
- **TypeORM**: Database ORM and query building
- **class-validator**: Input validation and sanitization
- **class-transformer**: Data transformation and serialization
- **@nestjs/swagger**: API documentation generation

## 🚀 Usage Examples

### Basic Branch Operations
```typescript
// Get all branches
const branches = await branchService.findAll();

// Get specific branch
const branch = await branchService.findOne(branchId);

// Update branch
const updatedBranch = await branchService.update(branchId, {
    name: 'Updated Branch Name',
    managerName: 'New Manager'
});
```

### Branch Management
```typescript
// Toggle branch status
await branchService.toggleBranchStatus(branchId, false);

// Update operating hours
await branchService.updateOperatingHours(branchId, {
    opening: '08:00',
    closing: '18:00',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
});

// Get branch statistics
const stats = await branchService.getBranchStatistics(branchId);
```

## 🔮 Future Enhancements

### Planned Features
1. **Geographic Services**: Map integration and location-based features
2. **Capacity Management**: Advanced resource and space management
3. **Branch Analytics**: Detailed performance and utilization metrics
4. **Mobile Support**: Mobile branch management applications
5. **Integration APIs**: Third-party system integrations

### Scalability Improvements
- **Multi-Region Support**: Global branch distribution
- **Advanced Caching**: Redis-based distributed caching
- **Real-time Updates**: WebSocket-based live updates
- **Microservice Architecture**: Service decomposition for scale

---

This Branch Management module provides comprehensive multi-location support with enterprise-grade features including hierarchical organization structure, location-based access control, operational management, and performance analytics for effective distributed operations management. 