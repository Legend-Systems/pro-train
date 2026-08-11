# ProTrain API — NestJS Project Rules

Complete project rules for ProTrain Backend (`pro-train`): **TypeScript**, **NestJS**, **Swagger**, **TypeORM**, **Nodemailer**, **JWT/Passport**, and multi-tenant LMS APIs.

Derived from `src/` module layout, `docs/module.standard.md`, `docs/STANDARDRESPONSE_MIGRATION.md`, `docs/ROLE_GUARDS.md`, Swagger bootstrap in `main.ts`, and existing service/controller conventions.

===================================================================================

- rule name 'ProTrain API Overview'.
- rule description

This repository is the NestJS backend API for ProTrain (TrainPro), an employee training platform for courses, quizzes/tests, results, reporting, communications, and multi-tenant organisation/branch management.

Targets: REST API consumed by:

- `protrain-client` (Next.js web)
- `protrain-mobile` (Expo React Native)

This repository does **not** contain the Next.js web client or the Expo mobile app.

Always treat this API as long-term enterprise software. Prefer maintainable, production-ready solutions over quick hacks.

===================================================================================

- rule name 'Tech Stack'.
- rule description

Always assume the following stack unless explicitly told otherwise:

- NestJS 11
- TypeScript (strict enterprise style)
- TypeORM + MySQL (`mysql2`)
- Swagger (`@nestjs/swagger`) at `/api`
- class-validator + class-transformer
- JWT + Passport (`passport-jwt`)
- Nodemailer + Handlebars email templates (+ MJML where used)
- Nest ConfigModule
- Nest Cache Manager
- Nest EventEmitter
- Nest Throttler + Helmet
- bcrypt (12 salt rounds)
- Yarn as the package manager

Never introduce new libraries unless asked. Prefer Nest-compatible packages already used in the repo. Do not replace Nest Logger, TypeORM, or Nodemailer with alternate stacks unless explicitly requested.

===================================================================================

- rule name 'Folder Structure'.
- rule description

Organize code under `src/` by domain module:

```
pro-train/
  src/
    auth/
    course/
    test/
    questions/
    answers/
    communications/
    user/
    org/
    branch/
    reports/
    results/
    leaderboard/
    media-manager/
    common/              # RetryService, health, shared types
    migrations/          # TypeORM migrations
    main.ts
    app.module.ts
    data-source.ts
  templates/             # Handlebars email templates (.hbs)
  docs/                  # Architecture & compliance docs
  test/                  # E2E tests
```

Typical feature module layout:

```
course/
  course.module.ts
  course.controller.ts
  course.service.ts
  dto/
  entities/
  *.spec.ts
  README.md              # optional module notes
```

Richer modules may add `services/`, `controllers/`, `guards/`, `decorators/`, `listeners/`, `validators/`, `interfaces/`, `utils/`, `constants/`.

Do not create unnecessary folders. Prefer extending an existing domain module over inventing a parallel structure.

===================================================================================

- rule name 'Module Architecture'.
- rule description

Follow Module → Controller → Service → TypeORM Repository (injected).

Rules:

- Controllers handle HTTP, Swagger metadata, guards, and thin orchestration
- Services own business logic, scoping, caching, and DB access
- Inject TypeORM repositories with `@InjectRepository(Entity)` — do **not** invent a separate custom repository class layer unless already established in that module
- Use `DataSource` for transactions when needed
- Inject `RetryService` for database operations
- Inject `CACHE_MANAGER` when caching is required
- Public service methods that touch tenant data must accept `OrgBranchScope`

Keep controllers thin. Move business logic into services.

===================================================================================

- rule name 'Multi-Tenant Isolation (Mandatory)'.
- rule description

ProTrain is multi-tenant. Follow `docs/module.standard.md` for every module.

Mandatory requirements:

1. **Cache keys must include org/branch**

```typescript
`org:${orgId || 'global'}:branch:${branchId || 'global'}:entity:${id}`
```

2. **Queries must apply org/branch scoping when scope is provided**

```typescript
if (scope.orgId) {
    query.andWhere('entity.orgId = :orgId', { orgId: scope.orgId });
}
if (scope.branchId) {
    query.andWhere('entity.branchId = :branchId', { branchId: scope.branchId });
}
```

