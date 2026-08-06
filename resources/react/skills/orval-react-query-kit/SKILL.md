---
name: orval-react-query-kit
description: Compose Orval-generated clients and runtime schemas through an established react-query-kit API layer.
---

# Orval and React Query Kit

## When to use this skill

Use when changing API modules in a project with Orval or `react-query-kit`.

## Procedure

1. Read the generator config and repository commands. Never hand-edit generated clients, schemas, or model files.
2. Reuse generated calls and generated runtime schemas through the project's router/query wrappers; keep manual endpoints explicit.
3. Generated TypeScript does not validate responses. Invoke generated schemas according to the project's fail-closed or telemetry-only validation policy.
4. Preserve query-key ownership, cache updates/invalidation, error envelopes, cancellation, and Axios interceptors.
5. Run documented generation plus scoped type/lint/test checks.
