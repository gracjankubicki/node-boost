# State Management

Classify state before placing it. Each kind has exactly one correct home; most bugs come from putting server data in a client store.

| Kind | Example | Home |
|---|---|---|
| Server state | invoices, users | installed server cache (Query/SWR) or RSC props |
| Local UI state | open modal, input value | `useState` in the component |
| Shared client state | theme, sidebar, multi-step draft | Context (rare updates) / store like zustand (frequent) |
| URL state | filters, pagination, active tab | `searchParams` |

## The one big rule: server state is a cache, not state

<code-snippet name="Anti-pattern: copying cache into a store" lang="ts">
// WRONG — two sources of truth, manual sync, staleness bugs (NB-ARCH-009, warn)
const invoices = await api.getInvoices()
useInvoiceStore.setState({ invoices })
</code-snippet>

The installed server-state mechanism already owns keys, freshness, refetch, and mutation updates. Use TanStack Query/react-query-kit, SWR, RSC, or the repository's custom boundary as detected; do not introduce a second cache library. A client store holds only what the backend does not know (preferences, drafts, selections).

## Escalation ladder

`useState` → URL → Context → store. Escalate only when the level below fails. URL state is underused: filters and pagination in `searchParams` give deep links, back button and refresh survival for free.

## Next specifics

Server Components remove the need for much client state—data arriving as props needs no client cache. Use a client cache only for interactive regions that need it and follow the library already installed.

## Anti-patterns

- A global store as junk drawer (2016-Redux style).
- Deriving state with `useEffect` + `setState` — compute it during render instead.
- Duplicating URL state in a store and syncing by hand.
