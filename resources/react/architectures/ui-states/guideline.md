# UI States

Meaningful remote-data views need deliberate off-happy-path behavior. Implement the states that can actually occur; do not force loading/error/empty branches onto static components.

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

## Optimistic UI

Use the project's query/SWR mutation facilities when they own the server cache. In an Action-based React 19 flow, `useOptimistic` can provide instant feedback and `useActionState` can represent form results. Do **not** use optimistic updates for payments or irreversible operations.

<code-snippet name="Optimistic toggle" lang="tsx">
const [optimisticDone, setOptimisticDone] = useOptimistic(todo.done)
async function toggle() {
  startTransition(async () => {
    setOptimisticDone(!optimisticDone)
    await toggleTodoAction(todo.id)
  })
}
</code-snippet>

## Consistency

Reuse established `EmptyState`/`ErrorState` components when present. Test the applicable states with the repository's installed test stack (testing-strategy).
