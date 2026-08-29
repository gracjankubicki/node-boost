# Islands Architecture

Use Astro's islands to keep the document server-rendered and hydrate only the interaction that needs a browser. The boundary is a performance, security, and ownership decision.

## Rules

- Components are static by default; every `client:*` directive needs a user-visible reason.
- Keep data loading and authorization in server/build code. Hydrated components receive minimal serializable view data.
- Select the least eager directive that preserves the interaction contract. Treat `client:only` as an exception requiring a reason.
- Keep an island's state and event handlers inside its owning UI framework. Share framework-neutral data contracts, not framework internals.
- `server:defer` is a separate server island: define a fallback, isolate personalized output, and verify caching.
- `NB-ASTRO-001` (error) reports a hydrated island whose directly imported component imports `node:*` or `astro:env/server`. Move that work to frontmatter or an endpoint and pass serializable data.

## Review questions

- What breaks if this island is not hydrated?
- Can the same behavior remain a normal link, form, or server-rendered component?
- Does the island receive anything that must remain server-only?
- Does its loading or deferred fallback preserve the page's meaningful content?
