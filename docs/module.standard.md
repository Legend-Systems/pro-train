# Module Compliance Standards

This document outlines the mandatory requirements for all service modules to ensure proper multi-tenant isolation, consistent caching strategies, and reliable database operations.

## 🎯 Core Requirements

### 1. **Org/Branch Level Caching** ✅ MANDATORY

All cache keys MUST include organization and branch parameters for proper multi-tenant isolation.

#### ✅ **Compliant Pattern:**

```typescript
private readonly CACHE_KEYS = {
    ITEM_BY_ID: (id: number, orgId?: number, branchId?: number) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:item:${id}`,
    ITEMS_BY_PARENT: (parentId: number, filters: string, orgId?: number, branchId?: number) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:items:parent:${parentId}:${filters}`,
    ITEM_STATS: (itemId: number, orgId?: number, branchId?: number) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:item:stats:${itemId}`,
    ALL_ITEMS: (orgId?: number, branchId?: number) =>
        `org:${orgId || 'global'}:branch:${branchId || 'global'}:items:all`,
};
```

#### ❌ **Non-Compliant Pattern:**

```typescript
// NEVER DO THIS - No org/branch isolation
private readonly CACHE_KEYS = {
    ITEM_BY_ID: (id: number) => `item:${id}`,
    ITEMS_LIST: (filters: string) => `items:list:${filters}`,
};
```

### 2. **Query Scoping** ✅ MANDATORY

All database queries MUST apply org/branch filtering when scope is provided.

#### ✅ **Compliant Pattern:**

```typescript
const query = this.repository.createQueryBuilder("entity");

