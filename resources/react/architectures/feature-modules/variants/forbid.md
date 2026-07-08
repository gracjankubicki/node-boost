# Feature Modules (forbid boundary)

Organize code by feature. In this strict variant features are fully isolated: **no imports between features at all**. Shared code moves down to `lib/`/`components/ui/`; composite screens are assembled at the route level.

## Structure

<code-snippet name="Feature-first layout" lang="text">
src/
├── features/
│   └── invoices/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── types.ts
│       └── index.ts      # public API consumed ONLY by app/ routes
├── components/ui/        # shared, domain-agnostic UI kit
├── lib/                  # shared utilities, api client
└── app/                  # routes — the ONLY place features are combined
</code-snippet>

## Boundary rules (enforced by node-boost audit)

- `NB-ARCH-001` (error): **any** import from one feature into another is forbidden — including via `index.ts`.
- `NB-ARCH-002` (error): a feature must never import from `app/**`. Dependency direction is `shared → features → app`.

## How to work within the rules

- Need feature B's component inside feature A's screen? Compose both in the route (`app/`), passing data via props.
- Need feature B's types or helpers? Move them to `lib/` — if two features need it, it is shared by definition.
- The payoff: zero dependency cycles, features are deletable and extractable wholesale, and every feature can be understood in isolation.

## Anti-patterns

- Smuggling cross-feature access through `lib/` wrappers that just re-export a feature's internals.
- A giant "shared" dumping ground — `lib/` is for genuinely generic code, not a backdoor.
- Deep relative paths that dodge aliases — the boundary applies regardless of import style.
