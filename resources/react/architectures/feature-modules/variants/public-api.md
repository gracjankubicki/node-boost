# Feature Modules (public-api boundary)

Organize code by feature. Each feature is a module with a public API in `index.ts`; cross-feature imports are allowed **only through that public API**.

## Structure

<code-snippet name="Feature-first layout" lang="text">
src/
├── features/
│   └── invoices/
│       ├── api/          # data access for this feature
│       ├── components/
│       ├── hooks/
│       ├── types.ts
│       └── index.ts      # PUBLIC API — the only cross-feature entry point
├── components/ui/        # shared, domain-agnostic UI kit
├── lib/                  # shared utilities, api client
└── app/                  # routes — compose features, no business logic
</code-snippet>

## Boundary rules (enforced by node-boost audit)

- `NB-ARCH-001` (error): importing another feature's internals is forbidden. `import { CartSummary } from "@/features/cart"` is fine; `import { store } from "@/features/cart/internal/store"` is not.
- `NB-ARCH-002` (error): a feature must never import from `app/**`. Dependency direction is `shared → features → app`.

## Conventions

- Keep `index.ts` deliberately small — every export is a contract. If a feature's public API grows past ~10 exports, it is probably two features.
- Shared code goes down to `lib/` or `components/ui/`, never sideways between features.
- Watch for cycles: if feature A imports B and B imports A (even via `index.ts`), extract the shared piece to `lib/` or compose both at the route level.
- Do not introduce `features/` prematurely — adopt it when a second feature starts bleeding into the first.

## Anti-patterns

- Re-exporting everything from `index.ts` "just in case" — large barrels hurt tree-shaking and make everything public.
- "Shared" modules importing from features (upward dependency).
- Deep relative paths (`../../cart/...`) that dodge the alias — the boundary applies regardless of import style.
