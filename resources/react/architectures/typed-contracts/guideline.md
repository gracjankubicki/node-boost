# Typed Contracts

TypeScript types do not exist at runtime. Validate external data at the system's boundaries with zod, infer types from schemas, and trust types everywhere inside.

## The boundaries (validate here, and only here)

1. **API responses** — in the data layer: `invoiceListSchema.parse(await res.json())`. Exception: a generated client (orval/openapi-typescript) already carries the contract — do not double-validate.
2. **User input** — forms (react-hook-form + zod resolver) and every Server Action (validate the payload first; a Server Action is a public endpoint).
3. **Environment variables** — a single `env.ts` with a schema; crash at startup, not mid-request (`NB-ARCH-008`, warn, flags `process.env.X` elsewhere).
4. **URL params** — `searchParams` are untrusted input like any query string.

<code-snippet name="Schema as single source of truth" lang="ts">
export const invoiceSchema = z.object({
  id: z.string(),
  amount: z.number(),
  status: z.enum(["draft", "paid", "void"]),
})
export type Invoice = z.infer<typeof invoiceSchema> // type derives from schema — no duplication
</code-snippet>

## Rules

- Never `as Invoice` on external data — a cast is a promise the runtime never checks. Parse it (`NB-ARCH-007`, warn, flags unvalidated `res.json()`/`JSON.parse` in the data layer).
- One schema per contract; derive narrower views with `.pick()`/`.omit()` instead of re-declaring.
- Form UX: validate on blur for fields, on submit for the whole form; reserve layout space for the error message so the layout does not jump.

## Anti-patterns

- **Zod fatigue**: re-parsing the same data in every component. Validate at the boundary; inside the app the type is the truth.
- Hand-written interfaces duplicating a schema (they drift apart silently).
- Mind the zod major in this project — zod 4 changed APIs (`z.email()` top-level, reworked error customization); follow the versioned zod guideline.
