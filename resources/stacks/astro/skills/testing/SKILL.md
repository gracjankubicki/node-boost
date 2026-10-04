---
name: astro-testing
description: Test Astro markup, collections, islands, server routes, and adapter behavior at the appropriate boundary.
---

# Astro Testing

## When to use this skill

Use when adding or reviewing tests for an Astro project.

## Procedure

1. Inspect installed scripts and tools before importing Vitest, Playwright, Testing Library, or adapter helpers.
2. Use units for pure logic, server/render tests for route and collection contracts, and browser tests for hydration or real navigation.
3. Cover the states that exist: success, validation failure, loading/deferred fallback, error, empty, and unauthorized behavior.
4. Run `astro check`, the focused test, and the relevant static or SSR smoke test; do not treat a static build as SSR proof.

When the repository uses `node:test`, preserve that runner and its scripts. Native erasable TypeScript needs Node 22.18 or 23.6+, or Node 22.6+ with `--experimental-strip-types`. Type stripping is not typechecking. Read the Node TypeScript support documentation and project runtime constraints before changing commands.
