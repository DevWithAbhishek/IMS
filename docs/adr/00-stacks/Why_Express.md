### Why Express?

The Incident Management System uses **Express.js** as its backend framework due to its simplicity, flexibility, and mature ecosystem. Express provides a lightweight HTTP framework that allows the application's architecture to be designed explicitly rather than following framework-imposed conventions.

Unlike opinionated frameworks, Express gives complete control over routing, middleware composition, error handling, dependency organization, and project structure. This flexibility aligns well with the modular monolith architecture adopted by IMS, where architectural boundaries are defined by the application rather than the framework.

Express also benefits from a large production ecosystem, extensive community support, and mature TypeScript integration through community-maintained type definitions. Most backend libraries in the Node.js ecosystem are designed to work seamlessly with Express, making integrations straightforward.

Although frameworks such as NestJS provide built-in dependency injection, decorators, and architectural conventions that can improve consistency in larger teams, they also introduce additional abstractions. For IMS, these abstractions provide limited benefit compared to the additional learning and framework complexity.

The project therefore prioritizes:

- Explicit architecture over framework conventions.
- Fine-grained control over middleware and request lifecycle.
- A lightweight runtime with minimal abstractions.
- Strong compatibility with the broader Node.js ecosystem.

Express remains capable of supporting large-scale production systems, while allowing the project architecture to evolve independently of the framework itself.

#### Trade-offs Accepted

- More boilerplate compared to NestJS.
- No built-in dependency injection container.
- Project structure must be enforced by team conventions.
- More architectural discipline is required as the codebase grows.