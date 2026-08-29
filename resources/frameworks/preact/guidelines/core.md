# Preact as an Astro Island

Use `@astrojs/preact` for a small Preact island when its runtime and compatibility settings match the project.

- Select an explicit `client:*` directive at the Astro call site; Preact code is not hydrated merely because it is imported.
- Keep Preact-specific signals, hooks, and browser state inside the island. Do not pass signal objects or framework instances across the boundary; pass serializable values.
- Verify whether the project uses Preact's React compatibility layer before importing React-only APIs or types.
- Keep server data fetching, credentials, and authorization in Astro/server code and expose only the island's view contract.
- Test both the generated markup and the hydrated event/state behavior with the configured Preact-compatible runner.
