# React Router Core

- Routes are configuration, not scattered strings: keep the route tree in one module (`src/routers.tsx` / `src/routes/`), and reference paths via constants or typed helpers — no hardcoded `"/invoices/" + id` concatenation in components.
- URL is state: filters, pagination, tabs and other shareable view state belong in `searchParams`, not in a store (see state-management guideline).
- Navigation through `<Link>`/`<NavLink>`/`useNavigate` — never `window.location` for internal routes.
- Route params are untrusted input: validate/parse before use (see typed-contracts guideline).
- Lazy-load route-level components for code splitting; pair each lazy route with a skeleton fallback (see ui-states guideline).
