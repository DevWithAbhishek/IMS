 
# ADR-004: PostgreSQL vs MongoDB for Incident Management System

## Status

Accepted

---

# Decision

The Incident Management System (IMS) will use **PostgreSQL** as its primary database.

MongoDB was evaluated but rejected because the system requires strong transactional guarantees, relational data modeling, auditability, reporting capabilities, and consistency across incident lifecycle operations.

---

# Context

The Incident Management System manages the complete lifecycle of operational incidents.

Core entities include:

* Users
* Teams
* Roles
* Incidents
* Incident Timelines
* Audit Logs
* Escalation Policies
* Notifications
* Assignments

When an incident is created, multiple related operations occur:

```text
Create Incident
↓
Create Timeline Entry
↓
Create Audit Record
↓
Queue Notifications
↓
Trigger Escalation Workflow
```

These operations must remain consistent and traceable.

The system also requires:

* Incident deduplication
* Similar incident detection
* Audit history
* SLA tracking
* MTTR reporting
* Escalation reporting
* Team performance analytics
* Structured querying
* Filtering and aggregation
* Historical incident analysis

Because incidents represent operational events, data correctness is more important than maximum horizontal scalability.

---

# Alternatives Considered

## Option 1: PostgreSQL

### Benefits

#### Strong ACID Transactions

Multiple operations can be committed atomically.

```text
Incident
+
Timeline
+
Audit Log
+
Notification Event
```

Either all succeed or all fail.

---

#### Relational Modeling

IMS contains naturally related entities.

```text
User
 └── Incident
       └── Timeline
       └── Assignment
       └── Audit Log
```

Foreign keys and constraints enforce integrity.

---

#### Row Locking Support

Supports:

```sql
SELECT ... FOR UPDATE
```

Useful for:

* Incident acknowledgement
* Escalation ownership
* Concurrent updates
* State transitions

Prevents race conditions.

---

#### Advanced Querying

Supports:

* Complex joins
* Aggregations
* Reporting
* Window functions
* Materialized views

Useful for:

* MTTR calculations
* SLA reports
* Incident analytics
* Escalation metrics

---

#### Mature Indexing

Supports:

* B-Tree
* GIN
* GiST
* Partial Indexes
* Composite Indexes

Useful for:

* Incident searches
* Timeline filtering
* Audit lookups
* Similar incident detection

---

#### Partitioning

Native partitioning helps manage:

* Large audit tables
* Incident history
* Timeline events

without changing application logic.

---

#### Operational Simplicity

Single database.

Lower complexity.

Lower infrastructure cost.

Easier backup, recovery, maintenance and debugging.

---

## Option 2: MongoDB

### Benefits

* Flexible schema
* Faster iteration for rapidly changing documents
* Easier document-based modeling
* Horizontal scaling support

### Drawbacks

#### Weaker Relational Modeling

IMS data is highly relational.

Document duplication would increase complexity.

---

#### Transaction Complexity

Although MongoDB supports transactions, PostgreSQL provides a more mature and battle-tested transactional model for relational workflows.

---

#### Reporting Complexity

Complex reporting and analytics often become harder as relationships grow.

---

#### Data Integrity Risk

Foreign key enforcement and relational constraints are not as natural as PostgreSQL.

---

# Trade-offs Accepted

By choosing PostgreSQL we accept:

* More upfront schema design
* Schema migrations when models evolve
* Slightly slower development for rapidly changing document structures

In exchange we gain:

* Strong consistency
* Transactional safety
* Auditability
* Relational integrity
* Better reporting capabilities
* Easier incident lifecycle management
* Simpler operational model
* Lower infrastructure complexity

---

# Consequences

### Positive

* Reliable incident lifecycle tracking
* Strong audit trail guarantees
* Consistent escalation workflows
* Easier reporting and analytics
* Better concurrency control
* Lower operational complexity
* Strong foundation for future growth

### Negative

* Less flexible schema evolution than MongoDB
* Requires migration management
* Some horizontal scaling strategies are more complex than document databases

---

# Rationale

The Incident Management System is a workflow-oriented operational platform rather than a document-centric application.

The primary requirements are:

* Consistency
* Auditability
* Transactions
* Reporting
* Concurrency control

These requirements align strongly with PostgreSQL's strengths.

Therefore PostgreSQL provides the best balance of reliability, maintainability, operational simplicity, and future scalability for the Incident Management System.
