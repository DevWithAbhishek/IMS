### Why Argon2 instead of bcrypt?

The Incident Management System uses **Argon2** for password hashing because it provides stronger protection against modern password-cracking techniques while remaining configurable for different deployment environments.

Unlike bcrypt, which primarily increases computational cost, Argon2 is a **memory-hard** password hashing algorithm. It requires both CPU time and significant memory to compute password hashes, making large-scale brute-force attacks using GPUs and specialized hardware considerably more expensive.

Argon2 also exposes configurable parameters for:

- Memory cost.
- Time cost.
- Parallelism.

These parameters allow the hashing workload to be tuned according to available server resources while maintaining an acceptable authentication latency.

IMS stores only password hashes in PostgreSQL. Plain-text passwords are never stored, and passwords are never encrypted because authentication requires one-way hashing rather than reversible encryption.

Although bcrypt remains a secure and widely adopted password hashing algorithm, Argon2 is the more modern choice and aligns better with current security recommendations for new applications.

The project therefore prioritizes:

- Strong password protection.
- Memory-hard hashing.
- Configurable security parameters.
- Future-proof authentication.
- Modern security best practices.

#### Trade-offs Accepted

- Higher memory consumption than bcrypt.
- Slightly higher computational overhead.
- Parameter tuning is required for optimal performance.
- Increased resource usage during authentication.