---
name: testing-strategy
description: Write component tests with Testing Library and MSW, e2e with Playwright, and unit tests for pure logic — behavior over implementation.
---

# Testing Strategy

## When to use this skill

Use when adding tests for a feature, fixing a bug (write the failing test first), or reviewing test quality.

## Procedure

1. Default to a component test: render the feature entry, interact via `userEvent`, assert what the user sees (`getByRole`/`getByLabelText`).
2. Fake the API with MSW handlers per scenario (success, error, empty) — never mock your own hooks or data-layer functions.
3. Cover the four view states: happy, loading, error, empty.
4. Pure logic (formatters, reducers, complex hooks) → unit tests / `renderHook`.
5. Critical user journey changed? Update/add the Playwright e2e for it.
6. Next RSC: test through e2e or extract the logic into the data layer and unit-test that.
