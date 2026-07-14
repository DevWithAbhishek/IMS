### Why Prisma ORM?

The Incident Management System uses **Prisma** as its Object-Relational Mapping (ORM) layer to improve developer productivity while maintaining strong type safety and flexibility.

Prisma acts as an abstraction layer between the application and PostgreSQL. Instead of manually writing SQL for every common database operation, developers interact with strongly typed TypeScript objects, while Prisma generates the corresponding SQL queries.

A key advantage is its **schema-first approach**, where database models are defined once in the Prisma schema. From this schema, Prisma generates a fully typed client, enabling IDE autocomplete, compile-time type checking, and reducing many common runtime errors when interacting with the database.

Prisma also provides an integrated migration system, allowing database schema changes to be version-controlled, reproducible, and consistent across development and production environments.

Although ORMs introduce an abstraction layer and may not expose every database optimization directly, Prisma allows the application to execute raw SQL whenever advanced queries or performance optimizations become necessary. This provides a balance between developer productivity and low-level database control.

For IMS, Prisma aligns well with the project's goals of rapid development, maintainability, and long-term scalability while preserving the ability to leverage PostgreSQL's advanced capabilities when required.

The project therefore prioritizes:

- Strong TypeScript integration.
- End-to-end type safety.
- Schema-first database design.
- Version-controlled migrations.
- Faster development with reduced boilerplate.
- Raw SQL support for performance-critical queries.

#### Trade-offs Accepted

- Less control over generated SQL for common operations.
- Learning Prisma's schema and migration workflow.
- Complex analytical queries may still require raw SQL.
- Performance tuning occasionally requires understanding the generated SQL.

---

Prisma ORM is an open-source next-generation ORM. It consists of the following parts:

- Prisma Client: Auto-generated and type-safe query builder for Node.js & TypeScript.
- Prisma Migrate: Migration system.
- Prisma Studio: GUI to view and edit data in your database. Runs locally, not open-source.

**The Essential Toolkit** 
1. Initial setup 
- npx prisma init 

2. Save changes 
- npx prisma migrate dev 

3. Sync existing DB 
- npx prisma db pull 

4. Visual UI to see data 
- npx prisma studio

**When things go wrong** 
If a migration fails midway, don't panic. Use migrate resolve. 

1. Applied successfully?
- npx prisma migrate resolve --applied <migration_name> 

2. Rolled it back? 
- npx prisma migrate resolve --rolled-back <migration_name> 

---

**Notes:**
1. Local Development
- npx prisma migrate dev -->>>> Creates the history

2. Production/Live
- npx prisma migrate deploy -->>>> Applies the history

3. Rapid Prototyping
- npx prisma db push -->>>> Skips the history

--- 

Prisma ORM enables to: ([Prisma Setup](https://www.prisma.io/docs/orm/v6/overview/introduction/what-is-prisma))

- Thinking in objects instead of mapping relational data
- Queries not classes to avoid complex model objects
- Single source of truth for database and application models
- Healthy constraints that prevent common pitfalls and anti-patterns
- An abstraction that makes the right thing easy ("pit of success")
- Type-safe database queries that can be validated at compile time
- Less boilerplate so developers can focus on the important parts of their app
- Auto-completion in code editors instead of needing to look up documentation

---