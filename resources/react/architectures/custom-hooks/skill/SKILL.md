---
name: custom-hooks
description: Extract component logic into custom hooks with clean APIs, avoid ritual memoization and unnecessary effects.
---

# Custom Hooks

## When to use this skill

Use when a component's logic outgrows its JSX, when duplicating stateful logic, or when reviewing `useEffect`/`useCallback` usage.

## Procedure

1. Identify the cohesive slice of state + handlers; colocate it using the nearest established hook convention (feature-local or shared `hooks/`).
2. Return an object of named fields; keep the component consuming it declarative.
3. Compose from existing hooks (query hooks, other custom hooks) instead of duplicating.
4. Audit every `useEffect` you are about to write: derived state → compute in render; event reaction → handler; fetching → data layer. Keep effects only for external-system sync.
5. Skip ritual `useCallback`/`useMemo`. Preserve them when referential identity matters or profiling justifies them; rely on automatic memoization only after verifying React Compiler is configured.

For effects that synchronize with external systems, handle cleanup, cancellation/races, and Strict Mode's development re-run.

## Testing

Complex hook logic gets a `renderHook` test; simple glue is covered by the component's tests.
