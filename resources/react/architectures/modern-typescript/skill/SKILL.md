---
name: modern-typescript
description: Apply strict TypeScript idioms — unknown over any, discriminated unions with exhaustive switches, branded IDs, const objects over enums.
---

# Modern TypeScript

## When to use this skill

Use when modeling domain types, handling unknown-shaped data, or fixing `NB-ARCH-013`/`NB-ARCH-014`.

## Procedure

1. State that varies by kind → discriminated union with a `kind` field; every `switch` gets a `never` exhaustiveness check in `default`.
2. Closed value set → const object + `keyof typeof`, never `enum`.
3. New identifier type → brand it (`string & { readonly __brand: "XId" }`); constructors live next to the schema (`invoiceIdSchema.parse(raw) as InvoiceId` at the boundary only).
4. Unknown-shaped data → `unknown`, then a type guard or zod parse. Never `any`, never bare `as`.
5. Config-like literals → `satisfies` instead of a type annotation.

## Fixing findings

- `NB-ARCH-013`: enable `strict: true` in tsconfig; fix fallout incrementally (start with `strictNullChecks` errors).
- `NB-ARCH-014`: replace `any` with `unknown` + narrowing, a precise type, or a generic; in tests it is tolerated (rule skips test files).
