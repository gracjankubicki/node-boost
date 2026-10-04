# Testing Strategy

Use a testing-trophy shape with the capabilities the repository actually has: behavior-focused component/integration tests, units for pure logic, stories/interactions where established, and a small number of E2E flows when an E2E runner exists.

## Discover before generating

The built-in `node:test` runner, Jest/Vitest, Testing Library, `userEvent`, MSW, Storybook, and Playwright/Cypress are separate capabilities. Read package scripts, local instructions, setup files, and nearby tests. Never invent `npm test`, MSW handlers, or Playwright files when the repository uses different commands or lacks those tools.

Astro projects should include `astro check` in a package validation script. `NB-ASTRO-004` (warn) reports projects that omit it.

## Built-in Node runner

Use `node:test` and `node:assert/strict` for pure logic when the repository already runs them. The runner is available from Node 18. Native TypeScript with erasable syntax works without a flag from Node 22.18 and 23.6, and in Node 24 or newer. Node 22.6 through 22.17 requires `--experimental-strip-types`. Type stripping does not typecheck, read tsconfig aliases, or support every TypeScript construct. Keep the project's separate typecheck and existing script names.

Sources: [Node TypeScript support](https://nodejs.org/api/typescript.html) and [Node test runner](https://nodejs.org/api/test.html).

`NB-ARCH-015` warns once when `testing-strategy` is enabled and the project has neither a recognised test capability nor test files after audit exclusions. It checks presence, not a coverage percentage. Disable this project-level finding with `audit.rules["NB-ARCH-015"] = "off"`; JSON configuration cannot contain source suppression comments.

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
