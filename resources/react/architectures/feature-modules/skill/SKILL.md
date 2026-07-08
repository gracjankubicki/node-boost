---
name: feature-modules
description: Create and evolve feature modules with enforced boundaries — where new code goes, how features talk to each other, and when code moves to shared.
---

# Feature Modules

## When to use this skill

Use when adding a new feature, deciding where a new file belongs, or resolving a cross-feature import finding (`NB-ARCH-001`/`NB-ARCH-002`).

## Creating a feature

1. Create `src/features/<name>/` with only the folders you need (`api/`, `components/`, `hooks/`, `types.ts`).
2. Add `index.ts` exporting the minimal public surface.
3. Wire it into a route in `app/` — routes compose features, never the other way around.

## Deciding where code goes

- Used by one feature → inside that feature.
- Used by two or more features → `lib/` (logic) or `components/ui/` (domain-agnostic UI).
- Needs another feature's UI + data on one screen → compose in the route, pass props.

## Fixing boundary violations

- `NB-ARCH-001`: import via the feature's `index.ts` (public-api variant) or restructure — move shared code down, or compose at the route (forbid variant).
- `NB-ARCH-002`: the feature imports route-level code; invert it — the route should pass data/callbacks into the feature.
- A justified exception needs `// nb-disable NB-ARCH-001 -- <reason>` with a real reason.
