# TanStack Query Core

- react-query owns server state — it is a cache, not a store. Never copy query results into zustand/Context (see state-management guideline).
- Components consume query hooks from the feature (`useInvoices()`), never `useQuery` inline with a raw fetch (see data-access-layer guideline).
- Query keys are structured and centralized per feature: `["invoices", filter]` — keys are the cache identity, treat them as an API.
- Mutations invalidate what they change: `useMutation` + `queryClient.invalidateQueries({ queryKey: ["invoices"] })` on success; optimistic updates via `onMutate`/`onError` rollback where UX warrants it.
- Handle all result states in the UI: `isLoading`, `isError`, empty data (see ui-states guideline).
- Configure sensible `staleTime` per data class instead of refetching everything on every focus.
