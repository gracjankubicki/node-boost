---
name: modern-typescript
description: Apply strict TypeScript with precise types, safe narrowing, and project-compatible domain modeling.
---

# Modern TypeScript

## When to use this skill

Use when modeling domain types, handling unknown-shaped data, or fixing `NB-ARCH-013`/`NB-ARCH-014`.

## Procedure

1. State that varies by kind → discriminated union with a `kind` field; every `switch` gets a `never` exhaustiveness check in `default`.
2. Closed value set → follow the established representation. Prefer literal unions/const objects for new local APIs; preserve public, generated, or domain enums unless a migration has a concrete benefit.
3. Brand identifiers only where confusing same-shaped values create material domain risk and the codebase has a safe construction boundary.
4. Unknown-shaped data → `unknown`, then a type guard or the installed runtime schema. Avoid unjustified casts; narrow casts are sometimes necessary at DOM/library boundaries and should be localized.
5. Config-like literals → `satisfies` instead of a type annotation.

## Fixing findings

- `NB-ARCH-013`: enable `strict: true` in tsconfig; fix fallout incrementally (start with `strictNullChecks` errors).
- `NB-ARCH-014`: replace `any` with `unknown` + narrowing, a precise type, or a generic. Tests, declarations, and generated output are excluded.
