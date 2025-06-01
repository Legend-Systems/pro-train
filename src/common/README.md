# 🔄 Common Module

## Overview

The Common Module serves as the foundational infrastructure layer for the trainpro platform, providing shared utilities, event-driven architecture components, and cross-cutting concerns that support the entire application ecosystem. This module implements enterprise-grade event sourcing, domain events, shared interfaces, and common utilities that enable loose coupling, scalability, and maintainability across all platform modules.

## 🏗️ Architecture

```
common/
├── events/                           # Domain events for event-driven architecture
│   ├── index.ts                     # Event exports and registry
│   ├── organization-created.event.ts    # Organization lifecycle events
│   ├── branch-created.event.ts         # Branch management events
│   ├── user-created.event.ts           # User lifecycle events
│   ├── user-profile-updated.event.ts   # User profile change events
│   ├── user-password-changed.event.ts  # Security-related events
│   ├── user-org-branch-assigned.event.ts # Assignment events
│   ├── user-deactivated.event.ts       # User status events
│   ├── user-restored.event.ts          # User restoration events
│   ├── course-created.event.ts         # Course lifecycle events
│   ├── question-created.event.ts       # Question management events
│   ├── question-updated.event.ts       # Question modification events
│   └── question-deleted.event.ts       # Question removal events
├── interfaces/                      # Shared type definitions (future)
├── decorators/                      # Custom decorators (future)
├── filters/                         # Exception filters (future)
├── guards/                          # Custom guards (future)
├── interceptors/                    # Request/response interceptors (future)
├── pipes/                          # Validation pipes (future)
└── utils/                          # Utility functions (future)
```

## 🎯 Core Features

### Event-Driven Architecture

- **Domain Events** for decoupled business logic communication
- **Event Sourcing** support for audit trails and data consistency
- **Event Publishing** with asynchronous event handling
- **Event Subscribers** for cross-module integrations
- **Event Store** for persistent event logging and replay capabilities

### Cross-Cutting Concerns

- **Shared Interfaces** for consistent type definitions across modules
- **Common Utilities** for reusable business logic and helpers
- **Validation Decorators** for consistent input validation
- **Exception Handling** with standardized error responses
- **Logging Infrastructure** with structured logging support

### Integration Support

- **Inter-Module Communication** through events and shared interfaces
- **Third-Party Integrations** with standardized event contracts
- **Audit Logging** for compliance and security tracking
- **Monitoring Hooks** for performance and health monitoring
- **Cache Invalidation** through event-driven cache management

## 📊 Event System

### Event Categories

#### Organization Events

```typescript
// Organization creation and management
export class OrganizationCreatedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly name: string,
        public readonly type: string,
        public readonly createdBy: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}
```

#### Branch Events

```typescript
// Branch lifecycle and management
export class BranchCreatedEvent {
    constructor(
        public readonly branchId: string,
        public readonly name: string,
        public readonly organizationId: string,
        public readonly organizationName: string,
        public readonly address?: string,
        public readonly managerName?: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}
```

#### User Events

```typescript
// User lifecycle events
export class UserCreatedEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly firstName: string,
        public readonly lastName: string,
        public readonly organizationId?: string,
        public readonly organizationName?: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
        public readonly avatar?: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class UserProfileUpdatedEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly updatedFields: string[],
        public readonly previousValues: any,
        public readonly newValues: any,
        public readonly updatedBy: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class UserPasswordChangedEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly changedBy: string,
        public readonly isReset: boolean = false,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class UserOrgBranchAssignedEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly organizationId: string,
        public readonly organizationName: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
        public readonly assignedBy: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class UserDeactivatedEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly reason: string,
        public readonly deactivatedBy: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class UserRestoredEvent {
    constructor(
        public readonly userId: string,
        public readonly userEmail: string,
        public readonly restoredBy: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}
```

#### Course Events

```typescript
// Course and content management
export class CourseCreatedEvent {
    constructor(
        public readonly courseId: number,
        public readonly title: string,
        public readonly description: string,
        public readonly creatorId: string,
        public readonly creatorEmail: string,
        public readonly creatorFirstName: string,
        public readonly creatorLastName: string,
        public readonly organizationId?: string,
        public readonly organizationName?: string,
        public readonly branchId?: string,
        public readonly branchName?: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}
```

#### Question Events

