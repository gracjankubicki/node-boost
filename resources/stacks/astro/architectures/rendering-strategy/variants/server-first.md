# Rendering Strategy: Server-first

Prefer request-time rendering for authenticated applications, personalized pages, live data, and routes whose output cannot be known at build time.

- Use an adapter and runtime that support every API the route needs.
- Keep authorization before data access and avoid leaking user state through shared caches.
- Define loading, error, and unavailable-backend behavior for request-time dependencies.
- Prerender only routes whose inputs and cache semantics have been reviewed explicitly.
