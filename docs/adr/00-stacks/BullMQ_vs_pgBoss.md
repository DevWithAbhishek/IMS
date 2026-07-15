### Why BullMQ instead of pg-boss?

The Incident Management System uses **BullMQ** for asynchronous job processing because it aligns better with the existing architecture and operational requirements of the application.

BullMQ is a Redis-backed job queue designed specifically for background task processing. Since Redis is already introduced into the architecture for caching, session management, and rate limiting, BullMQ can reuse the existing infrastructure without introducing additional operational dependencies.

IMS requires asynchronous processing for tasks such as:

- Notification delivery.
- SLA escalation scheduling.
- Delayed jobs.
- Retryable background processing.

BullMQ provides these capabilities while remaining lightweight and well integrated with the Node.js and TypeScript ecosystem.

pg-boss is an excellent PostgreSQL-backed job queue that allows business data changes and job creation to participate in the same database transaction. This guarantees that database updates and job scheduling either both succeed or both fail, making it particularly valuable for systems requiring transactional job enqueueing.

However, storing queue data inside the primary PostgreSQL database also increases database workload and couples business data with background processing. Since IMS already depends on Redis, introducing BullMQ allows queue operations to remain isolated from the primary database while reducing unnecessary PostgreSQL load.

The project therefore prioritizes:

- Reuse of existing Redis infrastructure.
- Dedicated queue processing.
- Delayed and scheduled jobs.
- Retry support.
- Operational simplicity.
- Strong TypeScript integration.

The queue implementation remains isolated behind the application layer, allowing BullMQ to be replaced by pg-boss in the future if transactional job scheduling becomes a stronger business requirement.

#### Trade-offs Accepted

- Jobs are not created within the same PostgreSQL transaction as business data.
- Redis becomes an additional runtime dependency.
- Cross-resource consistency requires patterns such as the Transactional Outbox when atomicity is required.