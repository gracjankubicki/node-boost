# Astro Server Runtime

Keep request-time behavior explicit and adapter-aware. Actions, endpoints, middleware, sessions, environment variables, and cache rules share one trust boundary but have different contracts.

## Actions and endpoints

- Validate Action input at the boundary with the project's schema library; do not trust browser-side validation.
- Use Actions for application mutations and form workflows when their typed contract is useful. Use endpoints for protocol-oriented APIs, webhooks, files, or non-Action consumers.
- Authenticate and authorize every mutation and sensitive endpoint. A recognized Action name is not an authorization check.
- Return stable, non-sensitive errors. Log diagnostic context server-side without echoing secrets or internal stack traces.

## Middleware and locals

- Keep middleware small and deterministic. Use `context.locals` for request-scoped data, not a process-global user or mutable cache.
- Preserve the response and rewrite semantics when chaining middleware. Verify that redirects and rewrites do not bypass authorization.
- Do not place long-running data loading or irreversible side effects in middleware unless every request truly needs them.

## Sessions and environment

- Choose a session driver supported by the deployment runtime and protect session cookies with secure, scoped defaults.
- Keep private variables in server-only modules. Expose only intentionally public values through `PUBLIC_*` or `astro:env/client`.
- Prefer type-safe `astro:env` declarations and fail fast for required server variables. Never use a public variable as a secret merely because its value is injected at build time.

## Caching

- Cache only responses whose output is safe to share. A route reading cookies, sessions, authorization, or user-specific headers must not use a public cache key accidentally.
- Document cache ownership, invalidation, and stale behavior at the route boundary. Revalidate content after writes where the adapter supports it.
