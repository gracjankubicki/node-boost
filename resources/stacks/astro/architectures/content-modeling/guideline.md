# Content Modeling

Model content as a typed boundary between source data and rendered routes. Astro content collections should make invalid shape, publication state, and relationships visible before a page is served.

- Give important collections explicit schemas and use generated entry types.
- Distinguish build-time data from live loaders; choose route rendering and cache behavior accordingly.
- Keep drafts and private fields out of public output by construction or by a trusted filter.
- Validate slugs, dates, references, and external IDs at the content boundary.
- Keep content transformation separate from presentation so layouts and islands receive stable view data.
- `NB-ASTRO-002` (warn) reports `@astrojs/db` in Astro 7 projects because that integration is no longer supported there. Migrate the data boundary before upgrading.
