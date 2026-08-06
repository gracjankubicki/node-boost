---
name: data-access-layer
description: Add or modify remote reads and writes through the project's established data layer instead of inline network calls.
---

# Data Access Layer

## When to use this skill

Use whenever code needs to read or write remote data, or when fixing `NB-ARCH-005`/`NB-ARCH-006` findings.

## Procedure

1. Discover the existing data boundary, server-state library, runtime schema library, generated clients, and cache conventions from dependencies and nearby code. Extend them; do not introduce a parallel TanStack Query, SWR, Zod, or feature-directory stack.
2. Server reads (Next): add or extend a shared/feature server data function, keep secrets server-only, call the shared client, and runtime-validate untrusted responses. Choose caching from the detected Next version and configuration: Next 14 uses `fetch` cache/revalidation; `"use cache"` is only valid when Cache Components is enabled.
3. Client reads: use the installed mechanism (`useQuery`/react-query-kit, SWR, or the project's custom hook) and its established key/error conventions.
4. Generated client? Do not edit generated files or hand-write a parallel fetcher. Compose through the project's wrapper and run its documented generation command when the source contract changes.
5. Writes: use the established mutation path (Server Action, Route Handler, Query mutation, SWR mutation, or custom client). Validate input at the server boundary, map error envelopes, and update/invalidate the relevant cache rather than defaulting to blanket invalidation.

## Fixing findings

- `NB-ARCH-005`: move the call into the existing client data hook/function; the component receives data via props or that hook.
- `NB-ARCH-006`: wrap the raw RSC fetch in the configured data layer so headers, validation, errors, observability, and caching have one owner.
