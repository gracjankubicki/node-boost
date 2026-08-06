# Custom Hooks

Extract stateful logic into `useX` hooks so components stay declarative — thin controllers over a view.

## When to extract

- The logic is used in two or more places, OR
- the component is unreadable (JSX buried under state/effects), OR
- the logic deserves its own test.

When none apply, don't: a hook wrapping a single `useState` is ceremony.

<code-snippet name="Thin component, logic in a hook" lang="tsx">
function InvoiceList() {
  const { invoices, filter, setFilter, selected, toggleSelection } = useInvoiceSelection()
  return <Table rows={invoices} filter={filter} onFilter={setFilter} onToggle={toggleSelection} />
}
</code-snippet>

## Conventions

- Follow nearby layout. A hook may be feature-local or live in a shared `hooks/` directory; do not introduce a new feature tree only to place one hook.
- Return an object of named fields when returning more than two values — not a tuple.
- `useX` only if it calls other hooks. Stateless logic is a plain function in `lib/` — naming it `useX` is a lie.

## Memoization and React Compiler

Do **not** wrap everything in `useCallback`/`useMemo` "for performance." Reach for them when you need a referential guarantee or measured optimization. React Compiler can automate memoization only when the repository has installed and configured its build integration; React 19 alone is not evidence that it runs.

## Effects are a last resort

Before writing `useEffect`, check (per react.dev "You Might Not Need an Effect"):

- Derived state? Compute it during render.
- Reaction to a user event? Handle it in the event handler.
- Data fetching? That belongs to the data layer / query hooks, not a hand-rolled effect.

Legitimate effects synchronize with external systems (subscriptions, DOM APIs, analytics). Add cleanup, abort stale work, and account for Strict Mode's development setup/cleanup cycle.
