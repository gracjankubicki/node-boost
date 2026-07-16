# Testing Strategy

Use a testing-trophy shape with the capabilities the repository actually has: behavior-focused component/integration tests, units for pure logic, stories/interactions where established, and a small number of E2E flows when an E2E runner exists.

## Discover before generating

Jest/Vitest, Testing Library, `userEvent`, MSW, Storybook, and Playwright/Cypress are separate capabilities. Read package scripts, local instructions, setup files, and nearby tests. Never invent `npm test`, MSW handlers, or Playwright files when the repository uses different commands or lacks those tools.

## Test behavior

<code-snippet name="Query by role, act like a user" lang="tsx">
render(<InvoiceForm />)
await user.type(screen.getByLabelText(/amount/i), "120")
await user.click(screen.getByRole("button", { name: /save/i }))
expect(await screen.findByText(/invoice saved/i)).toBeInTheDocument()
</code-snippet>

Use this shape only when the installed DOM stack provides `userEvent` and the shown matchers. Prefer roles/labels, assert observable outcomes, and avoid shallow rendering. A focused module mock can be valid at a deliberate unit seam; integration tests should exercise the real internal data path when practical.

## Scope by risk

- Remote-data views: applicable success, loading, error, and empty behavior.
- Pure functions/reducers: direct unit tests.
- Complex hooks: `renderHook` when installed.
- Async Server Components: data-layer units plus configured integration/E2E coverage; jsdom alone is often the wrong boundary.
- Reusable Storybook components: maintain required stories and interaction tests when the repository mandates them.
- Critical journeys: E2E only with the installed runner.

Avoid snapshot-only coverage, real network calls, ordering dependence, and chasing a coverage number without risk rationale.
