# IMS — Incident Management System

A backend-first incident response platform, currently in early development. IMS is being built to model the layer every software company eventually needs but rarely builds well: the response layer between "a monitoring tool fired an alert" and "the right human acknowledged it, owns it, and resolved it inside an agreed time window."

**Status: early development.** The project scaffolding — repo layout, Docker Compose environment, and environment configuration — is in place. Feature work (incident CRUD, auth, the state machine, escalation, reliability guarantees) has not started yet. This README describes what exists, what's being built next, and where the project is going — nothing more.

---

## Why this project exists

Datadog, Grafana, and similar tools are excellent at detection. None of them own the human response: who is on call, whether anyone has seen the page, how long it has gone unacknowledged, or whether the response met its SLA. Below a certain company size, that gap is filled by a Slack channel and tribal knowledge — which works until the night it doesn't.

PagerDuty and OpsGenie solve this well, at a real cost — PagerDuty alone runs $12k–$20k/year for a 40-engineer team, plus a nontrivial configuration burden. Jira Service Desk is built for planned work, not a P0 at 2 AM.

**Why I'm building it.** Code generation has made writing code cheap. It hasn't made judgment about failure modes cheap — knowing that a webhook will be retried, that a worker will crash mid-job, that two requests will race on the same row, and designing for those conditions before they're observed in production. That judgment is what this project is meant to demonstrate directly, through implementation rather than description. The reasoning behind every non-default decision — made and to be made — is being recorded as it happens in [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md).

**Why a CTO or engineering manager might want to follow this repo, not just read it once:** the interesting part of this project isn't a finished feature list — it's the sequence of decisions, the trade-offs taken, and the failure modes designed around, visible commit by commit as the system is actually built.

---

## Current progress

| Area | Status |
|---|---|
| Repository structure, monorepo layout | Done |
| Docker Compose local environment (Postgres, Redis) | Done |
| Environment configuration scaffolding (`.env.example`, Zod validation planned) | Done |
| Incident CRUD | Not started |
| Auth (JWT / RBAC) | Not started |
| Incident state machine | Not started |
| Alert ingestion / webhooks | Not started |
| Escalation | Not started |
| Notifications | Not started |
| Transactional outbox / async workers | Not started |
| Observability (logs, metrics, traces) | Not started |
| Frontend dashboard | Not started |

Nothing above "Done" should be read as implemented. This table will be updated as each piece lands — the goal is for this table to always be accurate, not impressive.

---

## Architecture

### Current architecture

A **modular monolith**: a single backend process, feature modules under `src/modules/`, each owning its own routes/service/repository, communicating only through a module's public `index.ts`. There is no separate worker process yet, and no queue is wired in. Postgres is the only real dependency in use so far; Redis is provisioned in Docker Compose but not yet integrated into application code.

### Target architecture

The design this project is being built toward — not the current state:

- Two processes sharing one codebase: an Express API and a BullMQ worker, split out from the monolith once there's real async work (escalation timers, notification retries) that justifies it.
- Postgres as the single source of truth; Redis strictly as a job store, dedup cache, and rate limiter — never authoritative.
- A transactional outbox bridging the two: a state change that must produce an async job writes that job description into Postgres in the same transaction, with an independent poller responsible for getting it into BullMQ.

The split from monolith to API+worker is planned for the phase where escalation and notifications are built (see Roadmap, Phase 2–3) — it is a deliberate "not yet" rather than an oversight. The reasoning for deferring it until then, and for choosing Postgres+BullMQ over Kafka+Kubernetes when it does happen, is recorded in [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) and will be expanded per-decision in `docs/adr/` as those decisions are actually made.

---

## Planned feature set

Not a status report — a plan, organized by how far out each piece is.

### Currently building
- Incident CRUD (create, read, list, update)
- Core Postgres schema for incidents and their history

### Planned for v1
- Five-state incident lifecycle (`OPEN → ACKNOWLEDGED → MITIGATING → RESOLVED`) with concurrency-safe transitions enforced at the database level, not just in application code
- Webhook-based alert ingestion with idempotent handling of retried/flapping alerts
- JWT authentication with role-based access control
- Self-scheduling, multi-level escalation chain
- Multi-channel notifications (email, Slack) with retry and dead-letter handling
- Transactional outbox pattern for crash-safe async work, and the API/worker process split described above
- Append-only audit log for the incident timeline

### Planned after v1
- SLA tracking with pre-breach warnings
- Postmortem workflow (`DRAFT → IN_REVIEW → PUBLISHED`)
- MTTR and SLA compliance reporting
- AI-assisted severity classification on ingestion (enrichment only, never the routing decision)
- Structured observability: correlation IDs, Prometheus metrics, OpenTelemetry traces spanning HTTP-to-worker
- Cursor-based pagination on the incident list
- Read replicas for reporting, Redis failover/clustering, horizontally scaled API instances

---

## Technology stack

The stack chosen for this build, with the reasoning for each choice (including what was rejected) tracked in `docs/adr/` as decisions are made:

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS — not started |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Queue / Jobs | Redis, BullMQ — provisioned, not yet integrated |
| Infrastructure | Docker, Docker Compose |
| Observability | Pino, Prometheus, OpenTelemetry — planned, not implemented |
| Authentication | JWT, role-based access control — planned, not implemented |
| Developer Tools | GitHub Actions, Zod, ESLint, Prettier, Jest |

