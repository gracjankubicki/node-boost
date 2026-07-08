# UI States

Every data view has four states, not one. Design loading, error and empty explicitly — apps spend ~30% of their time off the happy path, and generated code habitually builds only the happy branch.

<code-snippet name="The four-state contract" lang="tsx">
function InvoiceList() {
  const { data, isLoading, isError, refetch } = useInvoices()

  if (isLoading) return <InvoiceListSkeleton />
  if (isError) return <ErrorState onRetry={refetch} />
  if (!data.length) return (
    <EmptyState
      title="No invoices yet"
      description="Create your first invoice to get started."
      action={<CreateInvoiceButton />}
    />
  )
  return <InvoiceTable invoices={data} />
}
</code-snippet>

## Empty states are a feature

- Explain **why** it's empty + give the next step (CTA). A blank screen after onboarding is the user's first impression.
- Distinguish "no data yet" (onboarding CTA) from "filters matched nothing" (show the filters + a clear-filters action — no rocket illustrations).

## Loading: skeletons, not spinners

Skeletons mirror the coming content's shape (no layout shift). One skeleton per meaningful region — five racing spinners are worse than one calm block. In Next, `loading.tsx` is the page-level skeleton (see error-loading-boundaries); in SPAs, per-view skeleton components.

## Optimistic UI (React 19)

For high-confidence mutations (toggle, like, add-to-list) use `useOptimistic` — instant UI, automatic rollback on error. Forms: `useActionState` handles pending/error without hand-rolled `isSubmitting`/`setError` flags. Do **not** use optimistic updates for payments or irreversible operations.

<code-snippet name="Optimistic toggle" lang="tsx">
const [optimisticDone, setOptimisticDone] = useOptimistic(todo.done)
async function toggle() {
  setOptimisticDone(!optimisticDone)   // instant
  await toggleTodoAction(todo.id)      // rollback happens automatically on error
}
</code-snippet>

## Consistency

`EmptyState`/`ErrorState` are shared slot-based components in `components/ui/` — not ad-hoc divs per feature. Test all four states (testing-strategy).
