---
name: astro-react-islands
description: Build React components embedded in Astro with explicit hydration and serializable server-to-client contracts.
---

# React Astro Islands

## When to use this skill

Use when adding or changing a React component rendered from an Astro route or layout.

## Procedure

1. Confirm `@astrojs/react` is a direct integration and identify whether the component needs SSR, hydration, or client-only rendering.
2. Pick the least eager `client:*` directive that preserves the user interaction.
3. Keep data access and authorization at the Astro/server boundary; pass only the typed, serializable view model.
4. Keep browser-only hooks and event handlers inside React, without importing Astro server modules.
5. Test initial markup, hydration, keyboard interaction, and failure/empty states that the island exposes.
