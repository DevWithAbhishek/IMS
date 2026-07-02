# IMS — Incident Management System

A backend-first incident response platform: idempotent alert ingestion, a database-enforced incident lifecycle, self-recovering escalation, and an append-only audit trail — built to be operated, not demoed.

---

<p align="center">
  <img src="docs/diagrams/architecture-overview.png" alt="IMS system architecture" width="820">
</p>

<p align="center"><sub>System architecture — API, worker, transactional outbox, Postgres, Redis. Full diagram in <a href="docs/ARCHITECTURE.md">docs/ARCHITECTURE.md</a>.</sub></p>

---

<p align="center">
  <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/DevWithAbhishek/IMS/backend-ci.yml?branch=main&label=CI">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white">
  <img alt="BullMQ" src="https://img.shields.io/badge/BullMQ-queues-red">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

---

## Overview

IMS is the layer that sits between "a monitoring tool fired an alert" and "the right human acknowledged it, owns it, and resolved it inside an agreed time window." Datadog, Grafana, and similar tools are excellent at detection. None of them own the human response: who is on call, whether anyone has seen the page, how long it has gone unacknowledged, or whether the response met its SLA. Below a certain company size, that gap is filled by a Slack channel and tribal knowledge — which works until the night it doesn't.

This repository implements that response layer with the smallest stack that can express the problem correctly: PostgreSQL and BullMQ rather than Kafka and Kubernetes. The engineering emphasis is on the properties that separate a working prototype from a production system — idempotent ingestion under concurrent delivery, a state machine with database-enforced invariants, escalation that survives worker crashes, at-least-once-safe async workers, and an audit log that cannot be edited after the fact.

It is a portfolio project, not an open-source library, and it is not a frontend showcase. Every non-default technical decision is documented with the alternative that was considered and the reason it was rejected — see [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) for the full reasoning, and [`docs/adr/`](./docs/adr/) for the per-decision record.

## Why IMS?

**The gap it fills.** PagerDuty and OpsGenie solve this problem well but at a real cost — PagerDuty alone runs $12k–$20k/year for a 40-engineer team, and both carry a nontrivial configuration burden between "we bought it" and "it's configured correctly." Jira Service Desk is built for planned work, not a P0 at 2 AM. Grafana and Datadog alerting stop at detection. IMS exists to demonstrate what the layer between detection and resolution looks like when it's built deliberately rather than improvised in a Slack channel.

**Why I built it.** Code generation has made writing code cheap. It has not made judgment about failure modes cheap — knowing that a webhook will be retried, that a worker will crash mid-job, that two requests will race on the same row, and designing for those conditions before they're ever observed in production. IMS was built to demonstrate that judgment directly: every hard guarantee in this system — idempotent ingestion, safe concurrent transitions, crash-proof escalation, tamper-resistant logging — was designed before the corresponding failure occurred, not patched in after a bug report. The full narrative, including what broke during development and what I'd do differently, is in [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md).

**Why a CTO or engineering manager should care.** This repo is structured to answer the question a technical interview is actually trying to answer: not "can this person write code," but "can this person reason about a distributed system under failure, and defend every non-obvious decision without notes." That is the explicit design constraint behind the project — see [Project Vision in `docs/CASE_STUDY.md`](./docs/CASE_STUDY.md#3-project-vision).

## Key Features

**Incident Lifecycle**
- Five-state finite state machine (`OPEN → ACKNOWLEDGED → MITIGATING → RESOLVED`) with terminal-state protection
- Concurrency-safe transitions — no application-level locking required
- Full incident timeline reconstructed from an append-only event log

**Alert Ingestion**
- Webhook-based ingestion from external monitoring tools
- Two-layer deduplication so retried or flapping alerts never create duplicate incidents
- HMAC-verified inbound requests

**Escalation**
- Self-scheduling, multi-level escalation chain
- Automatic on-call resolution against the current schedule
- Escalation state that survives a worker crash mid-chain

**Notifications**
- Multi-channel delivery (email, Slack) with fallback routing
- Exponential backoff on retryable failures
- Dead-letter handling with a visible audit trail entry on exhaustion

**Security**
- JWT authentication with role-based access control
- Documented 403-vs-404 semantics on ownership checks
- Restricted database role enforced as an independent trust boundary, not just application logic

**Reliability**
- Transactional outbox pattern — a committed state change can never fail to produce its downstream job
- At-least-once-safe workers via idempotency keys and state re-validation
- Append-only audit log enforced at the PostgreSQL permission layer

**Observability**
- Structured logs with correlation IDs propagated from HTTP request into async job execution
- Prometheus metrics with meaningful labels
- OpenTelemetry traces spanning the HTTP-to-worker boundary

**Developer Experience**
- Single-command local environment via Docker Compose
- Centralized, Zod-validated environment configuration
- Feature-module backend with enforced module boundaries (`index.ts` as the only public surface)

Implementation detail for every item above lives in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md), [`docs/DESIGN.md`](./docs/DESIGN.md), and [`docs/SECURITY.md`](./docs/SECURITY.md).

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Queue / Jobs | Redis, BullMQ |
| Infrastructure | Docker, Docker Compose |
| Observability | Pino (structured logs), Prometheus, OpenTelemetry |
| Authentication | JWT, role-based access control |
| Developer Tools | GitHub Actions, Zod, ESLint, Prettier, Jest |

