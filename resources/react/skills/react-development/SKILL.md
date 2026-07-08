---
name: react-development
description: Write React components and hooks following this project's composition, state and hooks conventions.
---

# React Development

## When to use this skill

Use when creating or refactoring components, hooks, or client-side state.

## Procedure

1. Check the React major (`application_info`) and follow the versioned guideline — 18 vs 19 idioms differ (ref-as-prop, Actions, compiler memoization).
2. New component: start from composition (children/slots), semantic HTML, props for variants only (component-composition skill).
3. State: classify first — server data → query hooks; URL-worthy → searchParams; local → `useState`; shared client → Context/store (state-management skill).
4. Logic outgrowing the JSX → extract a custom hook in the feature (custom-hooks skill); avoid needless `useEffect` and ritual memoization.
5. Cover the four UI states (ui-states skill) and add behavior tests (testing-frontend skill).
