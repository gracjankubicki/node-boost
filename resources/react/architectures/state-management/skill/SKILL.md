---
name: state-management
description: Choose the right home for a piece of state (react-query, useState, URL, Context, store) and keep server data out of client stores.
---

# State Management

## When to use this skill

Use when introducing any new state, choosing between store/context/URL, or fixing `NB-ARCH-009`.

## Procedure

1. Classify: does the backend own this data? → react-query (or RSC props). Is it one component's concern? → `useState`. Should a link/refresh preserve it? → URL `searchParams`. Only genuinely shared, client-owned state goes to Context/store.
2. Mutating server data: `useMutation`/Server Action + `invalidateQueries` — never write the response into a store.
3. Before adding a store: check the ladder (`useState` → URL → Context → store) and justify each escalation.
4. Deriving from existing state? Compute in render (or `useMemo` if expensive) — not `useEffect` + `setState`.

## Fixing findings

- `NB-ARCH-009`: delete the store write; read the data via the query hook where it is needed. If the store held a derived selection, keep only the selection (ids), not the server objects.
