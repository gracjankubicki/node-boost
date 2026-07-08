---
name: ui-states
description: Build the full four-state contract (loading, error, empty, happy) for data views, with skeletons, designed empty states and React 19 optimistic updates.
---

# UI States

## When to use this skill

Use when building any view that renders remote data, or when adding a mutation with user-visible feedback.

## Procedure

1. Scaffold all four branches up front: loading (skeleton mirroring content), error (message + retry), empty (why + CTA), happy.
2. Empty state: decide which case it is — no data yet (onboarding CTA) vs. no results for filters (keep filters visible, offer clear).
3. Use shared `EmptyState`/`ErrorState` from `components/ui/`; extend them with slots rather than forking per feature.
4. Mutations: high-confidence, reversible → `useOptimistic`; forms → `useActionState` for pending/error; payments/irreversible → explicit pending state, no optimism.
5. Next App Router: page-level loading/error live in `loading.tsx`/`error.tsx`; this skill covers the *content* of those fallbacks.
6. Add tests for the loading/error/empty branches (MSW scenarios), not just the happy path.
