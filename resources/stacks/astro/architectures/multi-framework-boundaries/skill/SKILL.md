---
name: multi-framework-boundaries
description: Keep multiple Astro UI integrations isolated behind framework-neutral route and data contracts.
---

# Multi-framework Boundaries

## When to use this skill

Use when an Astro project combines two or more UI integrations or migrates an island between frameworks.

## Procedure

1. Inventory integrations and assign each component to one owning framework.
2. Define shared serializable data and semantic HTML contracts at the Astro boundary.
3. Keep framework-specific hooks, stores, lifecycle, and event assumptions inside the owning island.
4. Review hydration directives and duplicated bundle cost before adding another integration.
5. Test the framework island alone and the composed Astro route.
