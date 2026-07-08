---
name: testing-frontend
description: Test features with Testing Library + MSW (Vitest) and critical journeys with Playwright — behavior over implementation.
---

# Frontend Testing

## When to use this skill

Use when writing or fixing tests for components, hooks, or user flows.

## Procedure

1. Default to a component test: render the feature entry, drive it with `userEvent`, assert via `getByRole`/`getByLabelText`.
2. Fake the network with MSW per scenario (success/error/empty); never mock the project's own hooks or data layer.
3. Cover the four view states, not just the happy path.
4. Pure logic → unit test; complex hooks → `renderHook`; critical journeys → Playwright (own guideline).
5. Bug fix? Write the failing test first, then fix.
