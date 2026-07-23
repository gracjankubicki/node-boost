# SWR

- SWR is this project's client server-state mechanism. Do not add a parallel TanStack Query layer.
- Reuse the repository's key factory/key shapes and shared fetcher. Keys must be stable and include every input that changes the response; use `null` for disabled requests.
- Use `useSWRMutation`/the established setter for writes. Update with scoped `mutate`, optimistic data, rollback, and revalidation according to the mutation's risk.
- Distinguish initial loading, background validation, errors, and empty results. Infinite lists use the installed `useSWRInfinite` convention.
- Preserve credentials, error-envelope mapping, FormData behavior, deduping, and retry policy from the shared API layer.
