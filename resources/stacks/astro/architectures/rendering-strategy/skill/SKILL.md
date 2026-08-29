---
name: rendering-strategy
description: Select and validate static-first, server-first, or mixed rendering in Astro.
---

# Rendering Strategy

## When to use this skill

Use when choosing `output`, `prerender`, adapter behavior, or route caching.

## Procedure

1. Inventory request inputs, data freshness, personalization, and deployment constraints for the route.
2. Select the least dynamic strategy that satisfies those constraints.
3. Mark route-level exceptions explicitly and keep links, redirects, headers, cookies, and cache rules consistent.
4. Test the generated artifact and the request-time path where both exist.
