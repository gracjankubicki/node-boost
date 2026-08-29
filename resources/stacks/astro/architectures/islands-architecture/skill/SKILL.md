---
name: islands-architecture
description: Design Astro client and server islands with explicit hydration and data boundaries.
---

# Islands Architecture

## When to use this skill

Use when deciding whether and how an Astro component should hydrate or defer.

## Procedure

1. Start from static HTML and identify the exact browser or deferred-server behavior required.
2. Pick the smallest `client:*` trigger or `server:defer` boundary that meets that requirement.
3. Keep server-only data and authorization outside client code; pass a narrow serializable contract.
4. Define fallback, error, and empty states for deferred or remote islands.
5. Check bundle ownership when several UI frameworks are installed and test the boundary at runtime.
