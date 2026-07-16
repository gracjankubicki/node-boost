# Vitest

- Runner for unit and component tests; component tests use Testing Library + `@testing-library/jest-dom` matchers only when those packages and a DOM environment are configured.
- Test behavior through roles/labels when Testing Library is installed. Use MSW when present; otherwise follow the repository's established network seam.
- Structure: `describe` per unit/feature, test names state observable behavior ("shows validation error when amount is empty").
- Use `vi.fn()`/`vi.spyOn()` for collaborator seams. Focused `vi.mock()` usage can be appropriate for a deliberate unit boundary; restore mocks between tests.
- Keep tests deterministic: fake timers for time-dependent logic (`vi.useFakeTimers`), no real network, no ordering dependence.
- Run focused and full tests through the repository's documented package-manager command or wrapper. Do not assume `npm test`; some projects require Yarn, pnpm, Make targets, code generation, or i18n compilation first.
