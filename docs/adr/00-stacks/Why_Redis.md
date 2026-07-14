### Why Redis?

The Incident Management System uses **Redis** as a high-performance in-memory data store to reduce database load, improve response times, and support distributed application features.

Redis stores frequently accessed and short-lived data in memory, allowing sub-millisecond read and write operations that are significantly faster than querying the primary database for every request.

Within IMS, Redis is used for:

- Caching frequently accessed application data.
- Managing authenticated user sessions.
- Supporting distributed rate limiting.
- Serving as the backend for BullMQ job queues.
- Storing temporary application state where low latency is important.

Redis is **not** the system of record. PostgreSQL remains the single source of truth for all persistent business data such as incidents, alerts, users, acknowledgements, and audit logs. Cached data can always be regenerated from PostgreSQL if necessary.

Using Redis allows the application to reduce unnecessary database queries, lower API response times, and scale multiple API and worker instances while sharing common state through a centralized in-memory store.

The project therefore prioritizes:

- Low-latency data access.
- Reduced PostgreSQL load.
- Efficient session management.
- Distributed rate limiting.
- Reliable background job processing through BullMQ.
- Future support for distributed caching and locking.

#### Trade-offs Accepted

- Additional infrastructure to deploy and monitor.
- Data stored in Redis is temporary and should not be treated as authoritative.
- Cache invalidation introduces additional application complexity.
- Memory is more expensive than disk-based storage.

---
#
[**Read More about Redis**](https://backendless.com/redis-what-it-is-what-it-does-and-why-you-should-care/)

---