 ### 2. Event-Driven vs Request-Driven Architecture

The Incident Management System adopts a **hybrid architecture**, combining both request-driven and event-driven communication. Rather than choosing one architectural style for the entire application, each business capability is implemented using the approach that best satisfies its consistency, latency, and reliability requirements.

#### Why not Fully Request-Driven?

Request-driven communication is ideal for operations where the client requires an immediate and deterministic response. However, forcing every operation to execute synchronously increases request latency and unnecessarily blocks server resources while waiting for external services such as email providers, Slack, Microsoft Teams, or SMS gateways.

Examples include:

- Notification delivery
- Escalation scheduling
- Reminder processing
- Background maintenance jobs

These operations may involve retries, network latency, temporary failures, or third-party rate limits. Executing them within the request lifecycle would degrade user experience without providing additional business value.

---

#### Why not Fully Event-Driven?

A fully event-driven architecture is unsuitable for critical transactional operations where the caller expects an immediate confirmation that the requested action has successfully completed.

Core business operations such as:

- Alert ingestion
- Incident creation
- Incident acknowledgement
- Incident resolution

must validate input, execute business rules, persist data within a database transaction, and return a definitive success or failure response before the request completes.

These operations cannot rely solely on asynchronous consumers because the user expects the resource to exist immediately after receiving a successful response.

---

#### Architecture Decision

The system therefore separates **core business transactions** from **secondary side effects**.

**Request-Driven**

- Alert ingestion
- Incident creation
- Incident acknowledgement
- Incident resolution
- Authentication
- Authorization

These operations execute synchronously and return a response only after the database transaction has successfully completed.

**Event-Driven**

- Notification dispatch
- Escalation processing
- SLA reminder jobs
- Audit logging
- Analytics
- Metrics aggregation
- Future integrations

These operations are published as events after the primary transaction commits and are processed independently by background workers using BullMQ.

---

#### Benefits

This hybrid architecture provides:

- Immediate consistency for critical business operations.
- Lower API response latency.
- Improved scalability through asynchronous processing.
- Better fault isolation between business logic and side effects.
- Reliable background execution with retries and idempotent consumers.
- Easier horizontal scaling of workers independent of the API server.

This approach aligns with modern backend systems, where synchronous request processing guarantees business correctness while asynchronous event processing improves scalability, resilience, and overall system responsiveness.