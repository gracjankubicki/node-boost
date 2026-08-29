# Astro Core Package

Treat `astro` as the application framework and Vite as its build substrate. A transitive `vite` package does not make an Astro project a Vite React project, and a React integration does not change the application stack to React.

- Resolve behavior from `astro.config.*`, route files, and direct dependencies. Do not infer optional Astro features from a transitive package.
- Keep framework integrations explicit in `integrations`. A project may use more than one UI integration; apply the corresponding framework guidance only to its islands.
- Use Astro's aliases and generated types from the project configuration instead of inventing a second module-resolution convention.
- Preserve the distinction between build-time code, server-rendered code, and browser code when moving logic between `.astro`, endpoints, and islands.
- Check adapter, output mode, and deployment runtime together. `output: "server"` without a compatible adapter is an incomplete deployment configuration.
