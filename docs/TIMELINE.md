# Project Timeline: What learnt and built everyday

## Status

Stack Setup

---
## Day 1 (11th Jul'2026)

- Enforce boundaries b/w modules using ESLint's boundaries plugin / CI's dependency-boundary lint rule on first day → to avoid violations by mistake in future.
- Clean module boundaries mean extraction later is "extract and add a network call," not a redesign.
- Side-effecting work (email, analytics, low-stakes audit) → events. 
- Critical-path work (stock check, charge before confirming) → direct public-API calls.
- **PostgreSQL** gives strong transactional consistency across module-owned tables when we genuinely need it.  
Also, a uniquely rich feature set — partial indexes, materialized views, row-level locking & native JSON.
- Redis for caching, rate-limiting and ephemeral counters, queue backing storage.
- Use **foreign keys** within a module, but across module boundaries store only the referenced ID (e.g., user_id) and access the owning module through its public API/service instead of a cross-module foreign key.   
This adds a small amount of code and an extra service abstraction, but it keeps modules loosely coupled, independently evolvable, and much easier to extract into microservices later.  
We sacrifice some database-enforced referential integrity across modules in exchange for cleaner architecture, clearer ownership, and better long-term maintainability.
- **PgBouncer** allows thousands of application requests to share a much smaller number of actual database connections.
- **Connection pooling** is the practice of maintaining a reusable set of database connections so requests can borrow and return them instead of creating a new connection for every database operation.
- The problem **caching** solves is redundant, expensive recomputation of something that hasn't changed. The problem caching introduces is staleness — every caching strategy is really a different answer to "how wrong is the cache allowed to be, and for how long."  
- **Cache-aside** *(lazy loading)*: The application checks the cache first; on a miss, it reads from the database, then writes the result into the cache before returning it. If the cache is wiped entirely, the system degrades to "every request hits the database" rather than failing outright.
- Standard security headers (Content-Security-Policy, X-Content-Type-Options: nosniff, Strict-Transport-Security) should be set globally via middleware.
- If the user needs the result of an operation to know whether their request succeeded, it's synchronous. If the operation is a side effect of a successful request, it's a background job. 
- **Transactional Outbox**  
Solves a subtle but critical correctness problem: if a module commits a write and then publishes an event in a separate step, a crash between those steps means the write happened but the event never fired.  
The **outbox pattern** writes the event payload into an outbox table in the same database transaction as the business write, then a separate poller publishes unpublished rows, marking them published only after success.
- *Delayed jobs* run once at a future time. 
- *Scheduled jobs* run on a recurring cron-style interval.
- An *event contract* is the typed shape of an event's payload, treated with the same discipline as a public API.
- *Traces* follow a single request across every module — show exactly where time was spent.
- A **multi-stage Dockerfile** separates the build environment from the runtime image, producing a smaller, more secure final image with no build tools or source maps shipped to production.
- In Migration: Update the database first, but make sure both the old code and the new code can work with it. Only remove old database structures after the new code has been running successfully.

---
## Day 2 (12th Jul'2026)

- A fully event-driven architecture is unsuitable for critical transactional operations where the caller expects an immediate confirmation that the requested action has successfully completed.
- **Request-driven communication** is ideal for operations where the client requires an immediate and deterministic response. 
- A fully **event-driven architecture** is unsuitable for critical transactional operations where the caller expects an immediate confirmation that the requested action has successfully completed.
- Designing the **API contract first** enables frontend and backend teams to work independently, promotes consistent versioning, simplifies future integrations, and allows the database schema to evolve without unnecessarily affecting clients.
- **DB-first approach** works well for data-centric applications but often results in APIs that closely mirror the database schema. As business requirements evolve, changing APIs without impacting the underlying data model becomes increasingly difficult, leading to more complex migrations and tighter coupling between storage and application logic.

---
## Day 3 (13th July 2026)
- **Express** is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.
- **Routing** refers to determining how an application responds to a client request to a particular endpoint, which is a URI (or path) and a specific HTTP request method (GET, POST, and so on).
- The presence of a *tsconfig.json* file in a directory indicates that the directory is the root of a TS project. The tsconfig.json file specifies the root files and the compiler options required to compile the project.
- TS is a structural type system layered on top of JS, and it has to answer 3 questions before it can produce useful output: which files belong to the program, what JS/runtime environment the code is allowed to assume, and how strictly to check types.  
**tsconfig.json** is the single declarative answer to all three. It marks a directory as the root of a TS project, tells tsc (and every editor, linter, and bundler that embeds the TS language service) which files form the compilation unit, and configures both the type checker and the emitter.
- **tsconfig.build.json** is a convention the community and tooling ecosystems (NestJS scaffolds it by default, for example) settled on for a second, production‑only TS configuration that extends the base config and overrides the handful of options that should differ between "checking code while I write it" and "emitting the JS that ships."
- *tsconfig.json answers* "is this code type‑correct, and does my editor understand it?"  
*tsconfig.build.json* answers "what exact JavaScript files does npm run build emit into dist/?" They are different questions, asked by different tools, at different times.
- Project references (*tsconfig*) are a way to structure the TS programs into smaller pieces. Using Project References can greatly improve build and editor interaction times, enforce logical separation between components, and organize the code in new and improved ways.

