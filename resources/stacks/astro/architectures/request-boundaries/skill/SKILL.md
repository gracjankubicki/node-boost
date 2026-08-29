---
name: request-boundaries
description: Design secure Astro middleware, Actions, endpoints, sessions, environment, and cache boundaries.
---

# Request Boundaries

## When to use this skill

Use when changing request handling, server mutations, middleware, sessions, environment variables, or cache rules.

## Procedure

1. Name the boundary and its protocol: page, Action, endpoint, middleware, or session.
2. Validate input, authenticate, authorize, and normalize errors before domain work.
3. Keep request-scoped values in `locals` and private values in server-only modules.
4. Verify adapter/runtime support and ensure cache keys cannot share personalized responses.
5. Exercise authorized, unauthorized, invalid, failure, and happy paths with the project's installed tools.
