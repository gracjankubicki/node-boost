---
name: astro-server-runtime
description: Implement Astro Actions, endpoints, middleware, sessions, environment variables, and cache boundaries safely.
---

# Astro Server Runtime

## When to use this skill

Use when changing Actions, endpoints, `src/middleware.*`, `Astro.locals`, sessions, `astro:env`, or route caching.

## Procedure

1. Identify the protocol and trust boundary: Action, endpoint, middleware, session, or cached route.
2. Validate inputs, authenticate, authorize, and normalize errors at the server boundary.
3. Keep private environment variables and server-only imports out of browser islands.
4. Verify adapter support for sessions, streaming, cache providers, and edge/Node runtime differences.
5. Prove cache keys do not share personalized output, then run request-time tests for success, failure, and unauthorized cases.
