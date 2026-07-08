# Component Composition

Pass content, not configuration. Prefer children and slots over boolean-prop switchboards.

## The ladder

1. `children` — the default.
2. Named slots — JSX passed as props (`header={<... />}`).
3. Compound components — `Card.Header`, `Card.Footer` sharing the parent's context.
4. Config props — only for genuine *visual variants* (`variant="danger"`), which belong to cva (see styling guideline), not to boolean if-trees.

<code-snippet name="Composition over configuration" lang="tsx">
// WRONG: configurator — every new need adds a prop and an if
<Card title="Invoices" showHeader hasIcon icon="invoice" withFooter footerButtons={["save"]} />

// RIGHT: frame with slots — new needs compose at the call site
<Card>
  <Card.Header icon={<InvoiceIcon />}>Invoices</Card.Header>
  <InvoiceTable invoices={invoices} />
  <Card.Footer><SaveButton /></Card.Footer>
</Card>
</code-snippet>

Heuristic: the **third boolean prop** on a component is a signal it should be two components or slots (`disabled`, `isLoading` are fine).

## Boundaries

Shared UI (`components/ui/`) knows no domain: no query hooks, no feature imports — data arrives via props. Domain knowledge lives in feature components (this pairs with feature-modules).

## Prop drilling

Fix by composing higher, not by reaching for Context: assemble the subtree where the data lives and pass the finished fragment down. Context is an escalation (see state-management).

## Semantic HTML first

Interactive elements are `<button>`/`<a>`/`<label>`, not clickable `<div>`s — generated markup that looks right but breaks keyboard/screen-reader flows is a defect.

## Dead idioms — do not generate

- `forwardRef` — in React 19 `ref` is a regular prop.
- Render props for things children/hooks solve.
- `defaultProps` on function components — use default parameters.
