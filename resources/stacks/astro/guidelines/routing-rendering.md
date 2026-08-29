# Astro Routing and Rendering

Treat the filesystem route as a public contract. A route can be `.astro`, Markdown/MDX, HTML, a server endpoint, or a dynamic route; its build-time and request-time behavior must be visible from configuration and route metadata.

- Use static generation by default for content that does not depend on the request.
- Mark request-dependent routes on demand and choose a compatible adapter. Do not read `Astro.cookies`, `Astro.session`, or request headers from a route that will only be prerendered.
- In mixed applications, make the boundary explicit with route-level `prerender` and test both branches.
- Use redirects for canonical URL changes and rewrites when the public URL should remain stable. Document rewrites that cross feature or runtime boundaries.
- Keep dynamic and rest parameters constrained by the route contract. Validate external IDs before querying a backend.
- Treat pagination, i18n, trailing-slash, and base-path settings as URL contracts. Check generated links and canonical metadata after changing them.
- Partial pages and client-side navigation are optimizations, not permission to put server-only code in the browser.
