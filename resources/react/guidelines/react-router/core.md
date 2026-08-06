# React Router Core

- Discover the existing route style and keep new definitions with its central route tree. Use existing constants/typed helpers when present; do not mandate a new constants layer for a codebase that consistently uses route literals.
- URL is state: filters, pagination, tabs and other shareable view state belong in `searchParams`, not in a store (see state-management guideline).
- Use `<Link>`/`<NavLink>`/`useNavigate` for ordinary SPA transitions. Full-document navigation is intentional for external destinations, downloads, auth handoffs, or forced reloads.
- Route params are untrusted input: validate/parse before use (see typed-contracts guideline).
- Lazy-load route components where bundle size or route isolation justifies it; a small route need not gain an artificial split. Provide an appropriate fallback for genuinely asynchronous route chunks.
