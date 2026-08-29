# Multi-framework Boundaries

When an Astro project installs multiple UI integrations, each framework is an island implementation detail. Astro pages, data contracts, and framework-neutral primitives are the stable seams.

- Use a framework integration only where its ecosystem or existing component boundary provides a clear benefit.
- Keep React, Vue, Svelte, Solid, Preact, and Lit components in their owning island; do not import framework internals across integrations.
- Share serializable types, accessible HTML contracts, tokens, and framework-neutral utilities instead of sharing hooks or lifecycle assumptions.
- Keep hydration directives and bundle cost visible at the route call site.
- Avoid creating two components with different frameworks for the same concern unless there is a real runtime or ownership reason.
- Test each integration's server output and hydration behavior independently, then test the composed route.
