# Request Boundaries

Keep protocol, trust, and runtime concerns at explicit Astro boundaries: middleware, Actions, endpoints, server-rendered routes, sessions, and environment modules.

- Validate and authorize at the first server boundary that accepts external input.
- Use `locals` for request-scoped context and avoid process-global mutable request state.
- Keep private environment values and server-only imports out of browser islands and public bundles.
- Choose Actions for typed application mutations and endpoints for protocol-oriented consumers, webhooks, or files.
- Make cookies, sessions, cache keys, redirects, and rewrites part of the route contract.
- `NB-ASTRO-005` (error) reports a route that exports `cache` while reading cookies, sessions, or cookie request headers. Request identity must not enter a shared cached response.
- Test success, invalid input, unauthenticated access, unauthorized access, and backend failure where applicable.
