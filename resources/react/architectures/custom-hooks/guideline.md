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

- A hook belongs to its feature (`features/<x>/hooks/`); generic ones go to `src/hooks/`.
- Return an object of named fields when returning more than two values — not a tuple.
- `useX` only if it calls other hooks. Stateless logic is a plain function in `lib/` — naming it `useX` is a lie.

## React Compiler era (1.0 is stable)

Do **not** wrap everything in `useCallback`/`useMemo` "for performance" — the compiler memoizes automatically. Reach for them only when you need a referential guarantee (e.g. a value in a `useEffect` dependency array). Ritual memoization is legacy noise; do not generate it.

## Effects are a last resort

Before writing `useEffect`, check (per react.dev "You Might Not Need an Effect"):

- Derived state? Compute it during render.
- Reaction to a user event? Handle it in the event handler.
- Data fetching? That belongs to the data layer / query hooks, not a hand-rolled effect.

Legitimate effects synchronize with external systems (subscriptions, DOM APIs, analytics) — little else.
