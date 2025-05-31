# Organization & Branch Management System

This module implements a comprehensive organization and branch management system following the patterns established in the Exxam platform.

## 📋 Overview

The system provides a hierarchical structure where:
- **Organizations** are top-level entities (companies, institutions)
- **Branches** are organizational units within an organization (offices, departments, locations)

## 🏗️ Architecture

### Entities
- `Organization` - Main organizational entity with unique name validation
- `Branch` - Sub-organizational entity linked to an organization

### Relationships
- One-to-Many: Organization → Branches
- Many-to-One: Branch → Organization (with CASCADE delete)

## 📚 API Endpoints

### Organization Management
- `POST /organizations` - Create new organization
- `GET /organizations` - List all organizations with branches
- `GET /organizations/:id` - Get specific organization
- `GET /organizations/:id/stats` - Get organization statistics
- `PUT /organizations/:id` - Update organization
- `DELETE /organizations/:id` - Delete organization (cascades to branches)

### Branch Management (via Organization)
- `POST /organizations/:orgId/branches` - Create branch in organization
- `GET /organizations/:orgId/branches` - List organization branches
- `GET /organizations/:orgId/branches/:branchId` - Get specific branch
- `PUT /organizations/:orgId/branches/:branchId` - Update branch
- `DELETE /organizations/:orgId/branches/:branchId` - Delete branch

### Standalone Branch Operations
- `GET /branches` - List all branches across organizations
- `GET /branches/:id` - Get specific branch
- `PUT /branches/:id` - Update branch directly
- `DELETE /branches/:id` - Delete branch directly

## 🔧 Features

### Organization Features
- ✅ Unique name validation
- ✅ Logo and website URL support
- ✅ Active/inactive status management
- ✅ Automatic timestamp tracking
- ✅ Branch statistics and metrics

### Branch Features
- ✅ Contact information management
- ✅ Operating hours configuration
- ✅ Manager assignment
- ✅ Active/inactive status
- ✅ Organization association

### Technical Features
- ✅ Comprehensive API documentation with Swagger
- ✅ Input validation with class-validator
- ✅ Error handling and logging
- ✅ Database connection retry logic
- ✅ JWT authentication protection
- ✅ TypeORM entity relationships
- ✅ Cascade delete operations

## 📊 Database Schema

### Organizations Table
```sql
- id: UUID (Primary Key)
- name: VARCHAR (Unique)
- description: TEXT (Nullable)
- isActive: BOOLEAN (Default: true)
- logoUrl: VARCHAR (Nullable)
- website: VARCHAR (Nullable)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Branches Table
```sql
- id: UUID (Primary Key)
- name: VARCHAR
- address: TEXT (Nullable)
- contactNumber: VARCHAR (Nullable)
- email: VARCHAR (Nullable)
- isActive: BOOLEAN (Default: true)
- managerName: VARCHAR (Nullable)
- operatingHours: JSON (Nullable)
- organizationId: UUID (Foreign Key)
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

## 🚀 Usage Examples

### Creating an Organization
```typescript
POST /organizations
{
  "name": "Acme Corporation",
  "description": "Leading technology company",
  "logoUrl": "https://cdn.example.com/logos/acme.png",
  "website": "https://www.acmecorp.com"
}
```

### Creating a Branch
```typescript
POST /organizations/{organizationId}/branches
{
  "name": "Downtown Branch",
  "address": "123 Main Street, Downtown, City 12345",
  "contactNumber": "+1-555-123-4567",
  "email": "downtown@acmecorp.com",
  "managerName": "John Smith",
  "operatingHours": {
    "opening": "09:00",
    "closing": "17:00",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }
}
```

## 🔐 Security

- All endpoints require JWT authentication
- Input validation on all DTOs
- SQL injection protection via TypeORM
- Role-based access control ready (extendable)

## 📈 Performance Considerations

- Database indexes on frequently queried fields
- Efficient relationship loading with TypeORM
- Connection pooling and retry logic
- Batch operations for bulk data handling

## 🧪 Testing

The implementation includes:
- Unit test stubs for services and controllers
- Integration test patterns
- Swagger documentation for API testing
- Error scenario coverage

## 🔄 Future Enhancements

- [ ] Soft delete implementation
- [ ] Audit trail for changes
- [ ] Role-based permissions per organization/branch
- [ ] Advanced filtering and search
- [ ] Bulk operations for organizations and branches
- [ ] Integration with user management for organization assignments 