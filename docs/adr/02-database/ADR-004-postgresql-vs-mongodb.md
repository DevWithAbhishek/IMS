 
# ADR-004: PostgreSQL vs MongoDB for Incident Management System

## Status

Accepted

## Date

2026-06-21

---

# Context

The Incident Management System (IMS) stores and manages incidents throughout their lifecycle.

An incident creation workflow involves multiple related operations:

- Creating the incident record
- Creating audit trail entries
- Creating timeline/history events
- Publishing notification events
- Recording assignment and ownership information

These operations must remain consistent and should succeed or fail as a single unit.

The system also requires:

- Complete auditability of all changes
- Structured incident metadata
  - severity
  - status
  - service
  - environment
  - root cause
- Correlation and deduplication of incidents
- Efficient querying of recent incidents
- SLA and operational reporting
- Future support for partitioning and scaling
- Strong data integrity guarantees

The expected data model is highly structured and relationships between entities are important.

Examples include:

- Incident → Reporter
- Incident → Assignee
- Incident → Timeline Events
- Incident → Audit Logs
- Incident → Services
- Incident → Escalations

Because incidents represent operational records, correctness and traceability are prioritized over schema flexibility.

---

# Decision

We will use PostgreSQL as the primary database for the Incident Management System.

PostgreSQL was selected because it provides:

- ACID transactions
- Strong consistency guarantees
- Relational modeling
- Foreign key constraints
- Mature indexing capabilities
- Native partitioning support
- Advanced reporting and aggregation capabilities

The database will act as the system of record for:

- Incidents
- Users
- Assignments
- Audit Logs
- Timeline Events
- Escalations
- Notification Outbox Events

All incident creation workflows will be executed inside database transactions to ensure consistency.

---

# Alternatives Considered

## Option 1: MongoDB

### Advantages

- Flexible schema
- Faster iteration when document structures change frequently
- Natural storage of nested JSON documents
- Easier horizontal sharding model

### Disadvantages

- Incident data is highly structured rather than document-oriented
- Relationships between entities become application-managed
- Complex reporting often requires aggregation pipelines
- Maintaining audit consistency across multiple collections is harder
- Transaction support exists but introduces additional complexity
- Referential integrity is not enforced by the database

### Why Rejected

The primary requirements of IMS are:

- Consistency
- Auditability
- Relational integrity
- Reporting

These align more closely with PostgreSQL than MongoDB.

---

## Option 2: PostgreSQL

### Advantages

- Strong transactional guarantees
- Referential integrity
- Rich indexing support
- Efficient joins
- Mature analytics capabilities
- Time-based partitioning support
- Reliable audit and compliance workflows

### Disadvantages

- Less schema flexibility
- Requires migrations when data structures evolve
- Horizontal scaling is more complex than document databases

### Why Accepted

The operational requirements of IMS favor correctness and traceability over schema flexibility.

PostgreSQL provides stronger guarantees for incident lifecycle management and auditability.

---

# Tradeoffs Accepted

We accept the following tradeoffs:

1. Schema changes require migrations.

   We prefer explicit schema evolution over unrestricted document structures.

2. Development velocity may be slightly slower.

   Additional modeling effort is acceptable in exchange for stronger data integrity.

3. Horizontal scaling requires additional planning.

   We accept this because expected IMS workloads are primarily transactional and can be scaled using:

   - Index optimization
   - Read replicas
   - Partitioning
   - Connection pooling

4. More rigid relational design.

   We accept this because incident management data is inherently relational.

---

# Consequences

### Positive

- Strong consistency guarantees
- Reliable audit trails
- Easier incident correlation queries
- Better reporting capabilities
- Easier enforcement of business rules
- Reduced risk of data integrity issues

### Negative

- More migration management
- Less flexibility for arbitrary data structures
- Greater emphasis on schema design

---

# Summary

PostgreSQL is selected as the system of record for IMS because incident management is a transactional, audit-heavy, highly relational domain where consistency and traceability are more important than schema flexibility.