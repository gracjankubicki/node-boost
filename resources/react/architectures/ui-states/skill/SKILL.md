---
name: ui-states
description: Design relevant loading, error, empty, and happy states for remote-data views and safe mutation feedback.
---

# UI States

## When to use this skill

Use when building a meaningful remote-data view or adding a mutation with user-visible feedback. Static/presentational components do not need four artificial branches.

## Procedure

1. For each applicable state, design loading (stable layout), error (message + retry when useful), empty (why + next step), and happy behavior.
2. Distinguish no data yet from no filtered results; preserve filters and offer clear/reset for the latter.
3. Reuse the repository's established empty/error primitives when they exist; do not invent `components/ui` solely to satisfy this skill.
4. Match the installed mutation stack. Query/SWR optimistic cache updates work across supported React versions. React 19 `useOptimistic` is optional and its setter must run inside an Action or Transition. Irreversible operations use explicit pending/confirmation, not optimism.
5. Next App Router route-level fallbacks live in `loading.tsx`/`error.tsx`; use component-level states for interactive/cache-driven regions.
6. Test applicable states with the installed runner and mocking approach. Adding MSW or an E2E runner is a separate explicit toolchain decision.
