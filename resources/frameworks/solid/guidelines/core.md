# Solid as an Astro Island

Use `@astrojs/solid-js` when Solid's fine-grained reactive model is the deliberate implementation of an Astro island.

- Set the `client:*` directive at the Astro call site and avoid hydrating a component that only renders static markup.
- Pass plain serializable props. Keep Solid signals, stores, effects, resources, and browser APIs within the Solid island; do not serialize live reactive objects.
- Keep request-time fetching, credentials, and authorization in Astro/server code unless the island calls a separately protected browser API.
- Review effects and subscriptions for cleanup and for behavior during hydration; static generation does not make browser effects server-safe.
- Test server output, hydration, fine-grained updates, and request failure states at the appropriate boundary.