3. **All database operations must use RetryService**

```typescript
return this.retryService.executeDatabase(async () => {
    // DB work
});
```

Never ship unscoped list/get queries that can leak cross-tenant data. Cache invalidation helpers must also accept org/branch parameters.

===================================================================================

- rule name 'Authentication & RBAC'.
- rule description

Use the existing JWT + Passport auth stack:

- `JwtAuthGuard` / `AuthGuard('jwt')`
- `RolesGuard` + `@Roles()` where needed
- `OrgRoleGuard` with convenience decorators such as `@AdminOnly()`, `@OwnerOrAdmin()`, `@AnyRole()`, `@MasterAdminOnly()`
- `@OrgBranchScope()` param decorator for `{ orgId?, branchId?, userId, userRole? }`
- `TokenManagerService` for access + refresh tokens
- bcrypt with **12** salt rounds for passwords

Roles: `MASTER_ADMIN`, `OWNER`, `ADMIN`, `USER` (stored as snake_case string values).

Never bypass guards for convenience in production routes. Prefer documenting protected flows in Swagger with `@ApiBearerAuth('JWT-auth')`.

===================================================================================

- rule name 'Standard API Response'.
- rule description

API success payloads follow `StandardResponse<T>` from `src/common/types/standard-response.type.ts`:

```typescript
export interface StandardResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
}
```

Controllers/services should return this shape consistently. Do not invent alternate envelope formats for new endpoints.

Client apps (`protrain-client`, `protrain-mobile`) depend on this contract — changing it requires coordinated updates.

===================================================================================

- rule name 'Swagger Documentation'.
- rule description

Swagger is bootstrapped in `src/main.ts`:

- Title: `protrain api playground`
- UI path: `/api`
- Bearer auth name: `JWT-auth`
- `persistAuthorization: true`

For every controller/endpoint:

- Use `@ApiTags('...')` (project style may include emoji tags)
- Use `@ApiBearerAuth('JWT-auth')` / `@ApiSecurity('JWT-auth')` on protected routes
- Provide `@ApiOperation` with clear summary/description and `operationId` when following existing style
- Document request bodies with `@ApiBody` and useful `examples`
- Document responses with `@ApiResponse` and typed DTOs
- Annotate DTO fields with `@ApiProperty` (`description`, `example`, constraints)

Keep Swagger accurate when changing DTOs or routes. There is **no URI API versioning** today — do not invent `/v1` paths unless explicitly requested as a project-wide change.

===================================================================================

- rule name 'DTOs & Validation'.
- rule description

Use `class-validator` + `class-transformer` on all input DTOs.

Global `ValidationPipe` (in `main.ts`) is configured with:

- `whitelist: true`
- `forbidNonWhitelisted: true`
- `transform: true`

Rules:

- Put DTOs under each module’s `dto/` folder
- Prefer names like `create-*.dto.ts`, `update-*.dto.ts`, `*-response.dto.ts`, `*-filter.dto.ts`
- Provide explicit validation messages (`@IsNotEmpty({ message: 'Course title is required' })`)
- Use `@ValidateNested` + `@Type(() => NestedDto)` for nested objects
- Keep Swagger `@ApiProperty` on the same DTO fields
- Add custom validators under `validators/` when domain rules are non-trivial (e.g. password, exam window order)

Never trust client input. Never accept undeclared properties.

===================================================================================

- rule name 'Logging Format'.
- rule description

Use NestJS built-in `Logger` only. Do not introduce Winston, Pino, or custom logging frameworks unless explicitly requested.

Declare loggers as:

```typescript
private readonly logger = new Logger(CourseService.name);
```

Canonical production log style (follow this for new code):

