---
name: astro-vue-islands
description: Build Vue components embedded in Astro with explicit hydration and serializable component contracts.
---

# Vue Astro Islands

## When to use this skill

Use when adding or changing a Vue component rendered from an Astro route or layout.

## Procedure

1. Confirm `@astrojs/vue` is configured and identify the component's SSR, hydration, and browser requirements.
2. Select the least eager `client:*` directive that supports the user flow.
3. Define plain serializable props at the Astro boundary; keep Vue reactivity, lifecycle, events, and browser APIs inside the island.
4. Keep server-only data access and authorization outside the Vue module.
5. Test server HTML and hydrated interaction using the repository's configured Vue tooling.
