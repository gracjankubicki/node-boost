---
name: astro-svelte-islands
description: Build Svelte components embedded in Astro with deliberate hydration and server-to-client boundaries.
---

# Svelte Astro Islands

## When to use this skill

Use when adding or changing a Svelte component rendered from an Astro route or layout.

## Procedure

1. Confirm `@astrojs/svelte` and the project's Svelte version/configuration before editing the component.
2. Classify the component as static, SSR-only, hydrated, or client-only and choose the smallest `client:*` directive.
3. Pass a narrow serializable props object; keep stores, actions, lifecycle code, and browser APIs inside Svelte.
4. Keep private data access and authorization at the Astro/server boundary.
5. Test initial HTML, hydration, event/store behavior, and any loading/error/empty state.
