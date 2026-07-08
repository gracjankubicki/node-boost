# Feature Modules

Organize code by feature, not by file type. Each feature is a self-contained module with a public API.

## Structure

<code-snippet name="Feature-first layout" lang="text">
src/
├── features/
│   └── invoices/
│       ├── api/          # data access for this feature (see data-access-layer)
│       ├── components/
│       ├── hooks/
│       ├── types.ts
│       └── index.ts      # PUBLIC API — the only entry point for other code
├── components/ui/        # shared, domain-agnostic UI kit
├── lib/                  # shared utilities, api client
└── app/                  # routes — compose features, contain no business logic
</code-snippet>

## Rules

- Dependency direction is one-way: `shared → features → app`. A feature must never import from `app/**` (rule `NB-ARCH-002`, error). Routes compose features; features do not know about routing entry points.
- Keep `index.ts` small: export only what other features/routes genuinely need. Everything not exported is private.
- When two features need the same code, move it down to `lib/` or `components/ui/` — do not import it sideways.
- Do not introduce `features/` prematurely. A handful of screens does not need it; adopt this structure when a second feature starts bleeding into the first.

## Anti-patterns

- Type-first folders at scale (`components/` with 200 files from every domain).
- Barrel files re-exporting everything — export the public surface only; large barrels hurt tree-shaking and build times.
- "Shared" modules importing from features (upward dependency).

For editor-time feedback on these boundaries, `eslint-plugin-boundaries` is a good optional companion; node-boost enforces the same rules in `audit`/`guard`.
