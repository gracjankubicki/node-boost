---
name: state-management
description: Choose the right home for state using the repository's server cache, URL, component state, Context, or store.
---

# State Management

## When to use this skill

Use when introducing any new state, choosing between store/context/URL, or fixing `NB-ARCH-009`.

## Procedure

1. Identify the project's server-state mechanism first (RSC, TanStack Query/react-query-kit, SWR, or custom). Backend-owned data belongs there. One-component UI state → `useState`; shareable/refresh-persistent state → URL; genuinely shared client-owned state → Context/store.
2. Mutating server data: use the established mutation API, then apply the smallest correct cache update (`setQueryData`, SWR `mutate`, returned server state, tags, or targeted invalidation). Do not copy server objects into a parallel client store.
3. Before adding a store: check the ladder (`useState` → URL → Context → store) and justify each escalation.
4. Deriving from existing state? Compute in render (or `useMemo` if expensive) — not `useEffect` + `setState`.

## Fixing findings

- `NB-ARCH-009`: delete the store write; read data through the established server-state boundary. If the store held a derived selection, keep only client-owned selection IDs, not server objects.