---

## Documentation

| Document | Status | Purpose |
|---|---|---|
| [`README.md`](./README.md) | Current | Orientation and navigation |
| [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) | In progress, updated as decisions are made | Engineering narrative — problem, decisions, trade-offs, as they happen |
| [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) | Current | Intended directory layout and module boundary rules |
| `docs/ARCHITECTURE.md` | Not written yet | Component diagram, data flow, sequence diagrams — will be written once the API/worker split exists |
| `docs/API.md` | Not written yet | Endpoint reference — will grow with the API |
| `docs/DESIGN.md` | Not written yet | State machine and schema detail |
| `docs/SECURITY.md` | Not written yet | Auth model, trust boundaries |
| `docs/DEPLOYMENT.md` | Not written yet | Deployment and operations |
| `docs/adr/` | Not started | One record per non-default decision, added as decisions are made |
| `docs/runbooks/` | Not started | Operational playbooks, added once there's something to operate |

---

## Demo

No public deployment exists yet. No dashboard screenshots or walkthrough videos exist yet — the frontend hasn't been started. This section will be filled in with a live link and walkthrough once there's something real to show, rather than with placeholders in the meantime.

---

## Local development

What actually works today: cloning the repo and bringing up the Docker Compose environment (Postgres and Redis containers). The application code itself doesn't yet do anything beyond scaffolding, so `npm run dev` will start an Express server with no real routes behind it yet.

### Prerequisites

- Node.js 20.x
- Docker and Docker Compose
- npm

### 1. Clone

```bash
git clone https://github.com/DevWithAbhishek/IMS.git
cd IMS
```

### 2. Environment variables

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

### 3. Start infrastructure (Postgres, Redis)

```bash
docker compose up -d postgres redis
```

### 4. Install dependencies

```bash
# from backend/
npm install

# from frontend/ (scaffolding only — no pages implemented yet)
npm install
```

### 5. Run the backend

```bash
# from backend/
npm run dev
```

There is no seed script, migration set, or worker process to run yet — those will be added as the corresponding features land.

---

## Intended repository structure

This reflects the intended layout the project is being built toward, documented in full in [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) — not all of it exists yet.

```
ims/
├── backend/          # Express API (currently a modular monolith; worker split planned)
├── frontend/         # Next.js dashboard — not started
├── docs/
│   ├── adr/          # Architecture Decision Records — not started
│   ├── debugging/    # Debugging journal — started as issues are hit
│   ├── diagrams/     # Architecture diagrams — placeholders
│   ├── specs/        # Feature specs written before implementation
│   ├── CASE_STUDY.md
│   └── PROJECT_STRUCTURE.md
├── .github/
│   └── workflows/    # CI pipelines
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

---

## Roadmap

### Phase 1 — Foundation *(in progress)*
- [x] Repository structure, Docker Compose environment, env configuration
- [ ] Incident CRUD
- [ ] Core database schema
- [ ] Basic authentication

### Phase 2 — Incident lifecycle
- [ ] Five-state incident state machine with concurrency-safe transitions
- [ ] Alert ingestion (webhooks, idempotent handling)
- [ ] Escalation chain
- [ ] Notification pipeline (email, Slack)

### Phase 3 — Reliability
- [ ] Transactional outbox pattern
- [ ] API/worker process split
- [ ] BullMQ workers with idempotency keys
- [ ] Crash-recovery for in-flight escalation

### Phase 4 — Observability
- [ ] Structured logging with correlation IDs
- [ ] Prometheus metrics
- [ ] OpenTelemetry tracing across HTTP-to-worker boundary

### Phase 5 — Production readiness
- [ ] Test coverage (unit, integration, load)
- [ ] Deployment pipeline
- [ ] Performance validation
- [ ] Full documentation set (`ARCHITECTURE.md`, `API.md`, `DESIGN.md`, `SECURITY.md`, `DEPLOYMENT.md`, runbooks)

Scope reasoning — what's deliberately deferred and why — is being recorded in [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) as each phase is planned in detail.

---

## Upcoming engineering work

Guarantees this project is being built to demonstrate, once implemented — not claims about the current code:

- Idempotent ingestion under concurrent delivery
- A state machine with database-enforced invariants, not just application-level checks
- Escalation that survives worker crashes mid-chain
- At-least-once-safe async workers via idempotency keys and state re-validation
- An audit log that cannot be edited after the fact, enforced at the database permission layer
- Documented 403-vs-404 semantics on ownership checks
- A restricted database role as an independent trust boundary, not just application logic

---

## Contributing

This is a personal portfolio project and is not currently accepting external contributions. Issues and discussion are welcome.

## License

MIT — see [`LICENSE`](./LICENSE).

## Author

**Abhishek Kumar** — Backend Engineer

- Portfolio: [codewithabhishek.in](https://codewithabhishek.in)
- GitHub: [@DevWithAbhishek](https://github.com/DevWithAbhishek)