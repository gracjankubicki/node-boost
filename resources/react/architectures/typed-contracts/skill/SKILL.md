---
name: typed-contracts
description: Validate external data with zod at system boundaries (API, forms, env, URL) and derive TypeScript types from schemas.
---

# Typed Contracts

## When to use this skill

Use when consuming an API response, handling form input, adding an env variable, reading searchParams, or fixing `NB-ARCH-007`/`NB-ARCH-008`.

## Procedure

1. Define/extend the zod schema next to the data layer (`features/<x>/api/schemas.ts`); export `type X = z.infer<typeof xSchema>`.
2. API boundary: `.parse()` (throw) or `.safeParse()` (handle) in the data-layer function. Skip when the client is generated from OpenAPI.
3. Forms: zod resolver + validate the same schema at the start of the Server Action / mutation.
4. Env: add the variable to `env.ts` schema; import `env` from there, never `process.env.X` inline.
5. Never cast external data with `as` — if the shape is unknown, parse it.

## Fixing findings

- `NB-ARCH-007`: wrap the raw `res.json()`/`JSON.parse` result in `schema.parse(...)`.
- `NB-ARCH-008`: move the `process.env.X` read into `env.ts` and import the validated value.
