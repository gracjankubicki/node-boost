# Modern TypeScript

The language contract for this codebase: strict compiler, precise types, safe narrowing, and domain modeling proportionate to risk.

## Compiler

`strict: true` is non-negotiable (`NB-ARCH-013`, warn). New projects also enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.

## No `any` — narrow `unknown`

`any` switches the type checker off at every use site (`NB-ARCH-014`, warn). For unknown data use `unknown` and narrow with guards or the installed schema library (typed-contracts). A cast does not validate external data; keep necessary DOM/library-boundary casts narrow and local. Generated output, declarations, and tests are excluded from the rule.

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

For new local APIs, literal unions or const objects often produce simpler emitted code. Preserve established domain enums and generated contracts unless a coordinated migration has a concrete compatibility or maintenance benefit.

## Branded types for identifiers

<code-snippet name="IDs that cannot be swapped" lang="ts">
type UserId = string & { readonly __brand: "UserId" }
type InvoiceId = string & { readonly __brand: "InvoiceId" }
// payInvoice(userId, invoiceId) with swapped args → compile error, not a prod bug
</code-snippet>

Brands have zero runtime cost but add construction and interoperability overhead. Use them for high-risk, easily confused values when the repository already has—or explicitly adopts—a safe boundary; do not brand every identifier by default.

## Also

- `satisfies` to type-check without widening: `const config = {...} satisfies Config`.
- Prefer `readonly` arrays/fields on data that must not mutate.
