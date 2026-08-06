---
name: typed-contracts
description: Validate external data at API, form, environment, and URL boundaries with the project's runtime schema library.
---

# Typed Contracts

## When to use this skill

Use when consuming an API response, handling form input, adding an env variable, reading URL state, or fixing `NB-ARCH-007`/`NB-ARCH-008`.

## Procedure

1. Identify the installed runtime schema library and local schema placement (for example Zod or Valibot). Extend it rather than adding a second library.
2. API boundary: parse/safe-parse untrusted JSON in the data layer. Generated TypeScript clients provide compile-time types, not runtime trust. If runtime schemas are generated, invoke them; skip only generated output or a boundary with a documented upstream guarantee.
3. Forms: use the established form/resolver integration and validate again at the server endpoint. Handle FormData coercion and map server errors to fields without exposing internals.
4. Env: add the variable to the central env schema; import the validated value instead of reading `process.env.X` inline.
5. URL params/search state are untrusted strings; parse/coerce them with the local schema or URL-state library.
6. Choose fail-closed parsing for correctness/security boundaries or a documented fail-open telemetry mode when rollout compatibility requires it.

## Fixing findings

- `NB-ARCH-007`: parse the raw `res.json()`/`JSON.parse` result with the existing runtime schema. An Orval/openapi-typescript dependency alone does not suppress this rule.
- `NB-ARCH-008`: move the environment read into the project's env module and import the validated value.
