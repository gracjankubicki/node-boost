# Astro Content Collections

Use content collections for typed, repeatable content rather than treating Markdown frontmatter as an unvalidated object.

- Define a schema for every collection whose shape matters. Make optionality and defaults explicit.
- Keep collection entries immutable from the page's point of view; validation and normalization belong in the collection loader or data boundary.
- Distinguish build-time collections from live collections. Build-time content is safe to use during prerendering; live content may require a server route, credentials, and runtime error handling.
- Use generated collection types and query helpers instead of duplicating frontmatter types in components.
- Validate slugs, relationships, dates, and external identifiers before rendering links or querying related entries.
- Keep drafts, unpublished content, and private fields out of the public collection or filter them at a trusted server/build boundary.
- Test a valid entry, a schema failure, an empty result, and a broken relation when the collection drives navigation or a critical page.
