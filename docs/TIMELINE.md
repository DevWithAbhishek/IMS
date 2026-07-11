# Project Timeline: What learnt and built everyday

## Status

Architecture Design

---
## Day 1 (11th Jul'2026)

- Enforce boundaries b/w modules using ESLint's boundaries plugin / CI's dependency-boundary lint rule on first day → to avoid violations by mistake in future.
- Clean module boundaries mean extraction later is "extract and add a network call," not a redesign.
- Side-effecting work (email, analytics, low-stakes audit) → events. 
- Critical-path work (stock check, charge before confirming) → direct public-API calls.
- PostgreSQL gives strong transactional consistency across module-owned tables when we genuinely need it.  
Also, a uniquely rich feature set — partial indexes, materialized views, row-level locking & native JSON.
- Redis for caching, rate-limiting and ephemeral counters, queue backing storage.
- Use foreign keys within a module, but across module boundaries store only the referenced ID (e.g., user_id) and access the owning module through its public API/service instead of a cross-module foreign key.   
This adds a small amount of code and an extra service abstraction, but it keeps modules loosely coupled, independently evolvable, and much easier to extract into microservices later.  
We sacrifice some database-enforced referential integrity across modules in exchange for cleaner architecture, clearer ownership, and better long-term maintainability.
- PgBouncer allows thousands of application requests to share a much smaller number of actual database connections.
- Connection pooling is the practice of maintaining a reusable set of database connections so requests can borrow and return them instead of creating a new connection for every database operation.
- The problem caching solves is redundant, expensive recomputation of something that hasn't changed. The problem caching introduces is staleness — every caching strategy is really a different answer to "how wrong is the cache allowed to be, and for how long."  
- Cache-aside (lazy loading): The application checks the cache first; on a miss, it reads from the database, then writes the result into the cache before returning it. If the cache is wiped entirely, the system degrades to "every request hits the database" rather than failing outright.
- Standard security headers (Content-Security-Policy, X-Content-Type-Options: nosniff, Strict-Transport-Security) should be set globally via middleware.
- If the user needs the result of an operation to know whether their request succeeded, it's synchronous. If the operation is a side effect of a successful request, it's a background job. 
- Transactional Outbox  
Solves a subtle but critical correctness problem: if a module commits a write and then publishes an event in a separate step, a crash between those steps means the write happened but the event never fired.  
The outbox pattern writes the event payload into an outbox table in the same database transaction as the business write, then a separate poller publishes unpublished rows, marking them published only after success.
- Delayed jobs run once at a future time. 
- Scheduled jobs run on a recurring cron-style interval.
- An event contract is the typed shape of an event's payload, treated with the same discipline as a public API.
- Traces follow a single request across every module — show exactly where time was spent.
- A multi-stage Dockerfile separates the build environment from the runtime image, producing a smaller, more secure final image with no build tools or source maps shipped to production.
- In Migration: Update the database first, but make sure both the old code and the new code can work with it. Only remove old database structures after the new code has been running successfully.
---