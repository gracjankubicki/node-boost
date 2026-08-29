# Vue as an Astro Island

Use `@astrojs/vue` when a Vue component is the owning implementation of an interactive Astro island.

- Add the `client:*` directive at the Astro call site and choose its eagerness from the interaction requirement.
- Pass a serializable props contract. Keep refs, reactive state, lifecycle work, browser APIs, and Vue-specific provide/inject inside the Vue island.
- Treat Vue slots and component events as internal Vue concerns; expose data and user outcomes through the Astro boundary rather than leaking framework internals.
- Keep request-time data access, credentials, and authorization in Astro/server code. A hydrated Vue component must not import server-only modules.
- Test the initial HTML and the hydrated behavior, including event handling and any loading or empty state rendered by the island.
