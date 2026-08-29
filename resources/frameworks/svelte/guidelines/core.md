# Svelte as an Astro Island

Use `@astrojs/svelte` when Svelte owns the interactive behavior of an Astro island.

- Choose an explicit `client:*` directive in the Astro template; a Svelte import alone does not justify hydration.
- Pass serializable props and keep Svelte stores, actions, lifecycle code, browser APIs, and event handlers inside the island.
- Keep server-only imports, credentials, and authorization in Astro/server modules. Do not make a hydrated Svelte component the data-access boundary by accident.
- Treat compiled Svelte behavior and custom actions as client code even when the surrounding page is statically generated.
- Test server-rendered output separately from hydration, events, store updates, and deferred/error states where applicable.
