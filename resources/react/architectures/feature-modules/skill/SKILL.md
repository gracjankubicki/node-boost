---
name: feature-modules
description: Create and evolve feature modules with enforced boundaries — where new code goes, how features talk to each other, and when code moves to shared.
---

# Feature Modules

## When to use this skill

Use when adding a new feature, deciding where a new file belongs, or resolving a cross-feature import finding (`NB-ARCH-001`/`NB-ARCH-002`).

## Creating a feature

1. Confirm this repository has adopted feature modules and discover its actual feature root. Create `<feature-root>/<name>/` with only the folders its nearby features use.
2. Add `index.ts` exporting the minimal public surface.
3. Wire it into the repository's route/composition layer (Next `app/`, a React Router config/screen, or another documented entry). That layer composes features, never the other way around.

## Deciding where code goes

- Used by one feature → inside that feature.
- Used by multiple features → decide whether it is shared domain code, infrastructure, or domain-agnostic UI; move it to the matching established shared boundary, not automatically to `lib/` or `components/ui/`.
- Needs another feature's UI + data on one screen → compose in the route, pass props.

## Fixing boundary violations

- `NB-ARCH-001`: import via the feature's `index.ts` (public-api variant) or restructure — move shared code down, or compose at the route (forbid variant).
- `NB-ARCH-002`: the feature imports route-level code; invert it — the route should pass data/callbacks into the feature.
- A justified exception needs `// nb-disable NB-ARCH-001 -- <reason>` with a real reason.
