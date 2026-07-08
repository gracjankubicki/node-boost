# Zod Core

- Validate at system boundaries only: API responses (data layer), form/action input, env, URL params. Inside the app, the inferred type is the truth — no re-parsing (see typed-contracts guideline).
- One schema per contract, types derived with `z.infer`; narrower views via `.pick()`/`.omit()`/`.extend()`, not re-declared interfaces.
- `.parse()` when failure is a bug (throw), `.safeParse()` when failure is a flow (form input, external data you degrade gracefully on).
- Keep schemas next to the data layer that uses them (`features/<x>/api/schemas.ts`).
- Follow the version-specific zod guideline — the v3 → v4 API changed materially.