---
## Day 4 (14th July 2026)
- A *dependency* is anything the project uses. Something my project depends on. Every library or framework is a dependency if we install it using npm.
- A *library* is reusable code we call. We decide when to use. eg: Zod, Prisma Client, Argon2, jwt, pino.
- A *framework* is reusable code that calls our code. eg: Express, NextJs.
- *npm init* → Register the company and create its official registration document (package.json).
- *package.json* is the central file that tells npm everything it needs to know about the project. 
- *app.ts* builds the Express application: Creates Express app, Register middleware, Register routes, Register error handler, Register security middleware, Export app.
- *server.ts* starts the application: Load environment variables, Connect PostgreSQL, Connect Redis, Initialize BullMQ, Initialize Observability, Start HTTP server, Graceful shutdown.
- **["dev": "tsx watch src/server.ts"]** : Starts the backend development server and automatically restarts it whenever we save a file.
- **["start": "node dist/server.ts"]**: Runs the compiled backend server for production. 
- **["build": "tsc -p tsconfig.build.json"]**: Compiles all TypeScript code into production-ready JavaScript inside the dist/ folder.
- **["dev:worker": "tsx watch src/worker.ts"]**: Starts the background worker (BullMQ jobs) and automatically restarts it whenever you save a file.
- **["start:worker": "node dist/worker.js"]**: Runs the compiled background worker for production.
- **["typecheck": "tsc --noEmit"]**: Checks the entire project for TypeScript errors without generating any JavaScript files.
- **["lint": "eslint src --ext .ts"]**: Checks the TypeScript files for code quality issues, bad practices, and style rule violations.
- **["format": "prettier --write src"]**: Automatically formats all files in the src folder to follow a consistent coding style.
- **PostgreSQL**, also known as Postgres, is an open-source relational database with a strong reputation for its reliability, flexibility and support of open technical standards. PostgreSQL supports both non-relational and relational data types
- **MySQL** — a fast, reliable, scalable and easy-to-use open-source relational database system — is designed to handle mission-critical, heavy-load production applications. It is a common and easy-to-start database with low memory, disk and CPU utilization, managed by a RDBMS.
- **Prisma** creates a second, temporary database during development. It’s a sandbox where Prisma tests the migrations before they ever touch the real data. It detects Schema drift , Syntax errors & Potential data loss.
- A *migration* is just a version control for the database. As the app grows, the DB evolves.
- An **ORM (Object-Relational Mapper)** is a tool that allows developers to interact with a database using objects in their programming language instead of writing raw SQL queries.
- **Redis** is an “in-memory, non-relational data store.”
- **Redis (REmote DIctionary Server)** is an open source, in-memory, NoSQL key/value store that is used primarily as an application cache or quick-response database.
- **Docker** is an open-source platform that automates the deployment of applications inside lightweight, portable containers.
- The **Docker Engine** is the core runtime responsible for building, running, and managing containers. It operates as a client server application, consisting of the Docker daemon, REST API, and CLI for user interaction.
- A **Docker image** is a blueprint containing instructions for creating a container. When executed, it becomes a container, an isolated instance of the application. Images are immutable, while containers are ephemeral and can be started, stopped, or replicated with ease.
- **Docker Hub** acts as a centralized repository for sharing and storing container images.
- **Docker Compose** simplifies multi-container application management through declarative YAML configuration files. For orchestration and clustering, **Docker Swarm** enables scaling and load balancing across distributed systems.
- A **container** is the running instance of an image.

---
## Day 5 (15th July 2026) 
###
- **BullMQ** is a Node.js library that implements a fast and robust queue system built on top of *Redis*.
- **RabbitMQ** is a full-fledged message broker that implements the AMQP protocol (Advanced Message Queuing Protocol), suitable for enterprise-level applications with high-throughput and reliability requirements.
- **Polling** is a method used in system design to check the status or gather data from multiple sources periodically. It involves continuously querying or checking devices, or other components at predetermined intervals to see if there's any new information or if certain conditions have been met.
- A **state machine** is a mathematical model of computation that can exist in exactly one of a finite number of states at any given time. The machine can transition from one state to another in response to specific inputs or events.
---