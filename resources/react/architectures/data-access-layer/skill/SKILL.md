---
name: data-access-layer
description: Add or modify data fetching and mutations through the data layer — server api/ functions, query hooks, and Server Actions — instead of inline fetch.
---

# Data Access Layer

## When to use this skill

Use whenever code needs to read or write remote data, or when fixing `NB-ARCH-005`/`NB-ARCH-006` findings.

## Reading data

1. Server (Next): add a function in the feature's `api/` directory: `import "server-only"`, call the shared client, validate the response with the schema, add `"use cache"` when cacheable. Call it from the Server Component.
2. Client: add/extend a query hook (`useQuery`) in the feature's `hooks/`, delegating to the API client. Components call the hook.
3. Project has a generated client (orval/openapi-typescript)? Use it — do not hand-write parallel fetchers.

## Writing data

1. Next: Server Action (`"use server"`) that validates input (zod) and calls the data layer; invalidate affected cache tags/queries.
2. SPA: `useMutation` delegating to the API client, with `invalidateQueries` on success.

## Fixing findings

- `NB-ARCH-005`: move the call into a query hook or `api/` function; the component receives data via props/hook.
- `NB-ARCH-006`: wrap the raw RSC fetch in a data-layer function (adds validation + caching in one place).
