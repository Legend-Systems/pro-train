# User Routes Role Guards

This document describes the role-based access control implemented on user management endpoints.

## Overview

The user controller now uses organizational role guards to control access based on user roles and organizational scope.

## Protected Endpoints

### 1. Create User - `POST /user`
```typescript
@UseGuards(OrgRoleGuard)
@AdminOnly() // Only admins can create users
```

**Access:** Admin, Brandon only
**Cross-org:** No (within same organization)
**Business Logic:** Only administrators can create new user accounts

### 2. Get All Users - `GET /user/admin/all`
```typescript
@UseGuards(OrgRoleGuard)
@AdminOnly(true) // Allow cross-org access for admins
```

**Access:** Admin, Brandon only
**Cross-org:** Yes (admins can see users across organizations)
**Business Logic:** Administrative oversight requires admin permissions with cross-org visibility

### 3. Get User by ID - `GET /user/admin/:id`
```typescript
@UseGuards(OrgRoleGuard)
@OwnerOrAdmin(true) // Allow cross-org access for owners/admins
```

**Access:** Owner, Admin, Brandon
**Cross-org:** Yes (owners/admins can view users across organizations)
**Business Logic:** User details accessible to organization owners and administrators

### 4. Update User by ID - `PUT /user/admin/:id`
```typescript
@UseGuards(OrgRoleGuard)
@OwnerOrAdmin() // Owners/admins can update users within their org
```

**Access:** Owner, Admin, Brandon
**Cross-org:** No (within same organization only)
**Business Logic:** User modifications restricted to same organization for data protection

### 5. Delete User by ID - `DELETE /user/admin/:id`
```typescript
@UseGuards(OrgRoleGuard)
@AdminOnly() // Only admins can delete users
```

**Access:** Admin, Brandon only
**Cross-org:** No (within same organization)
**Business Logic:** User deletion is a sensitive operation requiring admin privileges

## Role Hierarchy

1. **BRANDON** - Super admin, access to everything
2. **ADMIN** - Organization admin, can manage users within org (+ cross-org when allowed)
3. **OWNER** - Organization owner, can manage users within their organization
4. **USER** - Regular user, no administrative access to user management

## Business Logic Applied

### OWNER Role
- Has access to **everything** within their organization
- Can view and update users in any branch within their org
- Cannot access other organizations (unless specifically allowed)

### ADMIN Role
- Has administrative privileges within their organization
- Can access across organizations when `allowCrossOrg: true`
- Can perform sensitive operations like user creation and deletion

### BRANDON Role
- Universal access to all operations across all organizations
- Bypasses all organizational and branch restrictions

## Usage Examples

```typescript
// Example: Admin creating a user within their organization
POST /user
Headers: { Authorization: "Bearer <admin-token>" }
Body: { email: "newuser@company.com", ... }
// ✅ Allowed if admin is in same org

// Example: Owner viewing user details across organizations
GET /user/admin/user-uuid
Headers: { Authorization: "Bearer <owner-token>" }
// ✅ Allowed with cross-org access

// Example: Regular user trying to access admin endpoint
GET /user/admin/all
Headers: { Authorization: "Bearer <user-token>" }
// ❌ Forbidden - requires admin role
```

## Security Considerations

1. **Sensitive Operations:** User creation and deletion require admin privileges
2. **Cross-Organization Access:** Carefully controlled to prevent data leaks
3. **Owner Privileges:** Organization owners have full access within their domain
4. **Audit Trail:** All administrative actions should be logged for compliance

## Migration Notes

- Existing endpoints now require appropriate roles
- Users without sufficient permissions will receive 403 Forbidden
- API consumers must ensure tokens have correct role assignments
- Organization membership is validated for non-Brandon users 