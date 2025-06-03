# Universal Retry Service Migration Guide

## Overview

This document outlines the migration from individual `retryOperation` methods in each service to a universal `RetryService` that can be used across the entire application. This eliminates code duplication and provides a consistent retry mechanism.

## What Was Changed

### Before (Duplicated Code)

Each service had its own `retryOperation` method:

```typescript
private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            const isConnectionError =
                error instanceof Error &&
                (error.message.includes('ECONNRESET') ||
                    error.message.includes('Connection lost') ||
                    error.message.includes('connect ETIMEDOUT'));

            if (isConnectionError && attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                continue;
            }
            throw error;
        }
    }
    throw new Error('Max retries exceeded');
}
```

### After (Universal Service)

Now we have a single `RetryService` in `src/common/services/retry.service.ts`:

```typescript
@Injectable()
export class RetryService {
    async execute<T>(
        operation: () => Promise<T>,
        options?: RetryOptions,
    ): Promise<T>;
    async executeDatabase<T>(operation: () => Promise<T>): Promise<T>;
    async executeApi<T>(operation: () => Promise<T>): Promise<T>;
    async executeFile<T>(operation: () => Promise<T>): Promise<T>;
}
```

## Migration Steps

### 1. Add RetryService Import

```typescript
import { RetryService } from '../common/services/retry.service';
```

### 2. Inject RetryService in Constructor

```typescript
constructor(
    // ... other dependencies
    private readonly retryService: RetryService,
) {}
```

### 3. Remove Old retryOperation Method

Delete the entire `private async retryOperation` method from your service.

### 4. Replace Method Calls

Replace all instances of:

```typescript
this.retryOperation(async () => {
    // your code
});
```

With:

```typescript
this.retryService.executeDatabase(async () => {
    // your code
});
```

## RetryService Methods

### `execute<T>(operation, options?)`

The main retry method with full customization options:

```typescript
await this.retryService.execute(
    async () => {
        // your operation
    },
    {
        maxRetries: 5,
        initialDelay: 2000,
        exponentialBackoff: true,
        shouldRetry: error => error.message.includes('TIMEOUT'),
        onRetry: (attempt, error) =>
            console.log(`Retry ${attempt}: ${error.message}`),
    },
);
```

### `executeDatabase<T>(operation)`

Optimized for database operations (recommended for most use cases):

- 3 max retries
- 1000ms initial delay
- Exponential backoff
- Retries on connection errors

```typescript
await this.retryService.executeDatabase(async () => {
    return await this.repository.save(entity);
});
```

### `executeApi<T>(operation)`

Optimized for API calls:

- 2 max retries
- 500ms initial delay
- Retries on network and 5xx errors

```typescript
await this.retryService.executeApi(async () => {
    return await this.httpService.get('/api/data');
});
```

### `executeFile<T>(operation)`

Optimized for file operations:

- 2 max retries
- 250ms initial delay
- No exponential backoff
- Retries on file system errors

```typescript
await this.retryService.executeFile(async () => {
    return await fs.writeFile(path, data);
});
```

## RetryOptions Interface

```typescript
interface RetryOptions {
    maxRetries?: number; // Default: 3
    initialDelay?: number; // Default: 1000ms
    exponentialBackoff?: boolean; // Default: true
    shouldRetry?: (error: Error) => boolean;
    onRetry?: (attempt: number, error: Error) => void;
}
```

## Example Migration

### Before:

```typescript
@Injectable()
export class UserService {
    private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
        // ... retry logic
    }

    async findById(id: string): Promise<User | null> {
        return this.retryOperation(async () => {
            return await this.userRepository.findOne({ where: { id } });
        });
    }
}
```

### After:

```typescript
import { RetryService } from '../common/services/retry.service';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly retryService: RetryService,
    ) {}

    async findById(id: string): Promise<User | null> {
        return this.retryService.executeDatabase(async () => {
            return await this.userRepository.findOne({ where: { id } });
        });
    }
}
```

## Benefits

1. **Code Deduplication**: Eliminates ~20 lines of duplicated code per service
2. **Consistency**: All services use the same retry logic
3. **Maintainability**: Changes to retry logic only need to be made in one place
4. **Flexibility**: Different retry strategies for different operation types
5. **Logging**: Built-in logging for retry attempts and failures
6. **Type Safety**: Full TypeScript support with generics

## Services Updated

The following services have been migrated:

- ✅ UserService
- ✅ CourseService
- 🔄 OrgService (pending)
- 🔄 QuestionsService (pending)
- 🔄 CourseMaterialsService (pending)
- 🔄 TestAttemptsService (pending)
- 🔄 QuestionsOptionsService (pending)
- 🔄 BranchService (pending)
- 🔄 TestService (pending)
- 🔄 MediaManagerService (pending)

## Automated Migration Script

Use the provided script to automatically update remaining services:

```bash
./update-retry-services.sh
```

This script will:

1. Add RetryService imports
2. Update constructors
3. Replace method calls
4. Provide a checklist for manual cleanup

## Testing

After migration, ensure:

1. All services compile without TypeScript errors
2. Retry behavior works as expected
3. Error handling remains consistent
4. Performance is not negatively impacted

## Troubleshooting

### Import Path Issues

If you get import errors, verify the relative path to the RetryService:

```typescript
// Adjust the path based on your service location
import { RetryService } from '../common/services/retry.service';
import { RetryService } from '../../common/services/retry.service';
```

### Constructor Injection Issues

Ensure RetryService is properly injected:

```typescript
constructor(
    // ... other dependencies
    private readonly retryService: RetryService, // Add this line
) {}
```

### Module Import Issues

Ensure CommonModule is imported in your app.module.ts:

```typescript
@Module({
    imports: [
        CommonModule, // This should be present
        // ... other modules
    ],
})
export class AppModule {}
```

## Future Enhancements

Potential improvements to consider:

1. **Metrics Collection**: Track retry statistics
2. **Circuit Breaker**: Prevent cascading failures
3. **Jitter**: Add randomization to prevent thundering herd
4. **Custom Strategies**: Allow per-service retry strategies
5. **Async Hooks**: Integration with APM tools
