---
name: astro-lit-islands
description: Build Lit components and custom elements embedded in Astro with explicit hydration and attribute/property boundaries.
---

# Lit Astro Islands

## When to use this skill

Use when adding or changing a Lit component or custom element rendered from an Astro route or layout.

## Procedure

1. Confirm `@astrojs/lit` is configured and identify the element's server-render, upgrade, and browser requirements.
2. Select the smallest `client:*` directive and verify the integration's custom-element hydration behavior.
3. Define a bounded attributes/properties/events contract; keep reactive controllers, shadow DOM, and browser APIs inside Lit.
4. Keep server-only data access and credentials outside the custom element.
5. Test visible server HTML, element upgrade/hydration, shadow-DOM interaction, and relevant error/empty states.
