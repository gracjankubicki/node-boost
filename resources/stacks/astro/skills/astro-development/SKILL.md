---
name: astro-development
description: Build Astro applications while preserving server, build-time, and browser boundaries.
---

# Astro Development

## When to use this skill

Use when creating or refactoring `.astro` routes, layouts, components, endpoints, or Astro configuration.

## Procedure

1. Read local instructions, scripts, `astro.config.*`, the installed Astro major, adapter, and UI integrations.
2. Classify the code as build-time, request-time server code, or browser island code before editing it.
3. Keep pages thin and compose layouts/features; put browser behavior behind an explicit `client:*` directive.
4. Validate data at the collection, endpoint, or Action boundary and pass minimal serializable props to templates and islands.
5. Run the repository's checks, including `astro check` when configured, then an appropriate static or SSR smoke test.
