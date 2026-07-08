# Data Access Layer

Components never call `fetch` directly. All data access lives in a dedicated layer: server functions in `api/` directories and client-side query hooks.

## Server side (Next)

<code-snippet name="Data layer function" lang="ts">
// features/invoices/api/get-invoices.ts
import "server-only"

export async function getInvoices(filter: InvoiceFilter) {
  "use cache"
  const res = await apiClient.get("/invoices", { query: filter })
  return invoiceListSchema.parse(res) // validate at the boundary (typed-contracts)
}
</code-snippet>

Server Components call `getInvoices()`, not `fetch`. Auth headers, error handling, retries and cache tags live in one place. Mutations go through Server Actions (`"use server"`) that validate input and call the data layer.

## Client side

Components consume query hooks, never raw fetch:

<code-snippet name="Query hook" lang="ts">
// features/invoices/hooks/use-invoices.ts
export function useInvoices(filter: InvoiceFilter) {
  return useQuery({ queryKey: ["invoices", filter], queryFn: () => invoicesApi.list(filter) })
}
</code-snippet>

Generated API clients (orval, openapi-typescript) **are** the data layer — use them instead of hand-writing one.

## Rules

- `NB-ARCH-005` (error): `fetch`/axios/ky in a client component outside the data layer and outside query hooks.
- `NB-ARCH-006` (warn): raw `fetch` in a Server Component outside the data layer. Fetching directly in RSC is the framework idiom, but a layer keeps caching, headers and validation consistent — prefer it.
- The layer's location is configurable via `audit.ruleOptions` (`dataLayerGlobs`, default `**/api/**`, `**/server/**`, `lib/api/**`, `route.ts`).

## Anti-patterns

- `useEffect` + `useState` + `fetch` in a component — that is a hand-rolled, worse react-query.
- Copy-pasting auth headers per call site.
- Mutations bypassing Server Actions / the API client, losing validation and cache invalidation.
