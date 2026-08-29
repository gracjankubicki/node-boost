---
name: astro-solid-islands
description: Build Solid components embedded in Astro with explicit hydration and fine-grained state boundaries.
---

# Solid Astro Islands

## When to use this skill

Use when adding or changing a Solid component rendered from an Astro route or layout.

## Procedure

1. Confirm `@astrojs/solid-js` is configured and identify whether SSR, hydration, or client-only rendering is required.
2. Choose the least eager `client:*` directive that meets the interaction contract.
3. Pass plain serializable props and keep signals, stores, effects, resources, and browser APIs inside Solid.
4. Check effect cleanup and avoid importing Astro server-only modules into the island.
5. Test server markup, hydration, reactive updates, and relevant error/empty states.
