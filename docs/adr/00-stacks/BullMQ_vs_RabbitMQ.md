### Why BullMQ instead of RabbitMQ?

The Incident Management System uses **BullMQ** for background job processing because it provides the asynchronous capabilities required by the application while integrating seamlessly with the existing Redis infrastructure.

BullMQ is the implementation technology chosen to realize the event-driven portions of the architecture. It powers asynchronous workflows such as notifications, SLA escalations, and scheduled background processing, while request-driven operations continue to execute synchronously through the HTTP request lifecycle

IMS performs several operations that do not need to block the user's request, including:

- Notification delivery.
- Escalation scheduling.
- Delayed SLA checks.
- Retryable background tasks.
- Scheduled jobs.

**BullMQ** provides delayed jobs, repeatable jobs, retries, priorities, concurrency control, and rate limiting while using Redis as its coordination and storage backend. Since Redis is already part of the application's architecture for caching and session management, BullMQ can be introduced without adding another infrastructure component.

**RabbitMQ** is a mature message broker implementing the Advanced Message Queuing Protocol (AMQP). It offers advanced routing capabilities, publish/subscribe patterns, dead-letter queues, and language-agnostic messaging, making it an excellent choice for large distributed systems and heterogeneous microservice architectures.

However, IMS currently follows a modular monolith architecture where all services are implemented in TypeScript and execute within the same deployment boundary. The advanced messaging features provided by RabbitMQ would add operational complexity without providing proportional architectural benefits.

The project therefore prioritizes:

- Simple asynchronous processing.
- Reuse of existing Redis infrastructure.
- Minimal operational overhead.
- Strong TypeScript integration.
- Delayed and scheduled job execution.
- Easy local development and deployment.

The architecture intentionally keeps the queue abstraction isolated so that BullMQ can be replaced with RabbitMQ or another message broker in the future if application scale or messaging requirements evolve.

#### Trade-offs Accepted

- BullMQ is tightly coupled to Redis.
- It offers fewer messaging patterns than RabbitMQ.
- It is better suited for job queues than enterprise messaging.
- Migrating to another broker in the future would require an adapter layer.

---
###

**BullMQ** is a *Node.js* library that implements a fast and robust queue system built on top of Redis.

The library is designed so that it will fulfill the following goals:

- Exactly once queue semantics, i.e., attempts to deliver every message exactly one time, but it will deliver at least once in the worst case scenario*.
- Easy to scale horizontally. Add more workers for processing jobs in parallel.
- Consistent.
- High performant. Try to get the highest possible throughput from Redis by combining efficient .lua scripts and pipelining.

---