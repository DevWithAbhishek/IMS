# IMS — Complete Project Structure

**Stack:** Node.js · TypeScript · PostgreSQL · Prisma · Redis · BullMQ · Next.js · Tailwind · Docker  
**Style:** Monorepo · Feature-module backend · App Router frontend · Separate deployment pipelines

---

## Table of Contents

1. [Monorepo root](#monorepo-root)
2. [Backend — folder responsibilities](#backend-folder-responsibilities)
3. [Domain module design](#domain-module-design)
4. [Frontend — folder responsibilities](#frontend-folder-responsibilities)
5. [Feature-based vs layer-based — decision](#feature-based-vs-layer-based)
6. [Module file examples](#module-file-examples)
7. [System-wide files](#system-wide-files)
8. [Testing structure](#testing-structure)
9. [Scaling to 10 engineers](#scaling-to-10-engineers)
10. [Final recommended tree](#final-recommended-tree)
11. [CTO review](#cto-review)

---

## Monorepo root

```
ims/
├── backend/                  # Node.js API + BullMQ workers
├── frontend/                 # Next.js dashboard
├── docs/                     # Architecture, decisions, runbooks
├── .github/
│   └── workflows/
│       ├── backend-ci.yml    # Lint → test → build → deploy backend
│       └── frontend-ci.yml   # Lint → test → build → deploy frontend
├── docker-compose.yml        # Local dev: app + worker + postgres + redis
├── docker-compose.prod.yml   # Production overrides
├── .env.example              # All required env vars with descriptions
└── README.md
```

**Why separate CI files:** Backend and frontend deploy independently. A frontend-only change should not rebuild the Docker image and restart the worker process. Separate pipelines enforce this boundary.

---

## Backend — folder responsibilities

### `backend/`

```
backend/
├── src/
├── prisma/
├── tests/
├── scripts/
├── Dockerfile
├── Dockerfile.worker
├── package.json
├── tsconfig.json
├── tsconfig.build.json       # Excludes tests from production build
└── .env.example
```

**Two Dockerfiles:** The API and worker share source code but have different entrypoints. `Dockerfile` starts `src/server.ts`. `Dockerfile.worker` starts `src/worker.ts`. Same image base, different CMD. A crashed worker does not take down the API.

---

### `backend/src/`

The entire application lives here. Nothing outside `src/` is imported by application code — only by tests and scripts.

```
backend/src/
├── server.ts          # Express app bootstrap + HTTP server
├── worker.ts          # BullMQ worker bootstrap
├── app.ts             # Express app factory (used by both server and tests)
├── modules/           # Feature modules — the core of the application
├── shared/            # Cross-module utilities and types
├── infrastructure/    # External system wrappers (DB, Redis, queues)
├── middleware/        # Express middleware chain
├── config/            # Environment config and validation
└── telemetry/         # OpenTelemetry setup
```

---

### `backend/src/modules/`

Each module owns a vertical slice: routes → controller → service → repository → types. Modules do not import from each other's internals — only from each other's `index.ts` public interface.

```
backend/src/modules/
├── incidents/
├── alerts/
├── escalations/
├── notifications/
├── postmortems/
├── oncall/
├── auth/
└── users/
```

**Rule:** A module is allowed to import another module's service via its `index.ts`. It must never import another module's repository, validator, or internal types directly. The public interface is the contract.

---

### `backend/src/shared/`

Code that is genuinely used by more than one module and has no business logic of its own.

```
backend/src/shared/
├── types/
│   ├── api-response.types.ts    # StandardApiResponse<T>, PaginatedResponse<T>
│   ├── pagination.types.ts      # CursorPaginationParams, CursorPaginationResult
│   └── index.ts
├── constants/
│   ├── http-status.ts           # HTTP status code constants
│   ├── error-codes.ts           # Application error code enum
│   └── index.ts
├── errors/
│   ├── app-error.ts             # Base AppError class
│   ├── not-found.error.ts
│   ├── forbidden.error.ts
│   ├── conflict.error.ts
│   ├── validation.error.ts
│   └── index.ts
└── utils/
    ├── fingerprint.ts           # SHA-256 alert fingerprint computation
    ├── cursor.ts                # Cursor encode/decode for pagination
    ├── date.ts                  # Date arithmetic helpers
    └── index.ts
```

**What belongs here:** Types and utilities with zero business logic and no module-specific knowledge.  
**What does not belong here:** Anything that imports Prisma, Redis, or BullMQ. That goes in `infrastructure/`. Anything that contains business rules. That goes in a module's service.

---

### `backend/src/infrastructure/`

Wrappers around external dependencies. Application code never imports `@prisma/client` directly — it imports from here. This boundary makes testing easier and makes dependency swap decisions localised.

```
backend/src/infrastructure/
├── database/
│   ├── prisma.ts                # PrismaClient singleton with connection handling
│   ├── health.ts                # DB connectivity check for /health endpoint
│   └── index.ts
├── cache/
│   ├── redis.ts                 # Redis client singleton
│   ├── keys.ts                  # Redis key naming conventions
│   └── index.ts
├── queues/
│   ├── queue-factory.ts         # Creates named BullMQ queues
│   ├── queue.names.ts           # Queue name constants
│   ├── queues.ts                # Exports: escalationQueue, notificationQueue, slaQueue
│   └── index.ts
├── outbox/
│   ├── outbox.poller.ts         # 500ms poller: reads pending_jobs, enqueues to BullMQ
│   ├── outbox.writer.ts         # Writes job descriptions to pending_jobs table
│   └── index.ts
└── providers/
    ├── email/
    │   ├── email.provider.interface.ts
    │   ├── resend.provider.ts
    │   └── index.ts
    └── slack/
        ├── slack.provider.interface.ts
        ├── slack-webhook.provider.ts
        └── index.ts
```

**Why `outbox/` is infrastructure:** The outbox poller is infrastructure plumbing — it moves data between Postgres and BullMQ. It has no business logic. It does not know what an escalation is. It reads rows, enqueues jobs, marks rows processed.

**Why `providers/` uses interfaces:** `NotificationService` depends on `IEmailProvider`, not on `ResendProvider`. Tests inject a mock. Production injects Resend. Swapping providers is a one-line config change.

---

### `backend/src/middleware/`

Express middleware functions. Ordered by where they appear in the pipeline.

```
backend/src/middleware/
├── request-id.middleware.ts     # Attaches X-Request-ID to every request
├── logger.middleware.ts         # Pino HTTP request logging
├── cors.middleware.ts           # CORS configuration
├── rate-limiter.middleware.ts   # Redis sliding window rate limiting
├── hmac-verify.middleware.ts    # Webhook HMAC-SHA256 verification
├── auth.middleware.ts           # JWT verification, attaches req.user
├── rbac.middleware.ts           # Role check factory: requireRole('ADMIN')
├── ownership.middleware.ts      # Resource ownership check: requireAssignee()
├── error-handler.middleware.ts  # Global error handler — maps AppError to HTTP
└── index.ts
```

**Rule:** Middleware files contain one function each. No business logic. No database queries except what is necessary for the check (e.g., `auth.middleware.ts` queries the user to verify `isActive`).

---

### `backend/src/config/`

All environment variables are read and validated here. Nothing else in the application reads `process.env` directly.

```
backend/src/config/
├── env.ts                       # Zod schema validation of all env vars
├── app.config.ts                # Application config object (assembled from env)
├── queue.config.ts              # BullMQ job options per queue
├── sla.config.ts                # Default SLA targets by severity
└── index.ts
```

**Why env validation at startup:** A missing `DATABASE_URL` should crash the process immediately on startup with a clear error, not at the first database query. Zod schema validation in `env.ts` runs before any other code. If it fails, the process exits with a list of all missing or malformed variables.

---

### `backend/src/telemetry/`

OpenTelemetry instrumentation. Must be bootstrapped before any other import to intercept HTTP and database spans correctly.

```
backend/src/telemetry/
├── tracer.ts                    # OTel TracerProvider setup
├── metrics.ts                   # Prometheus metrics: counters, histograms
│                                #   incidents_created_total
│                                #   escalation_jobs_fired_total
│                                #   notification_delivery_duration_ms
│                                #   sla_breach_total
├── logger.ts                    # Pino structured logger with correlation IDs
└── index.ts
```

---

### `backend/prisma/`

```
backend/prisma/
├── schema.prisma                # Single source of truth for the data model
├── migrations/                  # Timestamped migration directories
│   ├── 20260101_init/
│   │   └── migration.sql
│   ├── 20260115_add_sla_fields/
│   │   └── migration.sql
│   └── ...
└── seed.ts                      # Seed: 3 users, 2 services, 1 policy, schedules
```

---

## Domain module design

Each module follows the same internal structure. Boundaries are enforced by the rule: **only `index.ts` is public**.

### Standard module layout

```
modules/incidents/
├── index.ts                     # Public interface: exports routes, types, service
├── incident.routes.ts           # Express Router: defines HTTP endpoints
├── incident.controller.ts       # Request/response handling only
├── incident.service.ts          # Business logic
├── incident.repository.ts       # DB queries via Prisma
├── incident.validator.ts        # Zod schemas for all request bodies
├── incident.types.ts            # TypeScript types specific to this module
├── incident.constants.ts        # Module-scoped constants
└── __tests__/
    ├── incident.service.test.ts
    └── incident.repository.test.ts
```

### Module dependency rules

```
routes → controller → service → repository
                   ↓
             other module's
             index.ts (service only)
```

A controller imports its module's service. A service imports its module's repository plus other modules' services via their `index.ts`. No module imports another module's repository. No module imports another module's types file — only the types re-exported from `index.ts`.

---

### Incident module

```
modules/incidents/
├── index.ts
├── incident.routes.ts
│   Routes:
│   GET    /incidents           list with cursor pagination + filters
│   POST   /incidents           manual creation
│   GET    /incidents/:id       single incident + assignee + service
│   PATCH  /incidents/:id/acknowledge
│   PATCH  /incidents/:id/mitigate
│   PATCH  /incidents/:id/resolve
│   PATCH  /incidents/:id/assign       (ADMIN only)
│   GET    /incidents/:id/timeline
│   POST   /incidents/:id/comments
│
├── incident.controller.ts
│   Responsibilities: parse request, call service, shape response
│   Must NOT: contain business logic, query DB directly
│
├── incident.service.ts
│   Responsibilities:
│   - createIncident(): transaction — insert incident + CREATED event + outbox write
│   - acknowledge(): conditional UPDATE + cancel escalation job
│   - resolve(): compute mttr, set slaBreached, insert RESOLVED event
│   - validateTransition(): checks FSM before every state change
│   - resolveOnCall(): delegates to OncallService
│
├── incident.repository.ts
│   Responsibilities: all Prisma queries for incidents table
│   Notable methods:
│   - findByIdWithRelations(): includes assignee, service, events
│   - updateStatusConditional(): WHERE status = $expected, returns updated row
│   - listWithCursor(): cursor-based pagination query
│
├── incident.validator.ts
│   Zod schemas:
│   - CreateIncidentSchema
│   - ResolveIncidentSchema (requires resolutionNotes, non-empty)
│   - AssignIncidentSchema
│   - ListIncidentsQuerySchema (pagination + filters)
│
├── incident.types.ts
│   - IncidentWithRelations
│   - IncidentListItem
│   - CreateIncidentDto
│   - ResolveIncidentDto
│   - IncidentTimeline (ordered event array)
│
└── incident.constants.ts
    - VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]>
    - TERMINAL_STATES: IncidentStatus[]
```

---

### Alert ingestion module

```
modules/alerts/
├── index.ts
├── alert.routes.ts
│   Routes:
│   POST   /webhooks/alerts                 generic ingestion
│   POST   /webhooks/alerts/:service_slug   service-scoped ingestion
│   GET    /webhooks/integrations           list integrations (ADMIN)
│   POST   /webhooks/integrations           create integration (ADMIN)
│   DELETE /webhooks/integrations/:id       revoke integration (ADMIN)
│
├── alert.controller.ts
│
├── alert.service.ts
│   Responsibilities:
│   - ingestAlert(): compute fingerprint → check Redis → attempt DB insert
│   - handleDuplicate(): return idempotent 200
│   - normalizePayload(): map provider-specific fields to canonical AlertDto
│   - classifyAlert(): enqueue ai:classify job (non-blocking)
│
├── alert.repository.ts
│   - insertIfNotExists(): upsert with conflict on fingerprint
│
├── alert.validator.ts
│   - WebhookAlertSchema (accepts any JSON, minimal required fields)
│   - GrafanaAlertSchema (provider-specific mapping)
│   - OtelAlertSchema
│
├── alert.types.ts
│   - AlertDto (canonical alert shape after normalisation)
│   - WebhookIntegration
│   - AlertProvider: 'GRAFANA' | 'OTEL' | 'CUSTOM'
│
├── integrations/
│   ├── grafana.normalizer.ts    # Maps Grafana webhook payload to AlertDto
│   ├── otel.normalizer.ts       # Maps OpenTelemetry alert to AlertDto
│   └── index.ts
│
└── __tests__/
    ├── alert.service.test.ts
    └── alert-ingestion.integration.test.ts  # Concurrent dedup test lives here
```

---

### Escalation module

```
modules/escalations/
├── index.ts
├── escalation.routes.ts
│   Routes:
│   GET    /policies              list escalation policies
│   POST   /policies              create policy + levels (ADMIN)
│   GET    /policies/:id
│   PATCH  /policies/:id          update metadata (ADMIN)
│   PUT    /policies/:id/levels   replace levels atomically (ADMIN)
│   DELETE /policies/:id          soft-delete, blocked if active incidents (ADMIN)
│
├── escalation.controller.ts
│
├── escalation.service.ts
│   Responsibilities:
│   - scheduleEscalation(): write level-1 job to outbox on incident creation
│   - cancelEscalation(): Job.remove() + mark escalation_jobs CANCELLED
│   - resolveNextLevel(): query policy levels, skip inactive users
│   - handleChainExhaustion(): broadcast to admins, insert EXHAUSTED event
│
├── escalation.worker.ts          # BullMQ worker function for escalation queue
│   Execution steps:
│   1. Idempotency check (escalation_jobs)
│   2. State guard (incident must be OPEN)
│   3. Resolve next active user
│   4. Transaction: update assignee + insert ESCALATED event + write next job to outbox
│   5. Enqueue notification
│
├── escalation.repository.ts
│   - findPendingJobByIncidentLevel()
│   - markJobFired()
│   - markJobCancelled()
│   - insertPendingJob() — writes to outbox, not directly to BullMQ
│
├── escalation.validator.ts
│   - CreatePolicySchema (includes nested levels array)
│   - UpdatePolicyLevelsSchema
│
├── escalation.types.ts
│   - EscalationPolicy
│   - EscalationLevel
│   - EscalationJobPayload
│   - EscalationResult: 'ESCALATED' | 'NO_OP' | 'EXHAUSTED'
│
└── escalation.constants.ts
    - MIN_ACKNOWLEDGEMENT_TIMEOUT_SECONDS: 60
    - MAX_ESCALATION_LEVELS: 10
```

---

### Notification module

```
modules/notifications/
├── index.ts
├── notification.routes.ts
│   Routes:
│   GET    /users/me/notifications    own delivery history
│   GET    /notifications/:id         delivery detail (ADMIN)
│
├── notification.worker.ts            # BullMQ worker for notification queue
│   Execution steps:
│   1. Resolve user channel config at execution time (not at enqueue time)
│   2. Attempt primary channel
│   3. On retryable failure: BullMQ handles retry with backoff config
│   4. On non-retryable failure: skip to fallback channel
│   5. On all channels exhausted: mark DEAD_LETTERED, insert NOTIFICATION_FAILED event
│
├── notification.service.ts
│   Responsibilities:
│   - enqueueNotification(): writes to outbox, never directly to queue
│   - buildNotificationPayload(): assembles context object per event type
│   - resolveChannels(): reads user preference, returns ordered channel list
│
├── notification.repository.ts
│   INSERT-only interface on notification_deliveries
│   Methods: createDelivery(), updateDeliveryStatus(), findByIncidentId()
│   No UPDATE that changes status backward (SENT → PENDING is invalid)
│
├── notification.validator.ts
│
├── notification.types.ts
│   - NotificationChannel: 'EMAIL' | 'SLACK'
│   - DeliveryStatus: 'PENDING' | 'SENT' | 'FAILED' | 'DEAD_LETTERED'
│   - NotificationJobPayload
│   - DeliveryResult: { success: boolean; retryable: boolean; providerId?: string }
│
├── templates/
│   ├── incident-created.template.ts
│   ├── escalated.template.ts
│   ├── sla-warning.template.ts
│   ├── resolved.template.ts
│   └── index.ts
│
└── __tests__/
    └── notification-delivery.integration.test.ts  # Dead-letter test lives here
```

---

### Postmortem module

```
modules/postmortems/
├── index.ts
├── postmortem.routes.ts
│   Routes:
│   POST   /incidents/:id/postmortem
│   GET    /incidents/:id/postmortem
│   PATCH  /incidents/:id/postmortem
│   POST   /incidents/:id/postmortem/publish   (ADMIN)
│
├── postmortem.controller.ts
├── postmortem.service.ts
│   - createPostmortem(): validates incident is RESOLVED, inserts DRAFT
│   - generateTimeline(): query incident_events in order, format for display
│   - publish(): FSM transition to PUBLISHED, set publishedAt (write-once)
│
├── postmortem.repository.ts
├── postmortem.validator.ts
│   - CreatePostmortemSchema
│   - UpdatePostmortemSchema (content fields, action_items)
│
└── postmortem.types.ts
    - PostmortemStatus: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED'
    - ActionItem: { description: string; ownerId: string; dueDate: Date; completed: boolean }
```

---

### Auth module

```
modules/auth/
├── index.ts
├── auth.routes.ts
│   POST   /auth/login
│   POST   /auth/refresh
│   POST   /auth/logout
│
├── auth.controller.ts
├── auth.service.ts
│   - login(): Argon2 verify, issue access JWT + refresh token
│   - refresh(): validate family, rotate token, issue new pair
│   - logout(): invalidate refresh token
│   - detectFamilyReuse(): if token already invalidated, revoke all user tokens
│
├── auth.repository.ts
│   Manages refresh_tokens table
│   - insert(), invalidate(), invalidateAllForUser()
│
├── auth.validator.ts
│   - LoginSchema: { email: string; password: string }
│
└── auth.types.ts
    - TokenPair: { accessToken: string; refreshToken: string }
    - JwtPayload: { sub: string; role: UserRole; iat: number; exp: number }
```

---

## Frontend — folder responsibilities

```
frontend/
├── src/
│   ├── app/                     # Next.js App Router pages
│   ├── components/              # Shared, reusable UI components
│   ├── features/                # Feature-specific components and logic
│   ├── services/                # API client functions
│   ├── hooks/                   # Custom React hooks
│   ├── providers/               # Context providers and React Query setup
│   ├── stores/                  # Zustand global state
│   ├── types/                   # TypeScript types shared across features
│   ├── lib/                     # Low-level utilities
│   ├── constants/               # Application-wide constants
│   └── validations/             # Zod schemas for form validation
├── public/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── Dockerfile
```

---

### `app/` — Next.js App Router

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── layout.tsx              # Unauthenticated layout (no sidebar)
├── (dashboard)/
│   ├── layout.tsx              # Authenticated layout: sidebar + header
│   ├── page.tsx                # Dashboard overview: open incidents + metrics
│   ├── incidents/
│   │   ├── page.tsx            # Incident list with filters
│   │   └── [id]/
│   │       ├── page.tsx        # Incident detail + timeline
│   │       └── postmortem/
│   │           └── page.tsx
│   ├── on-call/
│   │   └── page.tsx            # Schedule overview + who is on call now
│   ├── policies/
│   │   └── page.tsx            # Escalation policy management (ADMIN)
│   └── settings/
│       └── page.tsx
└── api/
    └── auth/
        └── [...nextauth]/      # If using NextAuth (optional)
```

---

### `components/` — shared UI only

Components with no business logic. Reusable across multiple features.

```
components/
├── ui/                          # Shadcn-style primitives: Button, Input, Badge
├── layout/
│   ├── Sidebar.tsx
│   ├── Header.tsx
│   └── PageShell.tsx           # Standard page wrapper: title + children
├── feedback/
│   ├── EmptyState.tsx
│   ├── LoadingSpinner.tsx
│   └── ErrorBoundary.tsx
└── data/
    ├── DataTable.tsx            # Generic sortable/filterable table
    └── CursorPagination.tsx
```

**What belongs here:** Generic UI components with no knowledge of incidents, escalations, or IMS concepts.  
**What does not belong here:** Components that call the API, import feature-specific types, or contain routing logic.

---

### `features/` — feature-specific UI

Mirrors the backend module structure. Each feature owns its own components, hooks, and local state.

```
features/
├── incidents/
│   ├── components/
│   │   ├── IncidentList.tsx        # Calls useIncidents(), renders rows
│   │   ├── IncidentRow.tsx         # Single row: severity badge, status, assignee
│   │   ├── IncidentDetail.tsx      # Full incident view
│   │   ├── IncidentTimeline.tsx    # Ordered event list
│   │   ├── AcknowledgeButton.tsx   # Disabled unless user is assignee
│   │   ├── ResolveModal.tsx        # Form: resolutionNotes required
│   │   └── SeverityBadge.tsx       # P0/P1/P2/P3 with colour coding
│   ├── hooks/
│   │   ├── useIncidents.ts         # React Query: GET /incidents
│   │   ├── useIncident.ts          # React Query: GET /incidents/:id
│   │   └── useIncidentMutations.ts # acknowledge, resolve, assign
│   └── types.ts                    # Frontend-specific incident display types
├── alerts/
│   ├── components/
│   │   └── IntegrationList.tsx
│   └── hooks/
│       └── useIntegrations.ts
├── oncall/
│   ├── components/
│   │   ├── OnCallSchedule.tsx
│   │   └── CurrentOnCall.tsx
│   └── hooks/
│       └── useOnCall.ts
├── postmortems/
│   ├── components/
│   │   ├── PostmortemEditor.tsx
│   │   └── ActionItemList.tsx
│   └── hooks/
│       └── usePostmortem.ts
└── reporting/
    ├── components/
    │   ├── MttrChart.tsx           # Recharts bar chart: avg MTTR by severity
    │   ├── SlaBreachRate.tsx
    │   └── IncidentVolumeChart.tsx
    └── hooks/
        └── useReporting.ts
```

---

### `services/` — API client layer

All `fetch` calls live here. React Query hooks call these functions. No component calls `fetch` directly.

```
services/
├── api-client.ts               # Base fetch wrapper: auth headers, error parsing
├── incidents.service.ts        # getIncidents(), getIncident(), acknowledge(), resolve()
├── alerts.service.ts           # getIntegrations(), createIntegration()
├── auth.service.ts             # login(), logout(), refreshToken()
├── oncall.service.ts           # getSchedules(), getCurrentOnCall()
├── postmortems.service.ts
└── reporting.service.ts
```

---

### `stores/` — Zustand global state

Only state that is genuinely global: auth session, notification toasts, sidebar collapsed state.

```
stores/
├── auth.store.ts               # Current user, accessToken, logout action
├── ui.store.ts                 # Sidebar state, active filters persistence
└── toast.store.ts              # Notification toasts: success, error, warning
```

**What belongs here:** State that persists across route changes or is needed in deeply nested components without prop drilling.  
**What does not belong here:** Server state (that belongs in React Query). Form state (use react-hook-form locally). Component state (use useState).

---

### `providers/`

```
providers/
├── QueryProvider.tsx           # React Query client configuration
├── AuthProvider.tsx            # Reads auth store, redirects on 401
└── index.tsx                   # Wraps all providers, used in root layout
```

---

## Feature-based vs layer-based — decision

### Layer-based (Option A)

```
src/
├── controllers/
│   ├── incident.controller.ts
│   ├── alert.controller.ts
│   └── escalation.controller.ts
├── services/
│   ├── incident.service.ts
│   └── ...
└── repositories/
    └── ...
```

**Pros:** Simple mental model for small projects. All services in one place.  
**Cons:** As the codebase grows, related files are spread across three folders. Touching one feature requires navigating the entire project. Feature ownership is unclear — who owns `incident.service.ts`? The answer is "everyone," which means no one.

### Feature-based (Option B)

```
src/modules/
├── incidents/    (all incident-related files together)
├── alerts/
└── escalations/
```

**Pros:** A developer working on escalations touches only `modules/escalations/`. Code review is contained. Feature boundaries are explicit. Scales to 10 engineers by assigning module ownership.  
**Cons:** Shared logic needs a deliberate home (`shared/`). Cross-cutting concerns (auth, logging) need to be explicitly separated.

### Recommendation: Feature-based, with a shared/ boundary

The IMS has domain complexity that justifies the overhead. The escalation module has a worker, a repository, types, constants, and tests. Spreading these across `workers/`, `repositories/`, `types/`, and `tests/` makes the escalation feature impossible to understand at a glance. Colocating everything in `modules/escalations/` makes it immediately comprehensible.

The rule that enforces the structure: **cross-module imports are only allowed via each module's `index.ts`**. A linter rule (`eslint-plugin-import` with `no-restricted-imports`) can enforce this automatically.

---

## Module file examples

### `incident.service.ts` — responsibilities

```typescript
// What this file is responsible for:
// - All incident business logic
// - State machine transition validation
// - Orchestrating writes across incident + event + outbox
// - Delegating to OncallService for assignment
// - Delegating to EscalationService for scheduling

// What it must NOT do:
// - Import @prisma/client directly (use repository)
// - Contain HTTP request/response handling (that is the controller)
// - Know about email or Slack (that is the notification module)
// - Access process.env (use config/)
```

### `incident.repository.ts` — responsibilities

```typescript
// What this file is responsible for:
// - All Prisma queries for the incidents and incident_events tables
// - Cursor-based pagination query construction
// - Conditional UPDATE for state transitions

// What it must NOT do:
// - Contain business logic (no FSM validation)
// - Call other repositories
// - Import from any module other than infrastructure/database

// Critical method: updateStatusConditional
// Returns the updated row if the WHERE clause matched, null if it didn't.
// The caller (service) decides what a null return means — it does not throw.
```

### `incident.validator.ts` — responsibilities

```typescript
// What this file is responsible for:
// - Zod schemas for all HTTP request bodies that touch this module
// - Inferred TypeScript types from those schemas

// What it must NOT do:
// - Validate business invariants (is this status transition valid?)
//   That is the service's job.
// - Query the database (is this service_id real?)
//   Constraint violations are caught at DB layer.

// Rule: validators check shape and format.
// Services check business rules.
// DB enforces integrity.
```

### `escalation.worker.ts` — responsibilities

```typescript
// What this file is responsible for:
// - Processing jobs from the escalation BullMQ queue
// - Idempotency check before any action
// - State guard check before any action
// - Delegating business logic to EscalationService

// What it must NOT do:
// - Contain business logic directly (query policies, resolve users)
// - Import Prisma directly
// - Catch all errors silently — let BullMQ handle retry

// Critical property: this file must be idempotent.
// Running it twice with the same payload must produce the same result.
// The idempotency key check at the top of the function enforces this.
```

### `notification.worker.ts` — responsibilities

```typescript
// What this file is responsible for:
// - Processing jobs from the notification BullMQ queue
// - Resolving user channel config at execution time (not enqueue time)
// - Routing between primary and fallback channels
// - Recording every delivery attempt (success and failure)

// What it must NOT do:
// - Throw on provider failure (return { success: false, retryable: true })
// - Call next() on a non-retryable error — go to fallback instead
// - Assume the user's Slack webhook is still valid (it may have changed since enqueue)
```

---

## System-wide files

### `src/app.ts` — Express app factory

```
Responsibility: create and configure the Express application.
Used by: server.ts (production), supertest (integration tests).
Contains:
  - Middleware registration in correct order
  - Route mounting
  - Error handler registration (must be last)
Does NOT: start the HTTP server (that is server.ts)
```

### `src/server.ts` — HTTP server bootstrap

```
Responsibility: create HTTP server, start listening, handle graceful shutdown.
Contains:
  - import app from './app'
  - import telemetry (must be first import in the file)
  - server.listen()
  - SIGTERM handler: drain connections, close DB pool, close Redis
```

### `src/worker.ts` — BullMQ worker bootstrap

```
Responsibility: register all job processors, start the outbox poller.
Contains:
  - Import and register: escalation.worker, notification.worker, sla.worker
  - Start outbox poller
  - SIGTERM handler: stop accepting new jobs, wait for in-progress jobs
```

### `src/telemetry/logger.ts` — Pino structured logger

```
Responsibility: single logger instance used by the entire application.
Configuration:
  - Structured JSON output in production
  - Pretty-print in development
  - Correlation ID (X-Request-ID) bound to child logger per request
  - Redacts: password, token, authorization header values
```

### `src/infrastructure/database/prisma.ts` — PrismaClient singleton

```
Responsibility: single PrismaClient instance with connection lifecycle.
Contains:
  - PrismaClient instantiation with log levels from config
  - $connect() called at app startup
  - $disconnect() called in SIGTERM handler
  - Query event listener for slow query logging (> 500ms threshold)
```

### `src/infrastructure/outbox/outbox.poller.ts` — transactional outbox poller

```
Responsibility: move pending_jobs rows into BullMQ.
Interval: 500ms
Logic:
  1. SELECT id, type, payload, delay FROM pending_jobs WHERE status = 'PENDING' LIMIT 50
  2. For each row: queue.add(type, payload, { delay })
  3. UPDATE pending_jobs SET status = 'ENQUEUED' WHERE id IN (...)
  4. On enqueue failure: log error, leave status as PENDING (will retry next poll)
Note: LIMIT 50 prevents a single poll from overwhelming BullMQ on backlog
```

### `src/config/env.ts` — environment validation

```
Responsibility: parse and validate all process.env values at startup.
Tool: Zod
Behaviour on failure: process.exit(1) with a list of all validation errors
This runs before any other import. A missing DATABASE_URL crashes immediately,
not on the first query 30 minutes into operation.
```

### `src/middleware/error-handler.middleware.ts` — global error handler

```
Responsibility: map AppError subclasses to HTTP responses.
Catches:
  - AppError subclasses → mapped status code + error code
  - PrismaClientKnownRequestError:
      P2002 (unique constraint) → 409 Conflict
      P2025 (record not found) → 404 Not Found
  - ZodError → 422 Unprocessable Entity
  - Unknown errors → 500, error logged at ERROR level, opaque message to client
Never exposes: stack traces, internal error messages, SQL in HTTP responses
```

---

## Testing structure

```
backend/tests/
├── unit/
│   ├── modules/
│   │   ├── incidents/
│   │   │   └── incident.service.test.ts
│   │   ├── escalations/
│   │   │   └── escalation.service.test.ts
│   │   └── notifications/
│   │       └── notification.service.test.ts
│   └── shared/
│       ├── fingerprint.test.ts
│       └── cursor.test.ts
├── integration/
│   ├── incidents/
│   │   ├── create-incident.test.ts          # Webhook ingestion + dedup
│   │   ├── concurrent-acknowledge.test.ts   # Race condition proof
│   │   └── sla-breach.test.ts               # SLA recording correctness
│   ├── escalations/
│   │   ├── escalation-chain.test.ts         # Multi-level chain execution
│   │   └── escalation-idempotency.test.ts   # At-least-once safety
│   ├── notifications/
│   │   └── dead-letter.test.ts              # Exhausted delivery chain
│   └── auth/
│       └── token-family-rotation.test.ts
├── load/
│   ├── webhook-ingestion.js                 # k6 script
│   └── incident-list.js
└── fixtures/
    ├── factories/
    │   ├── incident.factory.ts              # Creates test incidents with overrides
    │   ├── user.factory.ts
    │   └── policy.factory.ts
    └── database.ts                          # Test DB setup/teardown helpers
```

### Naming conventions

| Test type | Location | Suffix | Uses real DB? |
|---|---|---|---|
| Unit | `tests/unit/modules/` | `.test.ts` | No — mocked repository |
| Integration | `tests/integration/` | `.test.ts` | Yes — test DB container |
| Load | `tests/load/` | `.js` (k6) | Yes — running app |

### What each test type covers

**Unit tests** test the service layer in isolation. The repository is mocked. The test verifies that the service calls the repository with the right arguments and returns the right result. These run in under 1 second each.

**Integration tests** spin up a real Postgres database (via Docker in CI) and run the actual application code end-to-end through the HTTP layer using `supertest`. These are the tests that prove correctness — the concurrent ack test, the idempotent webhook test, and the audit log permission test all live here.

**Load tests** use k6 against a running application instance. Results are documented in `LOAD_TESTING.md`. They do not run in CI — they are run manually and results committed.

---

## Scaling to 10 engineers

### Structure that scales

Feature-module structure scales linearly. Assign module ownership:

| Engineer(s) | Module ownership |
|---|---|
| 2 engineers | `incidents/` + `alerts/` |
| 2 engineers | `escalations/` + `oncall/` |
| 1 engineer | `notifications/` |
| 1 engineer | `auth/` + `users/` |
| 1 engineer | `postmortems/` + `reporting/` |
| 1 engineer | `infrastructure/` + `telemetry/` |
| 2 engineers | Frontend |

A developer working on escalations never touches notification code. PRs are small. Reviews are focused.

### Folders that become bottlenecks

**`shared/`** becomes contested. Multiple engineers adding to `shared/types/` creates merge conflicts and unclear ownership. Fix: restrict what can go in `shared/` via a `CODEOWNERS` file. Anything that belongs to a specific domain goes in that module's `types.ts`, not in `shared/`.

**`prisma/schema.prisma`** is a single file. Two engineers adding fields in parallel creates migration conflicts. Fix: feature flags on schema changes, sequential migration PRs, and a brief "I'm touching the schema" announcement in the team channel.

**`middleware/`** grows if engineers add one-off middleware for their feature. Fix: middleware is for cross-cutting concerns only. Feature-specific logic belongs in the feature's controller or service.

### What changes at 100k incidents/day

At ~1.15 incidents per second, the write path is not the bottleneck — the webhook deduplication fingerprint lookup is. The Redis TTL cache becomes critical. At this volume:

- Partition `incidents` and `incident_events` by `created_at` month
- `pg_trgm` full-text index query cost increases — consider extracting search to a dedicated service or using Elasticsearch for the list endpoint
- BullMQ worker pool needs tuning: measure queue depth and add worker instances when depth exceeds 30-second processing lag
- The outbox poller at 500ms becomes insufficient if bulk alert ingestion creates thousands of `pending_jobs` rows simultaneously — implement batch dequeue with LIMIT and advisory locks

---

## Final recommended tree

```
ims/
├── .github/
│   └── workflows/
│       ├── backend-ci.yml
│       └── frontend-ci.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   ├── LOAD_TESTING.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   └── DEBUGGING_JOURNAL.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
└── README.md

backend/
├── Dockerfile                              # API entrypoint
├── Dockerfile.worker                       # Worker entrypoint
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .env.example
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       └── 20260101_init/
│           └── migration.sql
├── src/
│   ├── server.ts
│   ├── worker.ts
│   ├── app.ts
│   ├── config/
│   │   ├── env.ts
│   │   ├── app.config.ts
│   │   ├── queue.config.ts
│   │   ├── sla.config.ts
│   │   └── index.ts
│   ├── telemetry/
│   │   ├── tracer.ts
│   │   ├── metrics.ts
│   │   ├── logger.ts
│   │   └── index.ts
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── prisma.ts
│   │   │   ├── health.ts
│   │   │   └── index.ts
│   │   ├── cache/
│   │   │   ├── redis.ts
│   │   │   ├── keys.ts
│   │   │   └── index.ts
│   │   ├── queues/
│   │   │   ├── queue-factory.ts
│   │   │   ├── queue.names.ts
│   │   │   ├── queues.ts
│   │   │   └── index.ts
│   │   ├── outbox/
│   │   │   ├── outbox.poller.ts
│   │   │   ├── outbox.writer.ts
│   │   │   └── index.ts
│   │   └── providers/
│   │       ├── email/
│   │       │   ├── email.provider.interface.ts
│   │       │   ├── resend.provider.ts
│   │       │   └── index.ts
│   │       └── slack/
│   │           ├── slack.provider.interface.ts
│   │           ├── slack-webhook.provider.ts
│   │           └── index.ts
│   ├── middleware/
│   │   ├── request-id.middleware.ts
│   │   ├── logger.middleware.ts
│   │   ├── cors.middleware.ts
│   │   ├── rate-limiter.middleware.ts
│   │   ├── hmac-verify.middleware.ts
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── ownership.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   └── index.ts
│   ├── shared/
│   │   ├── types/
│   │   │   ├── api-response.types.ts
│   │   │   ├── pagination.types.ts
│   │   │   └── index.ts
│   │   ├── constants/
│   │   │   ├── http-status.ts
│   │   │   ├── error-codes.ts
│   │   │   └── index.ts
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   ├── not-found.error.ts
│   │   │   ├── forbidden.error.ts
│   │   │   ├── conflict.error.ts
│   │   │   ├── validation.error.ts
│   │   │   └── index.ts
│   │   └── utils/
│   │       ├── fingerprint.ts
│   │       ├── cursor.ts
│   │       ├── date.ts
│   │       └── index.ts
│   └── modules/
│       ├── incidents/
│       │   ├── index.ts
│       │   ├── incident.routes.ts
│       │   ├── incident.controller.ts
│       │   ├── incident.service.ts
│       │   ├── incident.repository.ts
│       │   ├── incident.validator.ts
│       │   ├── incident.types.ts
│       │   ├── incident.constants.ts
│       │   └── __tests__/
│       │       ├── incident.service.test.ts
│       │       └── incident.repository.test.ts
│       ├── alerts/
│       │   ├── index.ts
│       │   ├── alert.routes.ts
│       │   ├── alert.controller.ts
│       │   ├── alert.service.ts
│       │   ├── alert.repository.ts
│       │   ├── alert.validator.ts
│       │   ├── alert.types.ts
│       │   ├── integrations/
│       │   │   ├── grafana.normalizer.ts
│       │   │   ├── otel.normalizer.ts
│       │   │   └── index.ts
│       │   └── __tests__/
│       │       └── alert-ingestion.integration.test.ts
│       ├── escalations/
│       │   ├── index.ts
│       │   ├── escalation.routes.ts
│       │   ├── escalation.controller.ts
│       │   ├── escalation.service.ts
│       │   ├── escalation.worker.ts
│       │   ├── escalation.repository.ts
│       │   ├── escalation.validator.ts
│       │   ├── escalation.types.ts
│       │   ├── escalation.constants.ts
│       │   └── __tests__/
│       │       ├── escalation.service.test.ts
│       │       └── escalation-idempotency.integration.test.ts
│       ├── notifications/
│       │   ├── index.ts
│       │   ├── notification.routes.ts
│       │   ├── notification.worker.ts
│       │   ├── notification.service.ts
│       │   ├── notification.repository.ts
│       │   ├── notification.types.ts
│       │   ├── templates/
│       │   │   ├── incident-created.template.ts
│       │   │   ├── escalated.template.ts
│       │   │   ├── sla-warning.template.ts
│       │   │   ├── resolved.template.ts
│       │   │   └── index.ts
│       │   └── __tests__/
│       │       └── dead-letter.integration.test.ts
│       ├── postmortems/
│       │   ├── index.ts
│       │   ├── postmortem.routes.ts
│       │   ├── postmortem.controller.ts
│       │   ├── postmortem.service.ts
│       │   ├── postmortem.repository.ts
│       │   ├── postmortem.validator.ts
│       │   └── postmortem.types.ts
│       ├── oncall/
│       │   ├── index.ts
│       │   ├── oncall.routes.ts
│       │   ├── oncall.controller.ts
│       │   ├── oncall.service.ts
│       │   ├── oncall.repository.ts
│       │   ├── oncall.validator.ts
│       │   └── oncall.types.ts
│       ├── auth/
│       │   ├── index.ts
│       │   ├── auth.routes.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.repository.ts
│       │   ├── auth.validator.ts
│       │   └── auth.types.ts
│       └── users/
│           ├── index.ts
│           ├── users.routes.ts
│           ├── users.controller.ts
│           ├── users.service.ts
│           ├── users.repository.ts
│           ├── users.validator.ts
│           └── users.types.ts
└── tests/
    ├── unit/
    │   └── modules/
    │       ├── incidents/
    │       │   └── incident.service.test.ts
    │       └── escalations/
    │           └── escalation.service.test.ts
    ├── integration/
    │   ├── incidents/
    │   │   ├── create-incident.test.ts
    │   │   ├── concurrent-acknowledge.test.ts
    │   │   └── sla-breach.test.ts
    │   ├── escalations/
    │   │   ├── escalation-chain.test.ts
    │   │   └── escalation-idempotency.test.ts
    │   └── notifications/
    │       └── dead-letter.test.ts
    ├── load/
    │   ├── webhook-ingestion.js
    │   └── incident-list.js
    └── fixtures/
        ├── factories/
        │   ├── incident.factory.ts
        │   ├── user.factory.ts
        │   └── policy.factory.ts
        └── database.ts

frontend/
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── public/
│   └── favicon.ico
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/
    │   │   │   └── page.tsx
    │   │   └── layout.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx
    │   │   ├── incidents/
    │   │   │   ├── page.tsx
    │   │   │   └── [id]/
    │   │   │       ├── page.tsx
    │   │   │       └── postmortem/
    │   │   │           └── page.tsx
    │   │   ├── on-call/
    │   │   │   └── page.tsx
    │   │   ├── policies/
    │   │   │   └── page.tsx
    │   │   └── settings/
    │   │       └── page.tsx
    │   ├── globals.css
    │   └── layout.tsx
    ├── components/
    │   ├── ui/
    │   │   ├── button.tsx
    │   │   ├── badge.tsx
    │   │   ├── input.tsx
    │   │   └── modal.tsx
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   ├── Header.tsx
    │   │   └── PageShell.tsx
    │   └── feedback/
    │       ├── EmptyState.tsx
    │       ├── LoadingSpinner.tsx
    │       └── ErrorBoundary.tsx
    ├── features/
    │   ├── incidents/
    │   │   ├── components/
    │   │   │   ├── IncidentList.tsx
    │   │   │   ├── IncidentRow.tsx
    │   │   │   ├── IncidentDetail.tsx
    │   │   │   ├── IncidentTimeline.tsx
    │   │   │   ├── AcknowledgeButton.tsx
    │   │   │   ├── ResolveModal.tsx
    │   │   │   └── SeverityBadge.tsx
    │   │   ├── hooks/
    │   │   │   ├── useIncidents.ts
    │   │   │   ├── useIncident.ts
    │   │   │   └── useIncidentMutations.ts
    │   │   └── types.ts
    │   ├── oncall/
    │   │   ├── components/
    │   │   │   ├── OnCallSchedule.tsx
    │   │   │   └── CurrentOnCall.tsx
    │   │   └── hooks/
    │   │       └── useOnCall.ts
    │   └── reporting/
    │       ├── components/
    │       │   ├── MttrChart.tsx
    │       │   └── SlaBreachRate.tsx
    │       └── hooks/
    │           └── useReporting.ts
    ├── services/
    │   ├── api-client.ts
    │   ├── incidents.service.ts
    │   ├── auth.service.ts
    │   ├── oncall.service.ts
    │   └── reporting.service.ts
    ├── hooks/
    │   └── useAuth.ts
    ├── providers/
    │   ├── QueryProvider.tsx
    │   ├── AuthProvider.tsx
    │   └── index.tsx
    ├── stores/
    │   ├── auth.store.ts
    │   ├── ui.store.ts
    │   └── toast.store.ts
    ├── types/
    │   ├── incident.types.ts
    │   ├── auth.types.ts
    │   └── api.types.ts
    ├── lib/
    │   └── utils.ts
    └── constants/
        ├── routes.ts
        └── severity.ts
```

---

## CTO review

### What looks junior

**Missing `index.ts` barrel files on every module.** Without them, internal files are directly importable from outside the module. The entire boundary enforcement collapses. Every module must have an `index.ts` that is the only export surface.

**Tests colocated with source vs in a separate `tests/` directory.** Both are valid choices. The problem is mixing them — some tests in `__tests__/` inside modules, some in a top-level `tests/` directory. This structure uses both deliberately: `__tests__/` for unit tests (close to source), `tests/integration/` for integration tests (which need test database setup that lives separately). The distinction must be documented, or the next developer will add tests randomly.

**No `tsconfig.build.json`.** Compiling tests into the production bundle adds seconds to build time and megabytes to image size. `tsconfig.build.json` excludes `tests/` and `**/*.test.ts` from the production build. Two lines. Signals that you've thought about build performance.

### What looks professional

**Two Dockerfiles.** Every engineer who has had an incident caused by a worker crash cascading to the API will immediately respect the process separation. This is one of the first things a senior engineer looks at when reviewing a Node.js project structure.

**Provider interfaces with separate implementations.** `email.provider.interface.ts` alongside `resend.provider.ts` means the notification worker is testable without making real API calls. It also means swapping email providers is a configuration change, not a code change. This is visible immediately in the directory listing.

**Outbox as a first-class infrastructure concern.** Most engineers who implement the transactional outbox pattern bolt it on as a utility function. Having `infrastructure/outbox/` as a named folder signals that you understood it as an architectural pattern, not a hack.

**`config/env.ts` with Zod validation.** This is a senior-level signal. A codebase that reads `process.env.DATABASE_URL` in six different files is a codebase that produces "undefined" errors at the worst possible moment. Centralised, validated config at startup is the professional approach.

### What is overengineering for this stage

**Separate `telemetry/` folder in the frontend.** OpenTelemetry instrumentation on the frontend is a real thing but it is not a portfolio concern. One `lib/analytics.ts` file is sufficient. A dedicated folder suggests you've read about frontend observability without having shipped it.

**`integrations/` subfolder inside `alerts/` with separate normalizer files.** For two alert providers (Grafana and OpenTelemetry), this is premature. A single `alert.normalizers.ts` file with two exported functions is simpler and equally correct. The subfolder pattern is right at five providers.

**Separate `validation/` folder in the frontend alongside Zod schemas.** One location for validation is enough. If form schemas and API response schemas live in two places, they diverge. Colocate Zod schemas with the feature that uses them.

### What is missing

**`CODEOWNERS` file.** Ten engineers without module ownership assignments produce PRs that touch unrelated code and reviews that lack context. A `.github/CODEOWNERS` file that assigns module paths to engineers is a two-minute addition that prevents months of confusion.

**`scripts/` folder in backend.** Every production codebase has database seed scripts, migration dry-run scripts, and one-off data correction scripts. They do not belong in `src/`. A `scripts/` folder at the backend root with a clear README entry prevents them from proliferating into `src/utils/`.

**`docker-compose.test.yml`.** Integration tests need a clean database. Using the dev database for integration tests produces flaky tests when dev state bleeds into test assertions. A separate Compose file with a test database container and automatic teardown is standard practice and signals test discipline.

### What would impress a senior engineer

The `outbox.poller.ts` file existing as a named file with a clear responsibility description. This tells a senior engineer that you know the transactional outbox pattern well enough to have given it a home, not just implemented it as a one-off fix inside a service function.

The `escalation.worker.ts` file existing separately from `escalation.service.ts`. The worker is BullMQ plumbing that delegates to the service. Keeping them separate means the service is testable without a BullMQ instance, and the worker is readable as a thin orchestration layer.

The `__tests__/` folder inside each module for unit tests, with a separate `tests/integration/` at the top level. This distinction — fast isolated unit tests close to source, slow integration tests at the project level — is something most engineers only learn from working in a large codebase.

### What would impress a hiring manager

One command to run the full stack. `docker compose up` starts everything. No README instructions longer than five lines. No manual database setup. No "you need to install Redis globally first." The `docker-compose.yml` at the monorepo root is what this signals.

A green CI badge in the README that links to a GitHub Actions run showing backend tests passing, frontend build passing, and a deployment step. This is the minimum evidence of engineering discipline that a hiring manager can verify without reading a single line of code.