Full rationale for each choice — including what was rejected and why — is in [`docs/adr/`](./docs/adr/) and [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md).

## System Overview

<p align="center">
  <img src="docs/diagrams/architecture-detailed.png" alt="IMS detailed architecture diagram" width="780">
</p>

The system runs as two independent processes sharing one codebase: an Express API and a BullMQ worker, both reading and writing PostgreSQL as the single source of truth, with Redis serving strictly as a job store, deduplication cache, and rate limiter — never as a source of truth. A transactional outbox bridges the two: any state change that must produce an async job writes that job description into Postgres in the same transaction, and an independent poller is responsible for getting it into BullMQ. This means a worker crash between "the state changed" and "the job was enqueued" is not a failure mode this system has — the job is durable in the database the moment the commit succeeds.

Full component breakdown, sequence diagrams for the ingestion and escalation flows, and the reasoning behind every boundary: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Documentation

This README is the entry point. Everything below it is the actual engineering record.

| Document | Purpose | Read this if you are |
|---|---|---|
| [`README.md`](./README.md) | Orientation and navigation | Anyone arriving at the repo |
| [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) | Full engineering retrospective — problem, decisions, trade-offs, mistakes, interview Q&A | A CTO or senior engineer doing due diligence; the single most important document if you're reading one before an interview |
| [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) | Directory-by-directory breakdown with a CTO-style review of what's strong, weak, and missing | Anyone evaluating code organization and module boundaries |
| `docs/ARCHITECTURE.md` | Component diagram, data flow, sequence diagrams | Engineers evaluating system design |
| `docs/API.md` | Endpoint reference | Engineers integrating with or extending the API |
| `docs/DESIGN.md` | State machine, schema, and domain model detail | Engineers reviewing correctness under concurrency |
| `docs/SECURITY.md` | Auth model, trust boundaries, RBAC semantics | Security-conscious reviewers |
| `docs/DEPLOYMENT.md` | How the system is deployed and operated | Engineers assessing production-readiness |
| `docs/adr/` | One record per non-default technical decision | Anyone asking "why this and not X" |
| `docs/runbooks/` | Operational playbooks for known failure modes | On-call engineers, or reviewers checking for operational maturity |
| `tests/` | Unit, integration, and load tests | Engineers checking whether the reliability claims are backed by tests |

## Demo

- **Live demo:** _link pending deployment — see [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)_
- **Dashboard walkthrough:** _video/GIF placeholder_
- **Incident lifecycle demo:** _video/GIF placeholder — webhook in, escalation, acknowledgement, resolution_
- **Architecture walkthrough:** _video/GIF placeholder_

## Screenshots

| Dashboard | Incident Detail |
|---|---|
| _placeholder_ | _placeholder_ |

| Timeline | Escalation |
|---|---|
| _placeholder_ | _placeholder_ |

| Reports | Health Endpoint |
|---|---|
| _placeholder_ | _placeholder_ |

## Project Highlights

Production-oriented decisions this project was built around. One line each — full reasoning in the linked docs.

