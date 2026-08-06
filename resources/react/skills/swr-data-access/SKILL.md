---
name: swr-data-access
description: Implement reads, mutations, and cache updates through an existing SWR data layer.
---

# SWR Data Access

## When to use this skill

Use when a project with `swr`/`swr/mutation` reads or writes remote data.

## Procedure

1. Reuse the shared fetcher, API functions, stable key shapes, and error envelope from nearby code; do not add TanStack Query.
2. Reads use `useSWR`/`useSWRInfinite` with every response-changing input in the key and `null` when disabled.
3. Writes use the established `useSWRMutation`/setter. Apply scoped `mutate`, optimistic data + rollback for reversible actions, and revalidation where server truth may differ.
4. Preserve FormData, credentials, retry/deduping, pagination, and cache invalidation conventions.
5. Test through installed tooling and the repository's existing network seam.
