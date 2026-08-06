# Playwright

- Reserve e2e for critical user journeys (login, checkout, core flows)—few, stable, high-value; everything else belongs in component tests.
- Select by role/label (`getByRole`, `getByLabel`)—same philosophy as Testing Library; avoid CSS/XPath selectors.
- Rely on web-first assertions (`await expect(locator).toBeVisible()`)—no manual `waitForTimeout` sleeps.
- Isolate state per test (fresh context/storage); seed data through APIs or fixtures, not through UI click-chains.
- Stub third-party/external services with `page.route()`; your own backend runs real in e2e when feasible.
- Use the accessibility snapshot/axe integration on key pages when cheap.