```typescript
// Business events — template strings with entity/user IDs
this.logger.log(`Sign in successful for identifier: ${loginIdentifier} (userId=${user.id})`);
this.logger.log(`Course ${savedCourse.courseId} created successfully by user ${scope.userId}`);
this.logger.log(`Getting course ${id} for user: ${scope.userId}`);
this.logger.log(`Email sent successfully in ${duration}ms - MessageID: ${result.messageId}`);
this.logger.log(`Results summary email queued for ${templateData.recipientEmail}`);

// Non-fatal failures
this.logger.warn(`Cache get failed for key ${cacheKey}:`, error);
this.logger.warn(`Course ${id} not found in database`, { /* optional context object */ });

// Failures
this.logger.error(`Failed to render template: ${template}`, error);
this.logger.error(`Email send failed after ${duration}ms (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
```

Multi-step operation context prefix (when useful):

```typescript
const logContext = `[Test: ${testId}, Attempt: ${attemptId}, User: ${userId}]`;
this.logger.log(`${logContext} Starting bulk creation of ${count} answers`);
this.logger.error(`${logContext} ${errorMessage}`, { invalidQuestionIds, errors });
```

Retry / categorised errors:

- Use `ErrorCategorizer.formatErrorForLogging(...)` inside RetryService paths
- Example shape: `[CATEGORY/SEVERITY] [key:value, ...] message`

Logging rules:

- Prefer clear English template strings with IDs (`userId`, `courseId`, `testId`, emails where appropriate)
- Use `log` for normal flow, `warn` for recoverable/non-fatal issues, `error` for failures (optionally pass error as second argument)
- Use `debug` for cache hits / verbose diagnostics
- Do **not** copy ultra-verbose emoji step dumps from grading pipelines into new modules unless debugging that pipeline
- Never log secrets, passwords, raw JWTs, or full authorization headers

===================================================================================

- rule name 'TypeORM & Migrations'.
- rule description

Database access uses TypeORM with MySQL.

Rules:

- `synchronize: false` — never rely on auto-sync in shared/dev-prod environments
- Create migrations under `src/migrations/` and run via Yarn TypeORM scripts (`typeorm:migration:run` / revert)
- Use `src/data-source.ts` for CLI migrations
- Register entities explicitly as needed; respect `autoLoadEntities` behaviour in AppModule
- Prefer QueryBuilder + repository methods with org/branch scoping
- Use transactions via `DataSource` for multi-step writes that must be atomic
- Table names are typically plural snake_case (`courses`, `users`)

Never modify production schema manually without a migration.

===================================================================================

- rule name 'Email (Nodemailer)'.
- rule description

Email flows live under `src/communications/`:

- SMTP sending: `email-smtp.service.ts` (Nodemailer)
- Templates: `email-template.service.ts` + root `templates/*.hbs` (and `.txt.hbs` where present)
- Queue: in-memory email queue service (do not assume BullMQ is wired unless you explicitly integrate it)
- Event listeners may trigger emails via EventEmitter

Rules:

- Add/update Handlebars templates in `/templates`
- Send through the communications services — do not open ad-hoc Nodemailer transports in feature modules
- Keep SMTP credentials in env (`SMTP_*`, `EMAIL_*`, `CLIENT_URL`, `APP_NAME`)
- Log queue/send outcomes using the standard logger format
- Prefer retries/backoff already implemented in the SMTP service over custom retry loops

===================================================================================

- rule name 'Error Handling'.
- rule description

Throw NestJS HTTP exceptions from services/controllers:

- `BadRequestException`
- `UnauthorizedException`
- `ForbiddenException`
- `NotFoundException`
- `ConflictException`

Avoid bare `throw new Error(...)` for expected API failures. Prefer user-safe messages.

There is no project-wide custom exception filter by default — do not invent per-module filters unless there is a clear cross-cutting need.

Use `RetryService` + `ErrorCategorizer` for database resilience. Cache failures are often non-fatal: log a `warn` and continue when that matches existing module behaviour.

===================================================================================

- rule name 'Naming Conventions'.
- rule description

| Kind | Convention | Examples |
|------|------------|----------|
| Module folders | domain name (kebab or existing snake) | `course/`, `course-materials/`, `test_attempts/` |
| Module/controller/service files | `{domain}.module.ts`, `.controller.ts`, `.service.ts` | `course.service.ts` |
| Classes | PascalCase | `CourseService`, `AuthController` |
| DTOs | kebab-case files | `create-course.dto.ts` |
| Entities | `*.entity.ts` | `course.entity.ts` |
| Events | `*-created.event.ts` | `course-created.event.ts` |
| Specs | colocated `*.spec.ts` | `course.service.spec.ts` |
| Routes | plural REST resources | `@Controller('courses')` |
| Enums | PascalCase name, snake_case values | `UserRole.MASTER_ADMIN = 'master_admin'` |

Prefer consistency with the surrounding module’s existing naming when folders already use snake_case.

===================================================================================

- rule name 'Configuration & Environment'.
- rule description

Use `@nestjs/config` with global `ConfigModule` and `.env`.

Access values through `ConfigService` — do not scatter `process.env` reads through business logic when ConfigService is available.

Document new variables in `.env-example`. Typical groups:

- `PORT`, `DATABASE_*`
- `JWT_*`
- `SMTP_*`, `EMAIL_*`, `CLIENT_URL`, `APP_NAME`
- GCS / media, cache, feature flags

Never commit secrets. Never hardcode production credentials, JWT secrets, or SMTP passwords.

===================================================================================

- rule name 'Security'.
- rule description

Security baseline already in the app:

- Helmet
- Global ThrottlerGuard
- CORS allowlist for known web/mobile origins
- JWT bearer auth
- bcrypt password hashing (12 rounds)
- ValidationPipe whitelist / forbid non-whitelisted

Rules:

- Never expose secrets in responses or logs
- Keep CORS origins explicit when adding new clients
- Prefer least-privilege role decorators on mutating admin routes
- Validate and sanitise all inputs via DTOs

===================================================================================

- rule name 'Testing'.
- rule description

Use Jest.

- Unit/integration specs colocated as `*.spec.ts` under `src/`
- E2E under `test/` (`test:e2e`)
- Prefer `@nestjs/testing` for module/provider setup
- Cover public service methods and critical controller behaviours for new features
- Follow Arrange–Act–Assert

Do not leave critical auth, scoring, or multi-tenant scoping paths untested when adding new behaviour.

===================================================================================

- rule name 'Code Generation Rules'.
- rule description

When generating a new feature/module, always create:

- module / controller / service
- entities (if persistence is required)
- DTOs with class-validator + Swagger `@ApiProperty`
- org/branch scoping + cache key helpers where applicable
- RetryService-wrapped DB access
- StandardResponse-compatible return shapes
- unit specs for the service (and controller when non-trivial)
- Swagger annotations on all endpoints

Do not leave TODOs or placeholder implementations. Generate production-ready code.

===================================================================================

- rule name 'Formatting & Lint'.
- rule description

Follow project Prettier settings:

- `singleQuote: true`
- `trailingComma: "all"`
- `tabWidth: 4`
- `printWidth: 80`
- `semi: true`

Run `yarn lint` / `yarn format` as appropriate. Keep English-only code, comments, and commit messages.

===================================================================================

- rule name 'TypeScript Strictness'.
- rule description

All new code must be strongly typed.

Rules:

- No `any` in new code (avoid widening `StandardResponse` generics with untyped data when a concrete type exists)
- Prefer interfaces for object contracts and DTO classes for validated input
- Explicit return types on exported service methods
- Prefer enums/unions for roles, statuses, and question types
- One clear responsibility per class/file

===================================================================================

- rule name 'Cross-Client Compatibility'.
- rule description

Breaking API changes affect both `protrain-client` and `protrain-mobile`.

Before changing endpoints, auth envelopes, or `StandardResponse` shapes:

1. Prefer additive changes (new fields/endpoints)
2. Keep Swagger examples updated
3. Coordinate client service updates when contracts change
4. Preserve org/branch semantics expected by both clients

===================================================================================

- rule name 'Feature Completeness Checklist'.
- rule description

Before considering a backend feature done:

1. Module wired in `AppModule` (or feature import graph)
2. DTOs validated + Swagger documented
3. Guards/roles applied correctly
4. `OrgBranchScope` + query scoping + cache keys compliant
5. DB ops via `RetryService`
6. Returns `StandardResponse` (or established module equivalent)
7. Logs use Nest `Logger` in the canonical format
8. Email (if any) goes through communications/Nodemailer services
9. Migration added when schema changes
10. Specs cover happy path + key failure/tenant cases
11. No secrets hardcoded

===================================================================================
