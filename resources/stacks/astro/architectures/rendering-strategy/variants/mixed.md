# Rendering Strategy: Mixed

Use mixed rendering when a project has both stable public routes and request-dependent routes.

- Document the default and every route-level `prerender` exception.
- Keep shared layouts and components compatible with both build-time and request-time execution.
- Test route classification, generated output, SSR output, redirects, and cache behavior separately.
- Do not let a static parent hide a dynamic child contract; use a server island or a separate on-demand boundary deliberately.
