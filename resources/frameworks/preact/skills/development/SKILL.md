---
name: astro-preact-islands
description: Build Preact components embedded in Astro with explicit hydration and compatibility-aware boundaries.
---

# Preact Astro Islands

## When to use this skill

Use when adding or changing a Preact component rendered from an Astro route or layout.

## Procedure

1. Confirm `@astrojs/preact` and any compatibility alias are configured directly in the project.
2. Decide whether the island needs SSR and choose the smallest `client:*` directive.
3. Pass plain serializable props; keep signals, hooks, browser APIs, and Preact stores inside the island.
4. Check React-compat imports against the project's actual Preact setup instead of assuming React behavior.
5. Test server markup and the hydrated interaction with the installed Preact-compatible tooling.
