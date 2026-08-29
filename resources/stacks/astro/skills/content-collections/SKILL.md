---
name: astro-content-collections
description: Model, load, query, and test typed Astro content collections.
---

# Astro Content Collections

## When to use this skill

Use when creating or changing `src/content.config.*`, collection schemas, loaders, or collection-driven routes.

## Procedure

1. Decide whether data is build-time or live and confirm the route's rendering mode can support it.
2. Define the smallest schema, including optional fields, defaults, relationships, and publication state.
3. Use generated collection types and query helpers; do not duplicate entry shapes in pages.
4. Validate slugs and related IDs before generating links or loading related entries.
5. Test valid data, schema failure, empty results, and the critical route's generated or runtime output.
