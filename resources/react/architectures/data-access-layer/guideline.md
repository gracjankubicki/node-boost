# Data Access Layer

Components do not own transport details. Route remote reads and writes through the data boundary already established by the repository.

## Select the local variant first

- Next server functions may live in shared `src/api`, `server/`, a feature, or another documented boundary.
- Client server-state may use TanStack Query/react-query-kit, SWR, or a custom abstraction. Use the installed one.
- Generated clients are transport building blocks, not proof of runtime validation. Do not edit generated output; compose generated calls and schemas through the project's wrapper.
- Use the runtime schema library already present (for example Zod or Valibot).

## Server side (Next)

<code-snippet name="Data layer function" lang="ts">
import "server-only"

export async function getInvoices(filter: InvoiceFilter) {
  const response = await apiClient.get("/invoices", { query: filter })
  return invoiceListSchema.parse(response)
}
</code-snippet>

Auth headers, timeouts, cancellation, error-envelope handling, retries, observability, runtime validation, and cache policy belong at this boundary. Caching is capability-sensitive:

- Next 14: use the repository's `fetch` cache/revalidation and tags.
- Next 15/16 without Cache Components: preserve the configured `fetch`/route model.
- Cache Components enabled: `"use cache"`, `cacheLife`, and related APIs are available.

## Client side

Components consume the project's existing query/SWR/custom hooks. Stable keys, mutation behavior, cache updates, and invalidation follow nearby code. Do not add TanStack Query to an SWR application or vice versa.

## Rules

- `NB-ARCH-005` (error): `fetch`/axios/ky in a client component outside the configured data layer and query hooks.
- `NB-ARCH-006` (warn): raw network calls in a Server Component outside the data layer.
- Configure locations with `audit.ruleOptions` (`dataLayerGlobs`, default `**/api/**`, `**/server/**`, `lib/api/**`, `route.ts`).

## Anti-patterns

- `useEffect` + `useState` + `fetch` in a component.
- Copy-pasting auth headers per call site.
- Assuming a generated TypeScript client makes untrusted JSON runtime-safe.
- Blanket invalidation when a precise cache update or returned server state is available.
