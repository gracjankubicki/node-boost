# Vitest

- Runner for unit and component tests; component tests use Testing Library + `@testing-library/jest-dom` matchers in a jsdom (or browser-mode) environment.
- Test behavior through roles/labels; mock the network with MSW, never your own hooks/modules under test (see testing-strategy guideline).
- Structure: `describe` per unit/feature, test names state observable behavior ("shows validation error when amount is empty").
- Use `vi.fn()`/`vi.spyOn` for collaborator seams; avoid `vi.mock` of internal modules — it usually signals a missing seam.
- Keep tests deterministic: fake timers for time-dependent logic (`vi.useFakeTimers`), no real network, no ordering dependence.
- Run a focused file with `vitest run <path>`; the full gate is the project's `npm test`.
