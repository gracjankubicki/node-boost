# Modern TypeScript

The language contract for this codebase: strict compiler, no `any`, closed sets as unions, IDs as branded types.

## Compiler

`strict: true` is non-negotiable (`NB-ARCH-013`, warn). New projects also enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

## No `any` — narrow `unknown`

`any` switches the type checker off at every use site (`NB-ARCH-014`, warn). For data of unknown shape use `unknown` and narrow with guards or parse with zod (typed-contracts). Casting external data with `as` is the same lie with better manners.

## Closed sets: discriminated unions + exhaustiveness

<code-snippet name="Union with exhaustive switch" lang="ts">
type PaymentState =
  | { kind: "pending" }
  | { kind: "paid"; paidAt: Date }
  | { kind: "failed"; reason: string }

function label(state: PaymentState): string {
  switch (state.kind) {
    case "pending": return "Pending"
    case "paid":    return `Paid ${state.paidAt.toLocaleDateString()}`
    case "failed":  return state.reason
    default: { const _exhaustive: never = state; throw new Error("unreachable") }
  }
}
// Adding { kind: "refunded" } breaks the build HERE — every switch is found for you.
</code-snippet>

Do not use TS `enum` — runtime quirks, poor tree-shaking. Closed value sets are const objects: `const Role = { admin: "admin", user: "user" } as const; type Role = keyof typeof Role`.

## Branded types for identifiers

<code-snippet name="IDs that cannot be swapped" lang="ts">
type UserId = string & { readonly __brand: "UserId" }
type InvoiceId = string & { readonly __brand: "InvoiceId" }
// payInvoice(userId, invoiceId) with swapped args → compile error, not a prod bug
</code-snippet>

Zero runtime cost — compile-time value objects. Use for IDs and easily-confused scalars (amounts, emails).

## Also

- `satisfies` to type-check without widening: `const config = {...} satisfies Config`.
- Prefer `readonly` arrays/fields on data that must not mutate.
