# TypeScript Core

- `strict: true` is the floor; treat compiler errors as design feedback, not noise to cast away.
- No `any` and no `as` on external data — `unknown` + narrowing, or a zod parse at the boundary (see typed-contracts and modern-typescript guidelines).
- Model closed sets as discriminated unions or const objects (never `enum`); make switches exhaustive with a `never` check.
- Derive types instead of duplicating them: `z.infer`, `ReturnType`, `Pick`/`Omit`, `satisfies` for literal checking.
- Types live next to their domain (feature's `types.ts`); shared primitives (branded IDs) in `lib/`.
