# Authentication with Organization and Branch Scoping

## Overview

The authentication system now supports attaching organization and branch IDs to JWT tokens, enabling fine-grained access control and data filtering throughout the application.

## Features

### Token Enhancement

- JWT tokens now include `orgId` and `branchId` claims
- Tokens are automatically scoped based on the user's organization and branch membership
- Token refresh preserves org and branch context

### Token Structure

```json
{
    "sub": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "orgId": "org-uuid",
    "branchId": "branch-uuid",
    "iat": 1234567890,
    "exp": 1234567890
}
```

## API Endpoints

### Get Token Information

```http
GET /auth/token-info
Authorization: Bearer <your-jwt-token>
```

Returns information about the authenticated user's token including org and branch scope:

```json
{
    "success": true,
    "data": {
        "user": {
            "id": "user-uuid",
            "email": "user@example.com",
            "firstName": "John",
            "lastName": "Doe",
            "avatar": "https://example.com/avatar.jpg",
            "orgId": "org-uuid",
            "branchId": "branch-uuid",
            "createdAt": "2024-01-01T00:00:00.000Z",
            "updatedAt": "2024-01-01T00:00:00.000Z"
        },
        "scope": {
            "orgId": "org-uuid",
            "branchId": "branch-uuid"
        }
    },
    "message": "Token information retrieved successfully"
}
```

## Implementation Details

### Token Generation

When users sign in or sign up, the system:

1. Fetches user data including org and branch relationships
2. Includes `orgId` and `branchId` in the JWT payload
3. Signs the token with the enhanced payload

### Token Validation

The JWT strategy validates tokens and extracts org and branch information:

1. Verifies JWT signature and expiration
2. Extracts user information from token payload
3. Adds org and branch IDs to the request context

### Decorators Available

#### @OrgBranchScope()

Extracts org and branch scope from the authenticated user:

```typescript
@Get('scoped-data')
@UseGuards(JwtAuthGuard)
async getScopedData(@OrgBranchScope() scope: OrgBranchScope) {
  // scope.orgId and scope.branchId available
  // scope.userId available
}
```

#### @GetOrgId()

Extracts only the organization ID:

```typescript
@Get('org-data')
@UseGuards(JwtAuthGuard)
async getOrgData(@GetOrgId() orgId: string) {
  // orgId available
}
```

#### @GetBranchId()

Extracts only the branch ID:

```typescript
@Get('branch-data')
@UseGuards(JwtAuthGuard)
async getBranchData(@GetBranchId() branchId: string) {
  // branchId available
}
```

## Data Scoping Service

The `OrgBranchScopingService` provides utilities for filtering queries based on org and branch scope:

### Apply Scoping to Find Operations

```typescript
const scopedOptions = this.scopingService.applyScopeToFindOptions(
    { where: { status: 'active' } },
    { orgId: 'org-uuid', branchId: 'branch-uuid' },
);
const results = await repository.find(scopedOptions);
```

### Apply Scoping to Query Builder

```typescript
const queryBuilder = repository.createQueryBuilder('entity');
this.scopingService.applyScopeToQueryBuilder(
    queryBuilder,
    { orgId: 'org-uuid', branchId: 'branch-uuid' },
    'entity',
);
const results = await queryBuilder.getMany();
```

### Create Scoped Repository

```typescript
const scopedRepo = this.scopingService.createScopedRepository(repository, {
    orgId: 'org-uuid',
    branchId: 'branch-uuid',
});
const results = await scopedRepo.find();
```

## Security Considerations

1. **Token Validation**: All org and branch IDs are validated against the user's actual memberships
2. **Scope Enforcement**: Data queries are automatically scoped to prevent cross-organization data access
3. **Token Refresh**: Org and branch context is preserved during token refresh operations
4. **Audit Trail**: All scoped operations can be logged for security auditing

## Testing the Implementation

To test the org and branch token attachment:

1. Sign in as a user with org and branch membership
2. Use the `/auth/token-info` endpoint to verify token contents
3. Make API calls to scoped endpoints and verify data filtering
4. Test token refresh to ensure scope preservation

## Example Usage

```typescript
// In a controller
@Get('my-tests')
@UseGuards(JwtAuthGuard)
async getMyTests(@OrgBranchScope() scope: OrgBranchScope) {
  return this.testService.findByScope(scope);
}

// In a service
async findByScope(scope: OrgBranchScope) {
  const scopedOptions = this.scopingService.applyScopeToFindOptions(
    {},
    { orgId: scope.orgId, branchId: scope.branchId }
  );
  return this.testRepository.find(scopedOptions);
}
```

This implementation ensures that users can only access data within their organizational and branch boundaries, providing robust multi-tenant security.