```typescript
// Question and assessment management
export class QuestionCreatedEvent {
    constructor(
        public readonly questionId: number,
        public readonly questionText: string,
        public readonly questionType: string,
        public readonly testId: number,
        public readonly creatorId: string,
        public readonly creatorEmail: string,
        public readonly organizationId?: string,
        public readonly branchId?: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class QuestionUpdatedEvent {
    constructor(
        public readonly questionId: number,
        public readonly updatedFields: string[],
        public readonly previousValues: any,
        public readonly newValues: any,
        public readonly updatedBy: string,
        public readonly testId: number,
        public readonly timestamp: Date = new Date(),
    ) {}
}

export class QuestionDeletedEvent {
    constructor(
        public readonly questionId: number,
        public readonly questionText: string,
        public readonly testId: number,
        public readonly deletedBy: string,
        public readonly timestamp: Date = new Date(),
    ) {}
}
```

## 🔄 Event Flow & Integration

### Event Publishing Pattern

```typescript
// Example: Publishing user creation event
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../common/events';

@Injectable()
export class UserService {
    constructor(private readonly eventEmitter: EventEmitter2) {}

    async createUser(userData: CreateUserDto): Promise<User> {
        // Create user logic
        const user = await this.userRepository.save(userData);

        // Publish domain event
        const event = new UserCreatedEvent(
            user.id,
            user.email,
            user.firstName,
            user.lastName,
            user.organizationId,
            user.organization?.name,
            user.branchId,
            user.branch?.name,
        );

        this.eventEmitter.emit('user.created', event);
        return user;
    }
}
```

### Event Subscription Pattern

```typescript
// Example: Listening to events in other modules
import { OnEvent } from '@nestjs/event-emitter';
import { UserCreatedEvent } from '../common/events';

@Injectable()
export class NotificationService {
    @OnEvent('user.created')
    async handleUserCreated(event: UserCreatedEvent) {
        // Send welcome email
        await this.emailService.sendWelcomeEmail({
            to: event.userEmail,
            firstName: event.firstName,
            organizationName: event.organizationName,
        });

        // Create audit log
        await this.auditService.logEvent({
            event: 'USER_CREATED',
            userId: event.userId,
            details: event,
        });
    }

    @OnEvent('user.profile.updated')
    async handleUserProfileUpdated(event: UserProfileUpdatedEvent) {
        // Notify relevant parties of profile changes
        if (event.updatedFields.includes('email')) {
            await this.emailService.sendEmailChangeConfirmation(event);
        }
    }
}
```

## 🎯 Event Use Cases

### User Management Events

- **Welcome Workflows**: Trigger onboarding sequences when users are created
- **Profile Sync**: Update related data when user profiles change
- **Security Monitoring**: Track password changes and account access
- **Compliance Audit**: Log user lifecycle events for regulatory compliance

### Organization Events

- **Resource Provisioning**: Auto-provision resources for new organizations
- **Branch Coordination**: Sync data across organization branches
- **Billing Integration**: Trigger billing events for organization changes
- **Access Control**: Update permissions when organizational structure changes

### Course & Assessment Events

- **Progress Tracking**: Monitor learning progress and completion
- **Content Sync**: Update related content when courses change
- **Analytics**: Generate reports on course creation and usage
- **Notifications**: Alert stakeholders of important content changes

### System Integration Events

- **Cache Invalidation**: Clear relevant caches when data changes
- **Search Index**: Update search indexes when content is modified
- **Third-Party Sync**: Sync data with external systems
- **Performance Monitoring**: Track system events for optimization

## 🔧 Event Configuration

### Event Emitter Setup

```typescript
// app.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
    imports: [
        EventEmitterModule.forRoot({
            // Set this to `true` to use wildcards
            wildcard: false,
            // The delimiter used to segment namespaces
            delimiter: '.',
            // Set this to `true` if you want to emit the newListener event
            newListener: false,
            // Set this to `true` if you want to emit the removeListener event
            removeListener: false,
            // The maximum amount of listeners that can be assigned to an event
            maxListeners: 10,
            // Show event name in memory leak message when more than maximum amount of listeners is assigned
            verboseMemoryLeak: false,
            // Disable throwing uncaughtException if an error event is emitted and it has no listeners
            ignoreErrors: false,
        }),
        // Other modules...
    ],
})
export class AppModule {}
```

### Event Handler Registration

