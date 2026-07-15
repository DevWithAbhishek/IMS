### Why State Machine?

The Incident Management System uses a **state machine** to model the lifecycle of an incident and enforce valid state transitions.

An incident progresses through a well-defined sequence of states such as:

Open → Acknowledged → Investigating → Resolved → Closed

Not every transition is valid. For example, a closed incident should not transition directly back to investigating without following the defined business workflow.

Rather than scattering state validation across controllers, services, and workers using numerous conditional statements, the application centralizes all transition rules within a single state machine. This ensures every incident follows the same business workflow regardless of which module initiates the transition.

Using a state machine provides:

- Predictable incident lifecycle management.
- Centralized business rules.
- Prevention of invalid state transitions.
- Easier testing of workflow logic.
- Improved maintainability as new states or transitions are introduced.
- Consistent behavior across API requests and background workers.

As the application evolves, new states and transitions can be added by extending the state machine rather than modifying business logic throughout the codebase.

The project therefore prioritizes:

- Explicit workflow definition.
- Strong business rule enforcement.
- Predictable state transitions.
- Better maintainability.
- Easier testing.

#### Trade-offs Accepted

- Additional implementation complexity.
- Every new state requires transition definitions.
- Developers must understand the workflow model before modifying business logic.