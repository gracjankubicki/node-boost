# Testing Astro Applications

Test the boundary that carries the risk. Astro projects commonly need different checks for component markup, collection contracts, server behavior, and browser islands.

- Run `astro check` for `.astro` syntax, generated types, and TypeScript diagnostics when the project provides it.
- Unit-test pure loaders, mappers, validators, and Action logic without starting a server.
- Test rendered routes or components at the server boundary when output, redirects, headers, or content collections matter.
- Test hydrated islands in the framework's configured component runner and include keyboard, loading, error, and empty states where they exist.
- Use Playwright only when it is installed and the flow needs a real browser: navigation, hydration, forms, cookies, or adapter behavior.
- For SSR, sessions, middleware, cache, and endpoints, include a request-time smoke test against the configured adapter/runtime. A static build alone does not prove those paths.
- Avoid snapshot-only tests, real third-party network calls, and tests that depend on build output ordering.
