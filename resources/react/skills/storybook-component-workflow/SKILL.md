---
name: storybook-component-workflow
description: Develop reusable components and deterministic stories with the repository's installed Storybook version and conventions.
---

# Storybook Component Workflow

## When to use this skill

Use when creating or changing a reusable component in a project that declares Storybook.

## Procedure

1. Read the installed Storybook major, repository scripts, preview configuration, nearby stories, decorators, and title hierarchy before editing.
2. Build the component against project primitives and tokens, then add only representative visual, responsive, loading, empty, error, and disabled states.
3. Keep stories deterministic. Reuse configured providers, loaders, and MSW handlers instead of calling live services.
4. Add `play` interaction coverage only when the repository has Storybook test tooling; keep focused logic and critical E2E tests in their existing runners.
5. Run the repository's Storybook build, test, Chromatic, or visual-regression command when one is configured.