// Apply org/branch scoping
if (scope.orgId) {
  query.andWhere("entity.orgId = :orgId", { orgId: scope.orgId });
}
if (scope.branchId) {
  query.andWhere("entity.branchId = :branchId", { branchId: scope.branchId });
}
```

#### ❌ **Non-Compliant Pattern:**

```typescript
// NEVER DO THIS - No scoping applied
const query = this.repository.createQueryBuilder("entity");
// Missing org/branch filtering - data leakage risk!
```

### 3. **RetryService Usage** ✅ MANDATORY

All database operations MUST use the universal RetryService for consistent error handling and retry logic.

#### ✅ **Compliant Pattern:**

```typescript
async create(dto: CreateDto, scope: OrgBranchScope): Promise<Response> {
    return this.retryService.executeDatabase(async () => {
        // Database operations here
    });
}
```

#### ❌ **Non-Compliant Pattern:**

```typescript
// NEVER DO THIS - Custom retry logic
private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    // Custom implementation - should use RetryService
}
```

## 🏗️ Implementation Requirements

### Cache Invalidation Methods

All cache invalidation methods MUST accept org/branch parameters:

```typescript
private async invalidateItemCache(
    itemId: number,
    parentId?: number,
    orgId?: number,
    branchId?: number,
): Promise<void> {
    const keysToDelete = [
        this.CACHE_KEYS.ITEM_BY_ID(itemId, orgId, branchId),
    ];

    if (parentId) {
        keysToDelete.push(
            this.CACHE_KEYS.ITEMS_BY_PARENT(parentId, '', orgId, branchId),
            this.CACHE_KEYS.ITEM_STATS(parentId, orgId, branchId),
        );
    }

    keysToDelete.push(this.CACHE_KEYS.ALL_ITEMS(orgId, branchId));

    await Promise.all(
        keysToDelete.map(async key => {
            try {
                await this.cacheManager.del(key);
            } catch (error) {
                this.logger.warn(`Failed to delete cache key ${key}:`, error);
            }
        }),
    );
}
```

### Service Constructor Requirements

```typescript
constructor(
    @InjectRepository(Entity)
    private readonly repository: Repository<Entity>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly retryService: RetryService, // ✅ MANDATORY
) {}
```

### Method Signatures

All public methods MUST accept `OrgBranchScope` parameter:

```typescript
async findAll(filters: FilterDto, scope: OrgBranchScope): Promise<ResponseDto>
async findOne(id: number, scope: OrgBranchScope): Promise<ResponseDto>
async create(dto: CreateDto, scope: OrgBranchScope): Promise<StandardOperationResponse>
async update(id: number, dto: UpdateDto, scope: OrgBranchScope): Promise<StandardOperationResponse>
async remove(id: number, scope: OrgBranchScope): Promise<StandardOperationResponse>
```

## 📊 Compliance Examples

### ✅ **Fully Compliant Services:**

- `QuestionsService` - Exemplary implementation
- `QuestionsOptionsService` - Perfect multi-tenant caching

### ⚠️ **Needs Updates:**

- `CourseService` - Missing org/branch cache scoping

## 🔍 Cache Key Patterns

### Standard Cache Key Types

1. **Entity by ID:**

   ```typescript
   ENTITY_BY_ID: (id: number, orgId?: number, branchId?: number) =>
     `org:${orgId || "global"}:branch:${branchId || "global"}:entity:${id}`;
   ```

2. **Entity List with Filters:**

   ```typescript
   ENTITIES_LIST: (filters: string, orgId?: number, branchId?: number) =>
     `org:${orgId || "global"}:branch:${
       branchId || "global"
     }:entities:list:${filters}`;
   ```

3. **Parent-Child Relationships:**

   ```typescript
   CHILDREN_BY_PARENT: (parentId: number, orgId?: number, branchId?: number) =>
     `org:${orgId || "global"}:branch:${
       branchId || "global"
     }:children:parent:${parentId}`;
   ```

4. **User-Specific Data:**

   ```typescript
   USER_ENTITIES: (userId: string, orgId?: number, branchId?: number) =>
     `org:${orgId || "global"}:branch:${
       branchId || "global"
     }:user:${userId}:entities`;
   ```

5. **Statistics/Counts:**
   ```typescript
   ENTITY_STATS: (entityId: number, orgId?: number, branchId?: number) =>
     `org:${orgId || "global"}:branch:${
       branchId || "global"
     }:entity:stats:${entityId}`;
   ```

## 🚫 Common Anti-Patterns

### ❌ **Cache Data Leakage:**

```typescript
// DANGEROUS - Organizations can see each other's data
const cacheKey = `course:${id}`; // No org/branch isolation
```

### ❌ **Missing Query Scoping:**

```typescript
// DANGEROUS - Returns data from all organizations
const courses = await this.repository.find({ where: { status: "active" } });
```

### ❌ **Custom Retry Logic:**

```typescript
// OUTDATED - Use RetryService instead
private async retryOperation() { /* custom logic */ }
```

## ✅ Compliance Checklist

For each service module, verify:

- [ ] All cache keys include `orgId` and `branchId` parameters
- [ ] All database queries apply org/branch scoping when scope is provided
- [ ] All DB operations use `this.retryService.executeDatabase()`
- [ ] Cache invalidation methods accept org/branch parameters
- [ ] All public methods accept `OrgBranchScope` parameter
- [ ] RetryService is properly injected in constructor
- [ ] No custom retry logic implementations exist
- [ ] Cache TTL configuration is appropriate for data type
- [ ] Error handling includes proper logging
- [ ] Entity creation inherits org/branch from parent or scope

## 🎯 Migration Priority

1. **High Priority:** Services handling sensitive data (Users, Organizations, Financial)
2. **Medium Priority:** Core business logic services (Courses, Tests, Results)
3. **Low Priority:** Supporting services (Media, Notifications)

## 📝 Review Process

Before marking a service as compliant:

1. ✅ Verify cache key patterns include org/branch scoping
2. ✅ Test query scoping with different org/branch combinations
3. ✅ Confirm RetryService usage in all DB operations
4. ✅ Validate cache invalidation includes scope parameters
5. ✅ Check that entity creation inherits proper org/branch context

---

**Last Updated:** December 2024  
**Compliant Services:** Questions, Questions Options  
**Pending Updates:** Course Service (cache scoping)
