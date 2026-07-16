---
name: spa-routing
description: Add screens and navigation in this Vite + React Router SPA — central route config, URL-first state, lazy routes.
---

# SPA Routing

## When to use this skill

Use when adding a screen, changing navigation, or wiring view state to the URL.

## Procedure

1. Check the `react-router-dom`/`react-router` major and match the existing central route-object or JSX configuration. Use route constants/helpers only when the repository has that convention.
2. Check for duplicate/shadowed paths. Lazy-load when the route's size or isolation justifies it and pair an asynchronous route with an appropriate fallback.
3. Shareable view state (filters, page, tab) → `useSearchParams`, validated before use; do not mirror it into a store.
4. Navigate ordinary internal transitions with `<Link>`/`useNavigate`; preserve deliberate full-document navigation for external URLs, downloads, auth handoffs, and reloads.
5. Compose the screen using the repository's established sections/components/features. Data arrives through its existing loader, Query, SWR, or custom data layer.
