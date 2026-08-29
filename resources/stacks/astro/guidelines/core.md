# Astro Application Baseline

Use this baseline for an Astro application. Local `AGENTS.md`, package scripts, adapter documentation, and nearby code remain authoritative. Confirm the Astro major and the installed integrations before applying version-specific advice.

## Boundaries

- Treat `.astro` files as the route and component boundary. Their frontmatter runs on the server or at build time; the template is not a general-purpose client component.
- Keep server-only credentials, database access, and filesystem work out of hydrated `client:*` islands. Pass the smallest serializable data across the boundary.
- Assume zero client JavaScript unless a component has an explicit `client:*` directive. Do not add hydration to make a static component easier to reuse.
- Select `output: "static"` or `output: "server"` deliberately, then use per-route `prerender` for mixed rendering. Verify the adapter and runtime before relying on request-time APIs.

## Project workflow

1. Read `astro.config.*`, `src/content.config.*`, `src/pages`, package scripts, and the adapter configuration.
2. Use the repository's own checks. `astro check` validates Astro and TypeScript contracts; the build and an adapter-appropriate smoke test validate the runtime boundary.
3. Keep routes thin: load and validate data at the route boundary, then compose layouts, features, and islands.
4. Prefer a stable data contract over passing a large server object into a client island. Serialize dates, errors, and IDs explicitly.
5. When configuration is dynamic, record the uncertainty instead of executing application code during detection or inventing a capability.

## Version awareness

Astro core, integrations, and adapters have independent release lines. Use the documentation matching the installed major and check peer ranges before changing any of them. Do not assume a feature is available because another Astro project uses it.

## Out of scope

These guidelines cover using Astro applications and official/community integrations. They do not define the authoring contract for publishing an Astro integration, deployment adapter, renderer, theme, or starter package.
