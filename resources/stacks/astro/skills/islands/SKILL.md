---
name: astro-islands
description: Add Astro client and server islands with deliberate hydration, serialization, and fallback boundaries.
---

# Astro Islands

## When to use this skill

Use when adding `client:*` directives, interactive UI integrations, or `server:defer` components.

## Procedure

1. Prove the component needs browser or deferred server work; keep it static otherwise.
2. Pick the smallest hydration trigger that meets the interaction requirement.
3. Pass only serializable, minimal props and keep credentials, request objects, and data access on the server.
4. For `server:defer`, provide a meaningful fallback and verify cache and personalization behavior.
5. Test both the server-rendered fallback/HTML and the hydrated or deferred behavior.
