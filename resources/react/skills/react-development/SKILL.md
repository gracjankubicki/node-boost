---
name: react-development
description: Write React components and hooks following this project's composition, state and hooks conventions.
---

# React Development

## When to use this skill

Use when creating or refactoring components, hooks, or client-side state.

## Procedure

1. Read local instructions and nearby code, then check the React major (`application_info` when Node Boost is installed). Separately verify optional capabilities such as React Compiler, server Actions, the form stack, and the server-state library.
2. New component: match the existing design system and shared-component boundary; prefer composition and semantic HTML (component-composition skill).
3. State: classify first—backend data → the installed server cache/RSC; URL-worthy → the existing URL-state mechanism; local → `useState`; shared client-owned state → Context/store (state-management skill).
4. Logic outgrowing JSX → colocate a custom hook using the repository's convention (custom-hooks skill). Avoid needless effects and preserve referential guarantees unless the configured compiler or profiling proves they are unnecessary.
5. For remote-data views, design applicable loading/error/empty behavior. Add tests only through installed tooling and repository-approved commands.
