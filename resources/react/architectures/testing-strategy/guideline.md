# Testing Strategy

Shape: testing trophy. Most value sits in component/integration tests (Testing Library), a handful of e2e flows (Playwright), unit tests for pure logic.

## Test behavior, not implementation

<code-snippet name="Query by role, act like a user" lang="tsx">
render(<InvoiceForm />)
await user.type(screen.getByLabelText(/amount/i), "120")
await user.click(screen.getByRole("button", { name: /save/i }))
expect(await screen.findByText(/invoice saved/i)).toBeInTheDocument()
</code-snippet>

- Select by role/label — it survives refactors and enforces accessible markup for free.
- No assertions on internal state, no shallow rendering, `data-testid` only when no role/label fits.

## Mock the network, not your code

Use MSW: tests run through the real query hooks and data layer, with the API faked at the network boundary (the FE equivalent of `Http::fake()`). Never mock `useInvoices` itself — that tests a stub.

## What to test

- User-visible behavior of features (happy path + validation).
- **Off-happy-path states**: loading, error, empty — the fallbacks nobody sees until production (pairs with ui-states).
- Complex hook logic via `renderHook`; pure functions as plain unit tests.
- Critical journeys (login, checkout) as Playwright e2e — few and stable.
- Automate a11y checks where cheap: `jest-axe`/axe-core on key screens.

## Anti-patterns

- Chasing 100% coverage; snapshot-testing everything (brittle, diffs unread).
- Mocking modules the test is supposed to exercise.
- Next: async Server Components don't render meaningfully in jsdom — cover RSC via e2e/integration and unit-test the extracted data-layer logic instead.