- **Two-layer alert deduplication** (Redis fast-path + Postgres partial unique index) so a retrying webhook never creates a duplicate incident. → [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md#8-production-challenges-solved)
- **Optimistic concurrency via conditional UPDATE** for incident acknowledgement — no application-level locks. → [`docs/DESIGN.md`](./docs/DESIGN.md)
- **Transactional outbox pattern** guarantees a committed state change can never silently fail to produce its downstream job. → [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Append-only audit log enforced at the database role layer**, not just by application convention. → [`docs/SECURITY.md`](./docs/SECURITY.md)
- **Two Dockerfiles, one image, separate entrypoints** — a crashed worker cannot take the API down. → [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md)
- **Every "do not build this" decision is documented**, not silently skipped — Kafka, Kubernetes, multi-tenancy, and a WebSocket dashboard were all evaluated and explicitly deferred. → [`docs/adr/`](./docs/adr/)

## Local Development

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

Fill in the required values — see `.env.example` for descriptions of each variable.

### 3. Start infrastructure (Postgres, Redis)

```bash
docker compose up -d postgres redis
```

### 4. Install dependencies

```bash
# from backend/
npm install

# from frontend/
npm install
```

### 5. Run database migrations

```bash
# from backend/
npm run db:migrate:dev
```

### 6. Seed the database (optional)

```bash
# from backend/
npm run db:seed
```

### 7. Run the stack

```bash
# API — from backend/
npm run dev

# Worker — from backend/, in a separate terminal
npm run dev:worker

# Frontend — from frontend/
npm run dev
```

Or run everything in one step:

```bash
docker compose up
```

Full environment reference, troubleshooting, and production deployment: [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).

## Repository Structure

```
ims/
├── backend/          # Express API + BullMQ worker (feature-module architecture)
├── frontend/         # Next.js dashboard
├── docs/
│   ├── adr/          # One Architecture Decision Record per non-default choice
│   ├── debugging/    # Debugging journal — failures hit and how they were root-caused
│   ├── diagrams/     # Architecture and sequence diagrams
│   ├── specs/        # Feature specs written before implementation
│   ├── CASE_STUDY.md
│   └── PROJECT_STRUCTURE.md
├── .github/
│   └── workflows/    # Independent CI pipelines for backend and frontend
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

Backend and frontend deploy independently by design — a frontend-only change never rebuilds the API image or restarts the worker. Full directory-by-directory breakdown, including module boundary rules and a CTO-style review of what's strong and what's missing: [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md).

## Roadmap

### Current (v1)

- [x] Idempotent webhook alert ingestion
- [x] Five-state incident FSM with concurrency-safe transitions
- [x] Self-scheduling escalation chain with crash recovery
- [x] Async notification pipeline (email, Slack) with retry and dead-letter handling
- [x] Append-only, database-enforced audit log
- [x] SLA tracking with pre-breach warnings

### Upcoming

- [ ] Postmortem workflow (`DRAFT → IN_REVIEW → PUBLISHED`)
- [ ] MTTR and SLA compliance reporting
- [ ] AI-assisted severity classification on ingestion (enrichment only, never the routing decision)
- [ ] Cursor-based pagination on the incident list

### Future

- [ ] Read replicas for reporting queries
- [ ] Redis failover / clustering
- [ ] Horizontally scaled API instances with queue-depth-based worker autoscaling

Full scope reasoning — including what was deliberately left out of v1 and why — is in [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md#4-functional-scope) and [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md#14-scaling-roadmap).

## Engineering Documentation

| Document | Description |
|---|---|
| [`docs/CASE_STUDY.md`](./docs/CASE_STUDY.md) | Complete engineering retrospective: problem statement, architecture evolution, every major decision with alternatives and trade-offs, production challenges solved, mistakes made, and a 30-question interview-readiness section |
| [`docs/PROJECT_STRUCTURE.md`](./docs/PROJECT_STRUCTURE.md) | Full directory tree with reasoning for every folder boundary, plus an explicit review of what's professional, what's overengineered, and what's missing |
| `docs/ARCHITECTURE.md` | System architecture, component responsibilities, sequence diagrams |
| `docs/API.md` | API endpoint reference |
| `docs/DESIGN.md` | State machine and schema design |
| `docs/SECURITY.md` | Auth, RBAC, and trust boundary documentation |
| `docs/DEPLOYMENT.md` | Deployment and operations guide |
| `docs/adr/` | Architecture Decision Records, one per non-default choice |
| `docs/runbooks/` | Runbooks for known failure modes |

## Contributing

This is a personal portfolio project and is not currently accepting external contributions. Issues and discussion are welcome.

## License

MIT — see [`LICENSE`](./LICENSE).

## Author

**Abhishek Kumar** — Backend Engineer

- Portfolio: [codewithabhishek.in](https://codewithabhishek.in)
- GitHub: [@DevWithAbhishek](https://github.com/DevWithAbhishek)
- LinkedIn: _add link_