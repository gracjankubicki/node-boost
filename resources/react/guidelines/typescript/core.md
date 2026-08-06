# TypeScript Core

- `strict: true` is the floor; treat compiler errors as design feedback, not noise to cast away.
- Avoid `any` and unjustified casts on external data—use `unknown` + narrowing or the installed runtime schema (see typed-contracts and modern-typescript).
- Model new local closed sets with discriminated unions/const objects where useful; preserve established or generated enums unless a coordinated migration has a concrete benefit.
- Derive types instead of duplicating them through the installed schema library, `ReturnType`, `Pick`/`Omit`, and `satisfies`.
- Colocate types with their domain using the repository's established layout. Brand only high-risk, easily confused values with a safe construction boundary.
