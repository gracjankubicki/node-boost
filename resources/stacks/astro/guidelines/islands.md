# Astro Islands

An island is a deliberate client boundary inside an otherwise server-rendered Astro page. The directive is part of the performance and correctness contract.

- Start with no hydration. Add `client:load`, `client:idle`, `client:visible`, `client:media`, or `client:only` only when the component needs browser behavior.
- Choose the directive from user impact: eager interaction may use `load`; below-the-fold or optional work should use `idle`, `visible`, or `media`.
- Use `client:only` only when the component cannot render its markup on the server. Declare the correct framework explicitly and accept the SEO and first-render trade-off.
- Pass serializable, minimal props. Do not pass secrets, request objects, database clients, functions, or unbounded records to an island.
- Keep browser APIs and event handlers inside the island. Keep data fetching, authorization, and secrets at the server boundary.
- A `server:defer` server island is not a client island. Define a useful fallback, ensure the response can be cached safely, and isolate user-specific data.
- When multiple UI frameworks are installed, keep each island in its owning framework and avoid sharing framework-specific internals across boundaries.
