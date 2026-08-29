# Rendering Strategy

Choose rendering per route from its data and request contract. The project may use static-first, server-first, or mixed rendering, but the choice must be deliberate and testable.

- **Static-first**: prerender content unless a route proves it needs request-time state.
- **Server-first**: render on demand by default, then opt stable routes into prerendering when the adapter and data contract allow it.
- **Mixed**: record the route-level boundary and test both generated and request-time behavior.

Do not use a rendering mode as a substitute for caching, authorization, or data validation. A static route can still leak build-time secrets; a server route can still serve stale or shared personalized output if its cache is wrong.
