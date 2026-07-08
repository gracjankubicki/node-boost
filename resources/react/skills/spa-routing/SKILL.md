---
name: spa-routing
description: Add screens and navigation in this Vite + React Router SPA — central route config, URL-first state, lazy routes.
---

# SPA Routing

## When to use this skill

Use when adding a screen, changing navigation, or wiring view state to the URL.

## Procedure

1. Add the route in the central route config (`src/routers.tsx`/`src/routes/`) — never scatter path strings through components; use route constants/helpers.
2. Lazy-load the route component (`import()`), pair with a skeleton fallback.
3. Shareable view state (filters, page, tab) → `useSearchParams`, validated before use; do not mirror it into a store.
4. Navigate with `<Link>`/`useNavigate`; internal redirects never touch `window.location`.
5. The screen composes feature components (feature-modules skill); data arrives via query hooks (data-access-layer skill).