```typescript
// Example service with event handlers
@Injectable()
export class AuditService {
    @OnEvent('**', { async: true })
    async handleAllEvents(event: any) {
        // Log all events for audit purposes
        await this.auditRepository.save({
            eventType: event.constructor.name,
            eventData: event,
            timestamp: new Date(),
        });
    }

    @OnEvent('user.*')
    async handleUserEvents(event: any) {
        // Special handling for all user-related events
        await this.userAuditService.logUserEvent(event);
    }
}
```

## 📈 Performance Considerations

### Async Event Processing

```typescript
// Async event handlers for performance
@OnEvent('user.created', { async: true })
async handleUserCreatedAsync(event: UserCreatedEvent) {
    // Non-blocking event processing
    await Promise.all([
        this.emailService.sendWelcomeEmail(event),
        this.analyticsService.trackUserCreation(event),
        this.auditService.logEvent(event)
    ]);
}
```

### Event Batching

```typescript
// Batch processing for high-volume events
@Injectable()
export class EventBatchProcessor {
    private eventBatch: any[] = [];
    private batchTimeout: NodeJS.Timeout;

    @OnEvent('*.created')
    async batchEvents(event: any) {
        this.eventBatch.push(event);

        if (this.eventBatch.length >= 100) {
            await this.processBatch();
        } else {
            this.scheduleBatchProcessing();
        }
    }

    private async processBatch() {
        const batch = [...this.eventBatch];
        this.eventBatch = [];

        await this.analyticsService.processBatch(batch);
    }
}
```

## 🔮 Future Enhancements

### Event Store Implementation

```typescript
// Future: Persistent event store for event sourcing
@Injectable()
export class EventStore {
    async append(streamId: string, events: any[]): Promise<void> {
        // Persist events for event sourcing
    }

    async getEvents(streamId: string, fromVersion?: number): Promise<any[]> {
        // Retrieve event stream for replay
    }
}
```

### Event Replay System

```typescript
// Future: Event replay capabilities
@Injectable()
export class EventReplayService {
    async replayEvents(fromDate: Date, toDate: Date): Promise<void> {
        // Replay events for system recovery or migration
    }

    async replayUserEvents(userId: string): Promise<any[]> {
        // Replay specific user events for debugging
    }
}
```

### Advanced Event Routing

```typescript
// Future: Complex event routing and filtering
@Injectable()
export class EventRouter {
    async routeEvent(event: any, routingRules: RoutingRule[]): Promise<void> {
        // Advanced event routing based on content and rules
    }
}
```

## 🧪 Testing Events

### Event Testing Utilities

```typescript
// Testing event emission and handling
describe('UserService', () => {
    let eventEmitter: EventEmitter2;
    let userService: UserService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: EventEmitter2,
                    useValue: {
                        emit: jest.fn(),
                    },
                },
            ],
        }).compile();

        userService = module.get<UserService>(UserService);
        eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    });

    it('should emit user created event', async () => {
        const userData = {
            /* test data */
        };
        await userService.createUser(userData);

        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'user.created',
            expect.any(UserCreatedEvent),
        );
    });
});
```

## 🔗 Dependencies

### Internal Dependencies

- All platform modules consume common events
- Cross-module integration through event subscription
- Shared interfaces and utilities across modules

### External Dependencies

- **@nestjs/event-emitter**: Core event emission and handling
- **events**: Node.js EventEmitter for advanced patterns
- **rxjs**: Reactive programming for complex event flows

## 🚀 Usage Examples

### Basic Event Publishing

```typescript
// Publishing events from any service
this.eventEmitter.emit('user.created', new UserCreatedEvent(/*...*/));
this.eventEmitter.emit('course.updated', new CourseUpdatedEvent(/*...*/));
```

### Event Handling

```typescript
// Handling events in services
@OnEvent('user.created')
async onUserCreated(event: UserCreatedEvent) {
    // Handle user creation
}
```

### Cross-Module Integration

```typescript
// Communications module listening to user events
@OnEvent('user.org.branch.assigned')
async onUserAssigned(event: UserOrgBranchAssignedEvent) {
    // Send assignment notification
    await this.notificationService.sendAssignmentNotification(event);
}
```

---

This Common Module provides the foundational event-driven architecture and shared utilities that enable loose coupling, scalability, and maintainability across the entire trainpro platform, supporting enterprise-grade event sourcing and cross-cutting concerns.
