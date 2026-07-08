---
name: custom-hooks
description: Extract component logic into custom hooks with clean APIs, avoid ritual memoization and unnecessary effects.
---

# Custom Hooks

## When to use this skill

Use when a component's logic outgrows its JSX, when duplicating stateful logic, or when reviewing `useEffect`/`useCallback` usage.

## Procedure

1. Identify the cohesive slice of state + handlers; move it to `features/<x>/hooks/use-<name>.ts`.
2. Return an object of named fields; keep the component consuming it declarative.
3. Compose from existing hooks (query hooks, other custom hooks) instead of duplicating.
4. Audit every `useEffect` you are about to write: derived state → compute in render; event reaction → handler; fetching → data layer. Keep effects only for external-system sync.
5. Skip `useCallback`/`useMemo` unless a referential guarantee is required — React Compiler handles memoization.

## Testing

Complex hook logic gets a `renderHook` test; simple glue is covered by the component's tests.
